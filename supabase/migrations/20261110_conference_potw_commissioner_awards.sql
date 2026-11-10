
-- Official conference-specific Player of the Week is commissioner selected, not voted.
-- Awarded timestamp/team/stats are immutable snapshots at the moment of receipt.
create table if not exists league_private.ssl_conference_potw_awards (
  season_id uuid not null references league_private.ssl_season_states(id) on delete cascade,
  round_no integer not null check (round_no between 1 and 30),
  conference text not null check (conference in ('supa','galaxy')),
  player integer not null,
  team uuid not null,
  team_name text not null,
  metrics jsonb not null,
  awarded_at timestamptz not null default now(),
  primary key (season_id,round_no,conference)
);
create index if not exists ssl_conference_potw_cabinet_idx
 on league_private.ssl_conference_potw_awards(team,awarded_at desc);
alter table league_private.ssl_conference_potw_awards enable row level security;
revoke all on league_private.ssl_conference_potw_awards from public,anon,authenticated;

create or replace function league_private.ssl_conference_potw_award(
  target_season uuid,target_round integer, choices jsonb
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  current_access jsonb := league_private.current_access();
  season_state jsonb;
  scheduled integer; released integer;
  conf text; entry jsonb; selected_player integer;
  selected_team uuid; selected_team_name text; selected_conf text;
  games_played integer; game_points numeric;
  metrics jsonb; count_given integer;
  award_stamp timestamptz := pg_catalog.now();
begin
  if auth.uid() is null or current_access->>'role'<>'commissioner' then
    raise exception 'Commissioner authorization required for conference awards';
  end if;
  if target_round is null or target_round<1 or target_round>30 then
    raise exception 'Choose a valid two-week award period';
  end if;
  if pg_catalog.jsonb_typeof(choices) is distinct from 'object'
     or not(choices ? 'supa' and choices ? 'galaxy') then
    raise exception 'Pick one winner for each conference';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(9620113);
  select state into season_state from league_private.ssl_season_states
    where id=target_season for update;
  if season_state is null then raise exception 'Unknown season'; end if;
  select pg_catalog.count(*),
         pg_catalog.count(*) filter(where g.value->>'stage'='final')
    into scheduled,released
  from pg_catalog.jsonb_array_elements(coalesce(season_state->'games','[]'::jsonb)) g(value)
  where g.value->>'phase'='regular'
    and (g.value->>'week')::integer between 2*target_round-1 and 2*target_round;
  if scheduled=0 or released<>scheduled then
    raise exception 'Weeks %/% must have all released results (% of % complete)',
      2*target_round-1,2*target_round,released,scheduled;
  end if;
  if exists(select 1 from league_private.ssl_conference_potw_awards
     where season_id=target_season and round_no=target_round) then
    raise exception 'This award period was already issued; existing awards are permanent';
  end if;
  for conf in select unnest(array['supa'::text,'galaxy'::text]) loop
    entry:=choices->conf;
    if pg_catalog.jsonb_typeof(entry) is distinct from 'object'
      or pg_catalog.jsonb_typeof(entry->'player') is distinct from 'number'
      or (entry->>'player') !~ '^[0-9]+$'
      then raise exception 'Invalid winner for conference %',conf;
    end if;
    selected_player:=(entry->>'player')::integer;
    selected_team:=null;selected_team_name:=null;selected_conf:=null;
    select (t.value->>'id')::uuid,t.value->>'name',t.value->>'conference'
      into selected_team,selected_team_name,selected_conf
    from pg_catalog.jsonb_array_elements(coalesce(season_state->'teams','[]'::jsonb)) t(value)
    where t.value->>'conference'=conf
      and coalesce(season_state->'rosters'->(t.value->>'id'),'[]'::jsonb)
        @> pg_catalog.jsonb_build_array(selected_player)
    limit 1;
    if selected_team is null or selected_conf<>conf then
      raise exception 'Selected player % is not currently rostered in % conference',
      selected_player,conf;
    end if;
    select pg_catalog.count(*)::integer,
       coalesce(pg_catalog.sum((p.value->>'gameScore')::numeric),0)
      into games_played,game_points
    from pg_catalog.jsonb_array_elements(season_state->'games') g(value)
    cross join lateral pg_catalog.jsonb_array_elements(coalesce(g.value->'result'->'players','[]'::jsonb)) p(value)
    where g.value->>'phase'='regular' and g.value->>'stage'='final'
      and (g.value->>'week')::integer between 2*target_round-1 and 2*target_round
      and p.value->>'player'=selected_player::text;
    if games_played=0 then raise exception 'Winner must have played in the award period'; end if;
    metrics:=entry->'metrics';
    if pg_catalog.jsonb_typeof(metrics)<>'object'
       or pg_catalog.jsonb_typeof(metrics->'agp')<>'number'
       or pg_catalog.jsonb_typeof(metrics->'ogp')<>'number'
       or pg_catalog.jsonb_typeof(metrics->'dgp')<>'number'
       or pg_catalog.jsonb_typeof(metrics->'pgp')<>'number'
       or pg_catalog.jsonb_typeof(metrics->'gamesPlayed')<>'number' then
      raise exception 'Official AGP, OGP, DGP, PGP and games played are required';
    end if;
    if (metrics->>'gamesPlayed')::integer<>games_played
       or abs((metrics->>'agp')::numeric-game_points/games_played)>0.025
       or abs(((metrics->>'ogp')::numeric+(metrics->>'dgp')::numeric+
           (metrics->>'pgp')::numeric)-(metrics->>'agp')::numeric)>0.035 then
      raise exception 'Award game-point averages do not match the released Project Rio reports';
    end if;
    insert into league_private.ssl_conference_potw_awards(
      season_id,round_no,conference,player,team,team_name,metrics,awarded_at
    ) values (
      target_season,target_round,conf,selected_player,selected_team,
      selected_team_name,metrics,award_stamp
    );
  end loop;
  return pg_catalog.jsonb_build_object('ok',true,'awardedAt',award_stamp,
    'roundNo',target_round,'weeks',pg_catalog.jsonb_build_array(2*target_round-1,2*target_round));
end $$;

create or replace function public.ssl_conference_potw_award(
  target_season uuid,target_round integer,choices jsonb
) returns jsonb language sql set search_path to '' as $$
  select league_private.ssl_conference_potw_award(target_season,target_round,choices);
$$;
revoke all on function public.ssl_conference_potw_award(uuid,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.ssl_conference_potw_award(uuid,integer,jsonb)
  to authenticated;

create or replace function league_private.ssl_conference_potw_read(target_season uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select pg_catalog.jsonb_build_object(
    'conferenceAwards',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',a.season_id::text||':'||a.round_no||':'||a.conference,
        'seasonId',a.season_id,'roundNo',a.round_no,
        'conference',a.conference,'player',a.player,
        'team',a.team,'teamName',a.team_name,'metrics',a.metrics,
        'awardedAt',a.awarded_at,
        'awardTitle',case when a.conference='supa'
          then 'Supa Mario Player of the Week'
          else 'Mario Galaxy Player of the Week' end
      ) order by a.round_no desc,a.conference)
      from league_private.ssl_conference_potw_awards a
      where a.season_id=target_season
    ),'[]'::jsonb),
    'cabinet',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',a.season_id::text||':'||a.round_no||':'||a.conference,
        'seasonId',a.season_id,'seasonNumber',s.number,'seasonName',s.name,
        'roundNo',a.round_no,'weekStart',2*a.round_no-1,
        'weekEnd',2*a.round_no,'conference',a.conference,
        'player',a.player,'team',a.team,'teamName',a.team_name,
        'awardedAt',a.awarded_at,'metrics',a.metrics,
        'awardTitle',case when a.conference='supa'
          then 'Supa Mario Player of the Week'
          else 'Mario Galaxy Player of the Week' end
      ) order by a.awarded_at desc)
      from league_private.ssl_conference_potw_awards a
      join league_private.ssl_season_states s on s.id=a.season_id
    ),'[]'::jsonb)
  )
$$;

create or replace function public.ssl_potw_read(target_season uuid)
returns jsonb language sql stable set search_path to '' as $$
  select league_private.ssl_potw_read(target_season) ||
         league_private.ssl_conference_potw_read(target_season);
$$;
revoke all on function public.ssl_potw_read(uuid) from public,anon,authenticated;
grant execute on function public.ssl_potw_read(uuid) to anon,authenticated;
