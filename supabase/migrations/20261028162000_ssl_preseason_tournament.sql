-- Tournament results are independent of official season games, standings,
-- player statistics, and the currently running draft's state / pick clock.
create table if not exists public.ssl_preseason_results (
  season_id uuid not null references league_private.ssl_season_states(id) on delete cascade,
  match_key text not null check (match_key ~ '^R[1-4]-[1-6]$'),
  team_a uuid not null,
  team_b uuid not null check (team_b <> team_a),
  score_a integer not null check(score_a >= 0),
  score_b integer not null check(score_b >= 0 and score_b <> score_a),
  recorded_at timestamptz not null default now(),
  primary key(season_id,match_key)
);
alter table public.ssl_preseason_results enable row level security;
revoke all on public.ssl_preseason_results from anon, authenticated;
grant select on public.ssl_preseason_results to anon, authenticated;
drop policy if exists "Preseason scores are public" on public.ssl_preseason_results;
create policy "Preseason scores are public" on public.ssl_preseason_results
  for select to anon,authenticated using (true);

-- Independently derive legitimate pairings from server-recorded *active*
-- draft selection seconds. Round advancement requires every prior matchup.
-- Initial 12 -> 6 -> 3; among 3 the highest survivor gets semifinal bye.
create or replace function league_private.ssl_preseason_pair(
  target_season uuid, requested_match text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $fn$
declare
  st jsonb;
  seeds uuid[];
  entrants uuid[];
  promoted uuid[];
  n integer;
  round_no integer;
  idx integer;
  max_match integer;
  a uuid;
  b uuid;
  played public.ssl_preseason_results%rowtype;
begin
  if requested_match !~ '^R[1-4]-[1-6]$' then return null; end if;
  select state into st from league_private.ssl_season_states where id=target_season;
  if st is null or st->>'status' not in
    ('postdraft','regular','postseason','retention','offseason','archived') then
    return null;
  end if;
  select array_agg((team.value->>'id')::uuid order by
    coalesce((select avg((pick.value->>'seconds')::numeric)
      from jsonb_array_elements(st->'picks') pick
      where pick.value->>'team'=team.value->>'id'
        and pick.value->>'seconds' is not null), 1000000000),
        coalesce(array_position(array(select jsonb_array_elements_text(st->'order')),
          team.value->>'id'),team.ord+12))
    into seeds
    from jsonb_array_elements(st->'teams') with ordinality team(value,ord);
  if coalesce(array_length(seeds,1),0)<>12 then return null; end if;
  entrants:=seeds;
  for round_no in 1..4 loop
    n:=coalesce(array_length(entrants,1),0);
    if n<2 then return null; end if;
    max_match:=n/2;
    if split_part(requested_match,'-',1)='R'||round_no then
      idx:=split_part(requested_match,'-',2)::integer;
      if idx>max_match or idx<1 then return null; end if;
      return jsonb_build_object('team_a',entrants[idx+(n%2)],
        'team_b',entrants[n+1-idx]);
    end if;
    promoted:='{}'::uuid[];
    if n%2=1 then promoted:=array_append(promoted,entrants[1]); end if;
    for idx in 1..max_match loop
      a:=entrants[idx+(n%2)]; b:=entrants[n+1-idx];
      select * into played from public.ssl_preseason_results
        where season_id=target_season and match_key='R'||round_no||'-'||idx;
      if not found or played.team_a<>a or played.team_b<>b then
        return null;
      end if;
      promoted:=array_append(promoted,
        case when played.score_a>played.score_b then a else b end);
    end loop;
    select array_agg(x order by array_position(seeds,x)) into entrants
      from unnest(promoted) x;
  end loop;
  return null;
end;
$fn$;
revoke all on function league_private.ssl_preseason_pair(uuid,text) from public;

-- Only an authenticated current SSL commissioner can record or correct scores.
-- A correction is blocked after the next round begins so later pairings
-- cannot silently refer to eliminated teams.
create or replace function public.ssl_preseason_record(
  target_season uuid, target_match text, a_score integer, b_score integer
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  access jsonb:=league_private.current_access();
  pair jsonb;
  round_no integer;
  entry public.ssl_preseason_results%rowtype;
begin
  if auth.uid() is null or access->>'role'<>'commissioner' then
    raise exception 'Commissioner access required';
  end if;
  if target_season is null or target_match !~ '^R[1-4]-[1-6]$'
     or a_score is null or b_score is null or a_score<0 or b_score<0
     or a_score=b_score or a_score>999 or b_score>999 then
    raise exception 'Enter two different nonnegative scores (maximum 999)';
  end if;
  perform pg_advisory_xact_lock(hashtext(target_season::text));
  pair:=league_private.ssl_preseason_pair(target_season,target_match);
  if pair is null then
    raise exception 'Matchup unavailable until the previous round is finished';
  end if;
  round_no:=substring(target_match from 2 for 1)::integer;
  if exists(select 1 from public.ssl_preseason_results r
      where r.season_id=target_season
        and substring(r.match_key from 2 for 1)::integer>round_no) then
    raise exception 'Later rounds already have results; first clear later rounds to correct this matchup';
  end if;
  insert into public.ssl_preseason_results
    (season_id,match_key,team_a,team_b,score_a,score_b)
  values(target_season,target_match,
    (pair->>'team_a')::uuid,(pair->>'team_b')::uuid,a_score,b_score)
  on conflict(season_id,match_key)
  do update set score_a=excluded.score_a,score_b=excluded.score_b,
    recorded_at=now()
  returning * into entry;
  return jsonb_build_object('match_key',entry.match_key,
     'winner',case when entry.score_a>entry.score_b then entry.team_a else entry.team_b end);
end;
$fn$;
revoke all on function public.ssl_preseason_record(uuid,text,integer,integer) from public;
grant execute on function public.ssl_preseason_record(uuid,text,integer,integer) to authenticated;

-- Commissioner-only correction workflow that removes a saved round result,
-- including later rounds (reverse order must be used for those).
create or replace function public.ssl_preseason_clear(target_season uuid,target_match text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $fn$
declare access jsonb:=league_private.current_access();round_no integer;
begin
  if auth.uid() is null or access->>'role'<>'commissioner' then
    raise exception 'Commissioner access required';
  end if;
  if target_match !~ '^R[1-4]-[1-6]$' then raise exception 'Invalid match';end if;
  round_no:=substring(target_match from 2 for 1)::integer;
  if exists (select 1 from public.ssl_preseason_results r
      where r.season_id=target_season
        and substring(r.match_key from 2 for 1)::integer>round_no) then
    raise exception 'Clear later-round games first to protect the bracket';
  end if;
  delete from public.ssl_preseason_results where
    season_id=target_season and match_key=target_match;
  return found;
end;
$fn$;
revoke all on function public.ssl_preseason_clear(uuid,text) from public;
grant execute on function public.ssl_preseason_clear(uuid,text) to authenticated;
