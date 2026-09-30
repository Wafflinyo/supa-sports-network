-- Apply after 001_fantasy.sql. All draft and lineup mutations happen in RPCs.
alter table public.fantasy_leagues add column if not exists state text not null default 'waiting'
  check (state in ('waiting', 'drafting', 'active'));
alter table public.fantasy_leagues add column if not exists draft_started_at timestamptz;

create table if not exists public.fantasy_draft_order (
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot integer not null check (slot between 1 and 8),
  primary key (league_id, user_id), unique (league_id, slot),
  foreign key (league_id, user_id) references public.fantasy_memberships(league_id, user_id) on delete cascade
);
create table if not exists public.fantasy_draft_picks (
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  pick_number integer not null check (pick_number > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id integer not null check (player_id between 1 and 138),
  picked_at timestamptz not null default now(),
  primary key (league_id, pick_number), unique (league_id, player_id),
  foreign key (league_id, user_id) references public.fantasy_memberships(league_id, user_id) on delete cascade
);
create table if not exists public.fantasy_week_lineups (
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  player_id integer not null check (player_id between 1 and 138),
  slot text not null check (slot in ('starter', 'bench')),
  primary key (league_id, user_id, week_start, player_id),
  foreign key (league_id, player_id) references public.fantasy_draft_picks(league_id, player_id) on delete cascade
);
create table if not exists public.fantasy_player_schedule (
  game_key text not null,
  player_id integer not null check (player_id between 1 and 138),
  starts_at timestamptz not null,
  primary key (game_key, player_id)
);
create index if not exists fantasy_schedule_lock_idx on public.fantasy_player_schedule(player_id, starts_at);

alter table public.fantasy_draft_order enable row level security;
alter table public.fantasy_draft_picks enable row level security;
alter table public.fantasy_week_lineups enable row level security;
alter table public.fantasy_player_schedule enable row level security;
create policy "Members see draft order" on public.fantasy_draft_order for select to authenticated
  using (public.is_fantasy_member(league_id));
create policy "Members see draft picks" on public.fantasy_draft_picks for select to authenticated
  using (public.is_fantasy_member(league_id));
create policy "Members see lineups" on public.fantasy_week_lineups for select to authenticated
  using (public.is_fantasy_member(league_id));
create policy "Signed in members see game schedule" on public.fantasy_player_schedule for select to authenticated using (true);

-- Replace the original join function: a league has 6 to 8 managers and cannot join mid-draft.
create or replace function public.join_fantasy_league(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into target from public.fantasy_leagues where invite_code = upper(trim(code)) for update;
  if target.id is null then raise exception 'Invite code not found'; end if;
  if exists(select 1 from public.fantasy_memberships where league_id = target.id and user_id = auth.uid()) then return target.id; end if;
  if target.state <> 'waiting' then raise exception 'This league has already started its draft'; end if;
  if (select count(*) from public.fantasy_memberships where league_id = target.id) >= 8 then
    raise exception 'This league already has eight managers';
  end if;
  insert into public.fantasy_memberships (league_id, user_id) values (target.id, auth.uid());
  return target.id;
end;
$$;

create or replace function public.start_fantasy_draft(target_league uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; managers integer;
begin
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or target.owner_id <> auth.uid() then raise exception 'Only the commissioner can start the draft'; end if;
  if target.state <> 'waiting' then raise exception 'Draft already started'; end if;
  select count(*) into managers from public.fantasy_memberships where league_id = target_league;
  if managers not between 6 and 8 then raise exception 'The draft requires 6 to 8 managers'; end if;
  insert into public.fantasy_draft_order (league_id, user_id, slot)
  select target_league, user_id, row_number() over (order by joined_at, user_id)
  from public.fantasy_memberships where league_id = target_league;
  update public.fantasy_leagues set state = 'drafting', draft_started_at = now() where id = target_league;
end;
$$;

create or replace function public.make_fantasy_pick(target_league uuid, chosen_player integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; managers integer; next_pick integer; round_index integer; expected_slot integer; my_slot integer;
begin
  if chosen_player not between 1 and 138 then raise exception 'Unknown player ID'; end if;
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or target.state <> 'drafting' then raise exception 'Draft is not open'; end if;
  select count(*) into managers from public.fantasy_draft_order where league_id = target_league;
  select count(*) + 1 into next_pick from public.fantasy_draft_picks where league_id = target_league;
  if next_pick > managers * 10 then raise exception 'Draft is complete'; end if;
  round_index := (next_pick - 1) / managers;
  expected_slot := case when round_index % 2 = 0 then (next_pick - 1) % managers + 1
                        else managers - (next_pick - 1) % managers end;
  select slot into my_slot from public.fantasy_draft_order where league_id = target_league and user_id = auth.uid();
  if my_slot is distinct from expected_slot then raise exception 'It is not your turn'; end if;
  insert into public.fantasy_draft_picks (league_id, pick_number, user_id, player_id)
    values (target_league, next_pick, auth.uid(), chosen_player);
  if next_pick = managers * 10 then update public.fantasy_leagues set state = 'active' where id = target_league; end if;
  return next_pick;
end;
$$;

create or replace function public.fantasy_week_start(at_time timestamptz)
returns date language sql stable set search_path = '' as $$
  select (at_time at time zone 'America/New_York')::date
       - extract(dow from at_time at time zone 'America/New_York')::integer;
$$;

create or replace function public.ensure_fantasy_week(target_league uuid)
returns date language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; current_week date; seed_week date;
begin
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or not public.is_fantasy_member(target_league) then raise exception 'You are not a member'; end if;
  if target.state <> 'active' then raise exception 'Complete the draft first'; end if;
  current_week := public.fantasy_week_start(now());
  seed_week := public.fantasy_week_start(target.draft_started_at);
  while seed_week <= current_week loop
    insert into public.fantasy_week_lineups (league_id, user_id, week_start, player_id, slot)
    select p.league_id, p.user_id, seed_week, p.player_id,
      coalesce(prior.slot, case when row_number() over (partition by p.user_id order by p.pick_number) <= 7
                               then 'starter' else 'bench' end)
    from public.fantasy_draft_picks p
    left join lateral (
      select l.slot from public.fantasy_week_lineups l
      where l.league_id = p.league_id and l.user_id = p.user_id and l.player_id = p.player_id
        and l.week_start < seed_week order by l.week_start desc limit 1
    ) prior on true
    where p.league_id = target_league
    on conflict do nothing;
    seed_week := seed_week + 7;
  end loop;
  return current_week;
end;
$$;

create or replace function public.swap_fantasy_lineup(target_league uuid, starter_player integer, bench_player integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_week date; starter_slot text; bench_slot text; owner uuid;
begin
  current_week := public.ensure_fantasy_week(target_league);
  if starter_player = bench_player then raise exception 'Choose two different players'; end if;
  select user_id, slot into owner, starter_slot from public.fantasy_week_lineups
  where league_id = target_league and user_id = auth.uid() and week_start = current_week and player_id = starter_player for update;
  select slot into bench_slot from public.fantasy_week_lineups
  where league_id = target_league and user_id = auth.uid() and week_start = current_week and player_id = bench_player for update;
  if owner is null or starter_slot <> 'starter' or bench_slot is distinct from 'bench' then
    raise exception 'Select one of your starters and one of your bench players';
  end if;
  if exists(select 1 from public.fantasy_player_schedule
            where player_id in (starter_player, bench_player)
              and starts_at >= (current_week::timestamp at time zone 'America/New_York')
              and starts_at <= now()) then
    raise exception 'One of these players has started a game this week and is locked';
  end if;
  update public.fantasy_week_lineups set slot = case when player_id = starter_player then 'bench' else 'starter' end
    where league_id = target_league and user_id = auth.uid() and week_start = current_week
      and player_id in (starter_player, bench_player);
end;
$$;

revoke all on function public.start_fantasy_draft(uuid), public.make_fantasy_pick(uuid,integer),
  public.ensure_fantasy_week(uuid), public.swap_fantasy_lineup(uuid,integer,integer) from public;
grant execute on function public.start_fantasy_draft(uuid), public.make_fantasy_pick(uuid,integer),
  public.ensure_fantasy_week(uuid), public.swap_fantasy_lineup(uuid,integer,integer) to authenticated;
