
-- Player of the Week: two regular-season weeks per award, private commissioner shortlist,
-- one ballot per signed-in account, immutable winning-team attribution.
create table if not exists league_private.ssl_potw_rounds (
  season_id uuid not null references league_private.ssl_season_states(id) on delete cascade,
  round_no integer not null check (round_no between 1 and 30),
  status text not null default 'draft' check (status in ('draft','open','final')),
  nominees jsonb not null default '[]'::jsonb check (jsonb_typeof(nominees)='array'),
  closes_at timestamptz,
  published_at timestamptz,
  winner_player integer,
  winner_team uuid,
  winner_team_name text,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(season_id,round_no)
);
create table if not exists league_private.ssl_potw_votes (
  season_id uuid not null,
  round_no integer not null,
  voter uuid not null,
  player integer not null,
  voted_at timestamptz not null default now(),
  primary key (season_id,round_no,voter),
  foreign key(season_id,round_no) references league_private.ssl_potw_rounds(season_id,round_no) on delete cascade
);
create index if not exists ssl_potw_cabinet_team_idx on league_private.ssl_potw_rounds(winner_team,finalized_at desc) where status='final';
alter table league_private.ssl_potw_rounds enable row level security;
alter table league_private.ssl_potw_votes enable row level security;
revoke all on league_private.ssl_potw_rounds,league_private.ssl_potw_votes from public,anon,authenticated;

create or replace function league_private.ssl_potw_read(target_season uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare commissioner boolean := coalesce(league_private.current_access()->>'role','')='commissioner';
begin
  return pg_catalog.jsonb_build_object(
    'rounds',coalesce((
       select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
         'roundNo',r.round_no,'status',r.status,'nominees',r.nominees,
         'closesAt',r.closes_at,'publishedAt',r.published_at,'finalizedAt',r.finalized_at,
         'winnerPlayer',r.winner_player,'winnerTeam',r.winner_team,
         'winnerTeamName',r.winner_team_name,
         'ballots',(select pg_catalog.count(*) from league_private.ssl_potw_votes v where v.season_id=r.season_id and v.round_no=r.round_no),
         'myVote',(select v.player from league_private.ssl_potw_votes v where v.season_id=r.season_id and v.round_no=r.round_no and v.voter=auth.uid()),
         'totals',case when commissioner or r.status='final' or (r.closes_at is not null and r.closes_at<=now())
           then coalesce((select pg_catalog.jsonb_object_agg(z.player::text,z.count) from (
                select v.player,pg_catalog.count(*) as count from league_private.ssl_potw_votes v
                where v.season_id=r.season_id and v.round_no=r.round_no group by v.player
           ) z),'{}'::jsonb)
           else '{}'::jsonb end
       ) order by r.round_no desc)
       from league_private.ssl_potw_rounds r
       where r.season_id=target_season and (r.status<>'draft' or commissioner)
    ),'[]'::jsonb),
    'cabinet',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',r.season_id::text||':'||r.round_no::text,
        'seasonId',r.season_id,'seasonNumber',s.number,'seasonName',s.name,
        'roundNo',r.round_no,'weekStart',2*r.round_no-1,'weekEnd',2*r.round_no,
        'player',r.winner_player,'team',r.winner_team,'teamName',r.winner_team_name,
        'awardedAt',r.finalized_at,'award','Player of the Week Award'
      ) order by r.finalized_at desc)
      from league_private.ssl_potw_rounds r
      join league_private.ssl_season_states s on s.id=r.season_id
      where r.status='final' and r.winner_player is not null
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.ssl_potw_read(target_season uuid)
returns jsonb language sql stable set search_path to '' as $$
  select league_private.ssl_potw_read(target_season);
$$;

create or replace function league_private.ssl_potw_manage(
  target_season uuid,target_round integer,operation text,
  selected_players jsonb default '[]'::jsonb,close_at timestamptz default null,tie_player integer default null
)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  st jsonb; r league_private.ssl_potw_rounds%rowtype;
  week_begin integer := 2*target_round-1; week_end integer := 2*target_round;
  scheduled integer; finished integer; eligible integer; picked integer; n integer; nomination jsonb:='[]'::jsonb;
  entry jsonb; player_id integer; team_id text; team_name text;
  most_votes integer; leaders integer[]; winner integer;
begin
  if auth.uid() is null or league_private.current_access()->>'role'<>'commissioner'
    then raise exception 'Commissioner access required'; end if;
  if target_round is null or target_round<1 or target_round>30 then raise exception 'Invalid award window';end if;
  perform pg_catalog.pg_advisory_xact_lock(9620113);
  select state into st from league_private.ssl_season_states where id=target_season for update;
  if st is null then raise exception 'SSL season not found';end if;
  select pg_catalog.count(*),pg_catalog.count(*) filter(where g.value->>'stage'='final') into scheduled,finished
  from pg_catalog.jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) g(value)
  where g.value->>'phase'='regular' and (g.value->>'week')::int between week_begin and week_end;
  if scheduled=0 or finished<>scheduled then
    raise exception 'Release all regular-season results for Weeks %/% first (% of % complete)',week_begin,week_end,finished,scheduled;
  end if;
  select * into r from league_private.ssl_potw_rounds
  where season_id=target_season and round_no=target_round for update;
  if operation in ('save','publish') then
    if r.status in ('open','final') then raise exception 'Published awards cannot be edited';end if;
    if pg_catalog.jsonb_typeof(selected_players) is distinct from 'array'
      or pg_catalog.jsonb_array_length(selected_players) not between 1 and 12
      then raise exception 'Select 1–12 nominees';end if;
    if operation='publish' and pg_catalog.jsonb_array_length(selected_players)<2
      then raise exception 'Select at least two nominees before opening voting';end if;
    if (select pg_catalog.count(distinct value::text) from pg_catalog.jsonb_array_elements(selected_players)) <>
       pg_catalog.jsonb_array_length(selected_players) then raise exception 'Duplicate nominees are not allowed';end if;
    for entry in select value from pg_catalog.jsonb_array_elements(selected_players) loop
      if pg_catalog.jsonb_typeof(entry)<>'number' or entry::text !~ '^[0-9]+$'
        then raise exception 'Invalid nominee player ID';end if;
      player_id:=(entry::text)::int;
      select pg_catalog.count(*) into eligible from pg_catalog.jsonb_array_elements(st->'games') g(value)
      cross join lateral pg_catalog.jsonb_array_elements(coalesce(g.value->'result'->'players','[]'::jsonb)) p(value)
      where g.value->>'phase'='regular' and g.value->>'stage'='final'
        and (g.value->>'week')::int between week_begin and week_end
        and p.value->>'player'=player_id::text;
      if eligible=0 then raise exception 'Nominee % has no released games in this award window',player_id;end if;
      -- Snapshot the franchise the player represents, used to display the published ballot.
      select t.key into team_id from pg_catalog.jsonb_each(coalesce(st->'rosters','{}'::jsonb)) t(key,value)
      where t.value @> pg_catalog.jsonb_build_array(player_id) order by t.key limit 1;
      if team_id is null then
        select p.value->>'team' into team_id
        from pg_catalog.jsonb_array_elements(st->'games') g(value)
        cross join lateral pg_catalog.jsonb_array_elements(coalesce(g.value->'result'->'players','[]'::jsonb)) p(value)
        where g.value->>'phase'='regular' and g.value->>'stage'='final'
          and (g.value->>'week')::int between week_begin and week_end
          and p.value->>'player'=player_id::text
        order by (g.value->>'week')::int desc limit 1;
      end if;
      select t.value->>'name' into team_name
      from pg_catalog.jsonb_array_elements(coalesce(st->'teams','[]'::jsonb)) t(value)
      where t.value->>'id'=team_id limit 1;
      nomination:=nomination||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('player',player_id,'team',team_id,'teamName',coalesce(team_name,'SSL Team')));
      team_id:=null;team_name:=null;
    end loop;
    if operation='publish' and (close_at is null or close_at<=now() or close_at>now()+interval '30 days')
      then raise exception 'Set a voting deadline within the next 30 days'; end if;
    insert into league_private.ssl_potw_rounds(season_id,round_no,nominees,status,closes_at,published_at)
    values(target_season,target_round,nomination,
      case when operation='publish' then 'open' else 'draft' end,
      case when operation='publish' then close_at else null end,
      case when operation='publish' then now() else null end)
    on conflict(season_id,round_no) do update set
      nominees=excluded.nominees,status=excluded.status,closes_at=excluded.closes_at,
      published_at=excluded.published_at,updated_at=now();
    return pg_catalog.jsonb_build_object('ok',true,'status',case when operation='publish' then 'open' else 'draft' end);
  elsif operation='finalize' then
    if r.status is distinct from 'open' then raise exception 'Only published ballots can be finalized';end if;
    if now()<r.closes_at then raise exception 'Wait until voting closes';end if;
    select pg_catalog.max(n) into most_votes from
       (select pg_catalog.count(*)::integer n from league_private.ssl_potw_votes
        where season_id=target_season and round_no=target_round group by player) v;
    if most_votes is null or most_votes=0 then raise exception 'No votes were cast in this award window';end if;
    select pg_catalog.array_agg(player order by player) into leaders from
      (select player,pg_catalog.count(*)::integer n from league_private.ssl_potw_votes
       where season_id=target_season and round_no=target_round group by player) z
      where z.n=most_votes;
    if pg_catalog.array_length(leaders,1)>1 then
      if tie_player is null or not (tie_player = any(leaders))
        then raise exception 'The vote is tied; commissioner must select a tied leader';end if;
      winner:=tie_player;
    else winner:=leaders[1];end if;
    -- Award ownership is frozen here, not at the end of the season.
    select t.key into team_id from pg_catalog.jsonb_each(coalesce(st->'rosters','{}'::jsonb)) t(key,value)
    where t.value @> pg_catalog.jsonb_build_array(winner) order by t.key limit 1;
    if team_id is null then raise exception 'Award winner has no current rostered franchise';end if;
    select t.value->>'name' into team_name
    from pg_catalog.jsonb_array_elements(coalesce(st->'teams','[]'::jsonb)) t(value)
    where t.value->>'id'=team_id limit 1;
    update league_private.ssl_potw_rounds set status='final',winner_player=winner,
      winner_team=team_id::uuid,winner_team_name=coalesce(team_name,'SSL Team'),finalized_at=now(),updated_at=now()
    where season_id=target_season and round_no=target_round;
    return pg_catalog.jsonb_build_object('ok',true,'winner',winner,'team',team_id,'teamName',team_name);
  else raise exception 'Unsupported award action';end if;
end $$;

create or replace function public.ssl_potw_manage(
  target_season uuid,target_round integer,operation text,
  selected_players jsonb default '[]'::jsonb,close_at timestamptz default null,tie_player integer default null
)
returns jsonb language sql set search_path to '' as $$
  select league_private.ssl_potw_manage(target_season,target_round,operation,selected_players,close_at,tie_player);
$$;

create or replace function league_private.ssl_potw_vote(target_season uuid,target_round integer,chosen_player integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r league_private.ssl_potw_rounds%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to vote';end if;
  select * into r from league_private.ssl_potw_rounds
    where season_id=target_season and round_no=target_round for update;
  if r.status is distinct from 'open' or r.closes_at<=now() then raise exception 'This ballot is closed';end if;
  if not exists(select 1 from pg_catalog.jsonb_array_elements(r.nominees) n(value)
                where (n.value->>'player')::integer=chosen_player)
    then raise exception 'Vote for one of the commissioner-approved nominees';end if;
  insert into league_private.ssl_potw_votes(season_id,round_no,voter,player)
    values(target_season,target_round,auth.uid(),chosen_player)
    on conflict(season_id,round_no,voter) do update set player=excluded.player,voted_at=now();
  return pg_catalog.jsonb_build_object('ok',true,'player',chosen_player);
end $$;

create or replace function public.ssl_potw_vote(target_season uuid,target_round integer,chosen_player integer)
returns jsonb language sql set search_path to '' as $$
  select league_private.ssl_potw_vote(target_season,target_round,chosen_player);
$$;

revoke all on function public.ssl_potw_read(uuid),public.ssl_potw_manage(uuid,integer,text,jsonb,timestamptz,integer),public.ssl_potw_vote(uuid,integer,integer)
  from public,anon,authenticated;
grant execute on function public.ssl_potw_read(uuid) to anon,authenticated;
grant execute on function public.ssl_potw_manage(uuid,integer,text,jsonb,timestamptz,integer) to authenticated;
grant execute on function public.ssl_potw_vote(uuid,integer,integer) to authenticated;
