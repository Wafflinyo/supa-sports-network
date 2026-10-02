-- Keep elevated implementations outside the exposed API schema.

begin;

create or replace function league_private.is_fantasy_member(target_league uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.fantasy_memberships m
                where m.league_id = target_league and m.user_id = (select auth.uid()));
$$;

create or replace function public.is_fantasy_member(target_league uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select league_private.is_fantasy_member(target_league);
$$;

revoke all on function public.is_fantasy_member(uuid), league_private.is_fantasy_member(uuid) from public, anon;

grant execute on function public.is_fantasy_member(uuid), league_private.is_fantasy_member(uuid) to authenticated;

create or replace function league_private.create_fantasy_league(league_name text)
returns public.fantasy_leagues language plpgsql security definer set search_path = '' as $$
declare new_league public.fantasy_leagues;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if char_length(trim(league_name)) not between 2 and 60 then raise exception 'Enter a league name (2–60 characters)'; end if;
  insert into public.fantasy_leagues (name, owner_id) values (trim(league_name), auth.uid()) returning * into new_league;
  insert into public.fantasy_memberships (league_id, user_id, role) values (new_league.id, auth.uid(), 'commissioner');
  return new_league;
end;
$$;

create or replace function public.create_fantasy_league(league_name text)
returns public.fantasy_leagues language sql security invoker set search_path = '' as $$
  select league_private.create_fantasy_league(league_name);
$$;

revoke all on function public.create_fantasy_league(text), league_private.create_fantasy_league(text) from public, anon;

grant execute on function public.create_fantasy_league(text), league_private.create_fantasy_league(text) to authenticated;

create or replace function league_private.join_fantasy_league(code text)
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

create or replace function public.join_fantasy_league(code text)
returns uuid language sql security invoker set search_path = '' as $$
  select league_private.join_fantasy_league(code);
$$;

revoke all on function public.join_fantasy_league(text), league_private.join_fantasy_league(text) from public, anon;

grant execute on function public.join_fantasy_league(text), league_private.join_fantasy_league(text) to authenticated;

create or replace function league_private.start_fantasy_draft(target_league uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; managers integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or target.owner_id is distinct from auth.uid() then raise exception 'Only the commissioner can start the draft'; end if;
  if target.state <> 'waiting' then raise exception 'Draft already started'; end if;
  select count(*) into managers from public.fantasy_memberships where league_id = target_league;
  if managers not between 6 and 8 then raise exception 'The draft requires 6 to 8 managers'; end if;
  insert into public.fantasy_draft_order (league_id, user_id, slot)
  select target_league, user_id, row_number() over (order by joined_at, user_id)
  from public.fantasy_memberships where league_id = target_league;
  update public.fantasy_leagues set state = 'drafting', draft_started_at = now() where id = target_league;
end;
$$;

create or replace function public.start_fantasy_draft(target_league uuid)
returns void language sql security invoker set search_path = '' as $$
  select league_private.start_fantasy_draft(target_league);
$$;

revoke all on function public.start_fantasy_draft(uuid), league_private.start_fantasy_draft(uuid) from public, anon;

grant execute on function public.start_fantasy_draft(uuid), league_private.start_fantasy_draft(uuid) to authenticated;

create or replace function league_private.make_fantasy_pick(target_league uuid, chosen_player integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; managers integer; next_pick integer; round_index integer; expected_slot integer; my_slot integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
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

create or replace function public.make_fantasy_pick(target_league uuid, chosen_player integer)
returns integer language sql security invoker set search_path = '' as $$
  select league_private.make_fantasy_pick(target_league, chosen_player);
$$;

revoke all on function public.make_fantasy_pick(uuid,integer), league_private.make_fantasy_pick(uuid,integer) from public, anon;

grant execute on function public.make_fantasy_pick(uuid,integer), league_private.make_fantasy_pick(uuid,integer) to authenticated;

create or replace function league_private.ensure_fantasy_week(target_league uuid)
returns date language plpgsql security definer set search_path = '' as $$
declare target public.fantasy_leagues%rowtype; current_week date; seed_week date;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into target from public.fantasy_leagues where id = target_league for update;
  if target.id is null or not league_private.is_fantasy_member(target_league) then raise exception 'You are not a member'; end if;
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

create or replace function public.ensure_fantasy_week(target_league uuid)
returns date language sql security invoker set search_path = '' as $$
  select league_private.ensure_fantasy_week(target_league);
$$;

revoke all on function public.ensure_fantasy_week(uuid), league_private.ensure_fantasy_week(uuid) from public, anon;

grant execute on function public.ensure_fantasy_week(uuid), league_private.ensure_fantasy_week(uuid) to authenticated;

create or replace function league_private.swap_fantasy_lineup(target_league uuid, starter_player integer, bench_player integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_week date; starter_slot text; bench_slot text; owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  current_week := league_private.ensure_fantasy_week(target_league);
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

create or replace function public.swap_fantasy_lineup(target_league uuid, starter_player integer, bench_player integer)
returns void language sql security invoker set search_path = '' as $$
  select league_private.swap_fantasy_lineup(target_league, starter_player, bench_player);
$$;

revoke all on function public.swap_fantasy_lineup(uuid,integer,integer), league_private.swap_fantasy_lineup(uuid,integer,integer) from public, anon;

grant execute on function public.swap_fantasy_lineup(uuid,integer,integer), league_private.swap_fantasy_lineup(uuid,integer,integer) to authenticated;

commit;

select count(*) as public_elevated_functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef;
