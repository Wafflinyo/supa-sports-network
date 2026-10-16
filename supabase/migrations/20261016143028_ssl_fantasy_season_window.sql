-- Fantasy leagues belong to one SSL regular season and cannot predate its draft.
alter table public.fantasy_leagues add column ssl_season_id uuid references league_private.ssl_season_states(id), add column activated_at timestamptz, add column first_week date;
create index fantasy_leagues_ssl_season_idx on public.fantasy_leagues(ssl_season_id);
create function league_private.ssl_fantasy_ready(target uuid default null) returns uuid language plpgsql stable security definer set search_path='' as $$
declare s league_private.ssl_season_states;begin
 select * into s from league_private.ssl_season_states where target is null or id=target order by number desc limit 1;
 if s.id is null or s.state->>'status' not in ('postdraft','regular') or jsonb_array_length(s.state->'teams')<>12 or exists(select 1 from jsonb_array_elements(s.state->'teams') t where jsonb_array_length(league_private.ssl_roster(s.state,t->>'id'))<11) then raise exception 'Fantasy leagues open after the SSL draft is complete and all twelve rosters have at least eleven players';end if;
 if jsonb_array_length(coalesce(s.state->'finalStandings','[]'))=12 or (s.state->>'weekOne' is not null and now()>=(((s.state->>'weekOne')::date+154)::timestamp at time zone 'America/New_York')) then raise exception 'This SSL regular season has ended';end if;
 return s.id;
end$$;
revoke all on function league_private.ssl_fantasy_ready(uuid) from public,anon,authenticated;
create function league_private.fantasy_season_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s league_private.ssl_season_states;begin
 perform pg_advisory_xact_lock(736114221);
 if tg_op='INSERT' then
  new.ssl_season_id:=league_private.ssl_fantasy_ready();new.activated_at:=null;new.first_week:=null;
 elsif new.state is distinct from old.state and new.state in ('drafting','active') then
  new.ssl_season_id:=league_private.ssl_fantasy_ready(new.ssl_season_id);
  if new.state='active' then
   new.activated_at:=now();select * into s from league_private.ssl_season_states where id=new.ssl_season_id;
   if s.state->>'weekOne' is not null then new.first_week:=greatest((s.state->>'weekOne')::date,public.fantasy_week_start(now()));end if;
  end if;
 end if;return new;
end$$;
revoke all on function league_private.fantasy_season_guard() from public,anon,authenticated;
create trigger fantasy_season_guard before insert or update on public.fantasy_leagues for each row execute function league_private.fantasy_season_guard();
create or replace function league_private.ensure_fantasy_week(target_league uuid) returns date language plpgsql security definer set search_path='' as $$
declare target public.fantasy_leagues;s league_private.ssl_season_states;current_week date;seed_week date;start_week date;last_week date;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform pg_advisory_xact_lock(736114221);
 select * into target from public.fantasy_leagues where id=target_league for update;
 if target.id is null or not league_private.is_fantasy_member(target_league) then raise exception 'You are not a member';end if;
 if target.state<>'active' then raise exception 'Complete the fantasy draft first';end if;
 select * into s from league_private.ssl_season_states where id=target.ssl_season_id;
 if s.id is null then raise exception 'This league is not linked to an SSL season';end if;
 if s.state->>'weekOne' is null then return public.fantasy_week_start(now());end if;
 start_week:=coalesce(target.first_week,greatest((s.state->>'weekOne')::date,public.fantasy_week_start(target.activated_at)));
 if target.first_week is null then update public.fantasy_leagues set first_week=start_week where id=target_league;end if;
 last_week:=(s.state->>'weekOne')::date+147;
 current_week:=least(last_week,greatest(start_week,public.fantasy_week_start(now())));seed_week:=start_week;
 while seed_week<=current_week loop
  insert into public.fantasy_week_lineups(league_id,user_id,week_start,player_id,slot)
  select p.league_id,p.user_id,seed_week,p.player_id,coalesce(prior.slot,case when row_number() over(partition by p.user_id order by p.pick_number)<=7 then 'starter' else 'bench' end)
  from public.fantasy_draft_picks p left join lateral(select l.slot from public.fantasy_week_lineups l where l.league_id=p.league_id and l.user_id=p.user_id and l.player_id=p.player_id and l.week_start<seed_week order by l.week_start desc limit 1) prior on true where p.league_id=target_league on conflict do nothing;
  seed_week:=seed_week+7;
 end loop;return current_week;
end$$;

CREATE OR REPLACE FUNCTION league_private.make_fantasy_pick(target_league uuid, chosen_player integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.fantasy_leagues%rowtype; managers integer; next_pick integer; round_index integer; expected_slot integer; my_slot integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists(select 1 from league_private.ssl_catalog where id=chosen_player) then raise exception 'Unknown player ID';end if;
  perform pg_advisory_xact_lock(736114221);
  select * into target from public.fantasy_leagues where id=target_league for update;
  if target.id is null or target.state<>'drafting' then raise exception 'Draft is not open';end if;
  perform league_private.ssl_fantasy_ready(target.ssl_season_id);
  if not exists(select 1 from league_private.ssl_season_states s cross join lateral jsonb_each(s.state->'rosters') r where s.id=target.ssl_season_id and r.value @> jsonb_build_array(chosen_player)) then raise exception 'Fantasy players must belong to this SSL season roster';end if;
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
$function$
;

create or replace function league_private.swap_fantasy_lineup(target_league uuid, starter_player integer, bench_player integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_week date; starter_slot text; bench_slot text; owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(736114221);
  perform league_private.ssl_fantasy_ready((select ssl_season_id from public.fantasy_leagues where id=target_league));
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
              and starts_at < ((current_week+7)::timestamp at time zone 'America/New_York')
              and locked_at <= now()) then
    raise exception 'One of these players has a recorded game this week and is locked';
  end if;
  update public.fantasy_week_lineups set slot = case when player_id = starter_player then 'bench' else 'starter' end
    where league_id = target_league and user_id = auth.uid() and week_start = current_week
      and player_id in (starter_player, bench_player);
end;
$$;
