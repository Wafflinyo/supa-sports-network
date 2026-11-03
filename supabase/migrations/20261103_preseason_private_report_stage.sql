-- Private Project Rio preseason report staging; only commissioner RPCs can read unreleased reports.
-- Public bracket results remain in the existing ssl_preseason_results table.
create table if not exists league_private.ssl_preseason_game_reports (
  season_id uuid not null references league_private.ssl_season_states(id) on delete cascade,
  match_key text not null check (match_key ~ '^R[1-4]-[1-6]$'),
  team_a uuid not null,
  team_b uuid not null,
  score_a integer not null check (score_a between 0 and 999),
  score_b integer not null check (score_b between 0 and 999),
  report jsonb not null,
  filename text not null,
  fingerprint text,
  saved_at timestamptz not null default now(),
  released_at timestamptz,
  primary key (season_id,match_key),
  check (score_a <> score_b),
  check (jsonb_typeof(report)='object')
);
alter table league_private.ssl_preseason_game_reports enable row level security;
revoke all on league_private.ssl_preseason_game_reports from public,anon,authenticated;

-- Explicitly public read: never returns unreleased reports, even for authenticated users.
create or replace function public.ssl_preseason_published_reports(target_season uuid default null)
returns jsonb language sql stable security definer set search_path=''
as $fn$
  select coalesce(jsonb_agg(
    r.report || jsonb_build_object('releasedAt',r.released_at,'matchKey',r.match_key)
    order by r.released_at, r.match_key
  ),'[]'::jsonb)
  from league_private.ssl_preseason_game_reports r
  where r.released_at is not null
    and (target_season is null or r.season_id=target_season)
$fn$;
revoke all on function public.ssl_preseason_published_reports(uuid) from public;
grant execute on function public.ssl_preseason_published_reports(uuid) to anon,authenticated;

-- All private management commands enforce current *server-side* commissioner access.
-- A staged report changes no bracket, public results, rankings or statistics.
create or replace function public.ssl_preseason_report_action(
  target_season uuid, target_match text, operation text, game_report jsonb default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  access jsonb;
  pair jsonb;
  saved league_private.ssl_preseason_game_reports%rowtype;
  a uuid;
  b uuid;
  score_a numeric;
  score_b numeric;
  a_rows integer;
  b_rows integer;
  all_rows integer;
  unique_players integer;
  mvp_team uuid;
  winner uuid;
  round_no integer;
begin
  access:=league_private.current_access();
  if auth.uid() is null or coalesce(access->>'role','')<>'commissioner' then
    raise exception 'Commissioner access required';
  end if;
  if target_season is null then raise exception 'Select a season';end if;
  if operation='list' then
    return coalesce((select jsonb_agg(
      jsonb_build_object('matchKey',r.match_key,'filename',r.filename,
        'savedAt',r.saved_at,'releasedAt',r.released_at,'report',r.report)
      order by r.saved_at desc)
      from league_private.ssl_preseason_game_reports r
      where r.season_id=target_season),'[]'::jsonb);
  end if;
  if target_match is null or target_match !~ '^R[1-4]-[1-6]$' then
    raise exception 'Select a valid preseason bracket match';
  end if;
  perform pg_advisory_xact_lock(hashtext(target_season::text));
  pair:=league_private.ssl_preseason_pair(target_season,target_match);
  if pair is null then
    raise exception 'This matchup is not ready. Release the previous round first.';
  end if;
  a:=(pair->>'team_a')::uuid;b:=(pair->>'team_b')::uuid;
  select * into saved from league_private.ssl_preseason_game_reports
    where season_id=target_season and match_key=target_match for update;

  if operation='release' then
    if not found then raise exception 'Upload and save a private report first';end if;
    if saved.released_at is not null then raise exception 'This match has already been released';end if;
    if saved.team_a<>a or saved.team_b<>b then
      raise exception 'The current official bracket pairing has changed. Re-import the report.';
    end if;
    round_no:=substring(target_match from 2 for 1)::integer;
    if exists(select 1 from public.ssl_preseason_results r where r.season_id=target_season
        and substring(r.match_key from 2 for 1)::integer>round_no) then
      raise exception 'Later rounds are already released; correction needs commissioner review';
    end if;
    if exists(select 1 from public.ssl_preseason_results r
      where r.season_id=target_season and r.match_key=target_match) then
      raise exception 'This bracket result is already public. A second release is blocked.';
    end if;
    insert into public.ssl_preseason_results
      (season_id,match_key,team_a,team_b,score_a,score_b)
      values(target_season,target_match,a,b,saved.score_a,saved.score_b);
    update league_private.ssl_preseason_game_reports
      set released_at=now() where season_id=target_season and match_key=target_match;
    return jsonb_build_object('released',true,'matchKey',target_match);
  elsif operation<>'save' then
    raise exception 'Unknown preseason report operation';
  end if;

  if jsonb_typeof(game_report) is distinct from 'object' or
     jsonb_typeof(game_report->'players') is distinct from 'array' or
     jsonb_array_length(game_report->'players')<18 or
     jsonb_array_length(game_report->'players')>50 or
     pg_column_size(game_report)>350000 then
    raise exception 'A complete Project Rio box score with 18 or more players is required';
  end if;
  if saved.released_at is not null then
    raise exception 'This game is public and cannot be silently overwritten';
  end if;
  if game_report->>'matchKey' is distinct from target_match or
     game_report->>'teamA' is distinct from a::text or
     game_report->>'teamB' is distinct from b::text then
    raise exception 'Uploaded report does not match this bracket pairing';
  end if;
  if game_report->>'scoreA' is null or game_report->>'scoreB' is null or
     (game_report->>'scoreA') !~ '^[0-9]{1,3}$' or
     (game_report->>'scoreB') !~ '^[0-9]{1,3}$' then
    raise exception 'Invalid final score';
  end if;
  score_a:=(game_report->>'scoreA')::numeric;
  score_b:=(game_report->>'scoreB')::numeric;
  if score_a=score_b then raise exception 'Preseason games cannot end in a tie';end if;
  -- Enforce unique participating player identities and correctly matched teams.
  select count(*),count(distinct p.value->>'player'),
    count(*) filter (where p.value->>'team'=a::text),
    count(*) filter (where p.value->>'team'=b::text),
    coalesce(sum(coalesce((p.value->'stats'->>'runs')::numeric,0))
       filter(where p.value->>'team'=a::text),0),
    coalesce(sum(coalesce((p.value->'stats'->>'runs')::numeric,0))
       filter(where p.value->>'team'=b::text),0)
    into all_rows,unique_players,a_rows,b_rows,score_a,score_b
    from jsonb_array_elements(game_report->'players') p;
  if all_rows<>unique_players or a_rows<9 or b_rows<9 or
    all_rows<>a_rows+b_rows or
    score_a<>(game_report->>'scoreA')::numeric or
    score_b<>(game_report->>'scoreB')::numeric then
    raise exception 'Player teams, unique identities or final runs do not match the sheet';
  end if;
  winner:=case when score_a>score_b then a else b end;
  select (p.value->>'team')::uuid into mvp_team
    from jsonb_array_elements(game_report->'players') p
    where coalesce((p.value->'stats'->>'mvps')::integer,0)=1;
  if mvp_team is distinct from winner or
    (select count(*) from jsonb_array_elements(game_report->'players') p
     where coalesce((p.value->'stats'->>'mvps')::integer,0)=1)<>1 then
    raise exception 'The MVP must be exactly one player on the winning team';
  end if;
  insert into league_private.ssl_preseason_game_reports
    (season_id,match_key,team_a,team_b,score_a,score_b,report,filename,fingerprint)
    values(target_season,target_match,a,b,score_a::int,score_b::int,
      game_report,left(coalesce(game_report->>'filename','Project Rio report'),240),
      left(coalesce(game_report->>'fingerprint',''),128))
    on conflict(season_id,match_key) do update
    set team_a=excluded.team_a,team_b=excluded.team_b,
      score_a=excluded.score_a,score_b=excluded.score_b,
      report=excluded.report,filename=excluded.filename,
      fingerprint=excluded.fingerprint,saved_at=now()
    where league_private.ssl_preseason_game_reports.released_at is null;
  return jsonb_build_object('saved',true,'matchKey',target_match,'public',false);
end;
$fn$;
revoke all on function public.ssl_preseason_report_action(uuid,text,text,jsonb) from public,anon;
grant execute on function public.ssl_preseason_report_action(uuid,text,text,jsonb) to authenticated;
