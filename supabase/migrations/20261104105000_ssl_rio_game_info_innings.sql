-- Persist a verified inning-by-inning line score from the Project Rio
-- Game Info worksheet in each recorded/private and released/public result.
-- This is optional for older uploads, but strict if a line score is supplied.
CREATE OR REPLACE FUNCTION league_private.ssl_validate_game_innings(
  lines jsonb,away_runs integer,home_runs integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $validator$
DECLARE count_innings integer;i integer;a jsonb;b jsonb;
  away_total integer:=0;home_total integer:=0;
BEGIN
  IF lines IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(lines)<>'object' OR
      jsonb_typeof(lines->'away') IS DISTINCT FROM 'array' OR
      jsonb_typeof(lines->'home') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid Game Info line score: expected away/home inning arrays'; END IF;
  count_innings:=jsonb_array_length(lines->'away');
  IF count_innings<3 OR count_innings>20 OR
    jsonb_array_length(lines->'home')<>count_innings THEN
    RAISE EXCEPTION 'Invalid Game Info inning count'; END IF;
  FOR i IN 0..count_innings-1 LOOP
    a:=lines->'away'->i;b:=lines->'home'->i;
    IF jsonb_typeof(a)<>'number' OR a::text!~'^[0-9]{1,2}$'
        OR (a::text)::integer>99 THEN
      RAISE EXCEPTION 'Invalid away-team runs in inning %',i+1;END IF;
    away_total:=away_total+(a::text)::integer;
    IF jsonb_typeof(b)='null' AND i=count_innings-1 THEN
      CONTINUE;END IF;
    IF jsonb_typeof(b)<>'number' OR b::text!~'^[0-9]{1,2}$'
        OR (b::text)::integer>99 THEN
      RAISE EXCEPTION 'Invalid home-team runs in inning %',i+1;END IF;
    home_total:=home_total+(b::text)::integer;
  END LOOP;
  IF away_total<>away_runs OR home_total<>home_runs THEN
    RAISE EXCEPTION 'Game Info inning totals (%) / (%) do not match player runs (%) / (%)',
      away_total,home_total,away_runs,home_runs;
  END IF;
  RETURN true;
END $validator$;
REVOKE ALL ON FUNCTION league_private.ssl_validate_game_innings(jsonb,integer,integer) FROM PUBLIC,anon;

DO $migration$
DECLARE old_def text;new_def text;
  insertion text:='g:=g||jsonb_build_object(''stage'',''final'',''result'',jsonb_build_object(';
BEGIN
  old_def:=pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
  IF position('''players'',arr,''scores'',ids,''postedAt'',now()' IN old_def)=0 THEN
    IF position('''players'',arr,''scores'',ids,''innings'',entry->''innings'',''postedAt'',now()' IN old_def)>0
      THEN RETURN; END IF;
    RAISE EXCEPTION 'SSL result persistence changed; cannot safely patch inning storage';
  END IF;
  IF position(insertion IN old_def)=0 THEN
    RAISE EXCEPTION 'SSL result builder changed; cannot safely patch inning validation';
  END IF;
  new_def:=replace(old_def,insertion,
    'PERFORM league_private.ssl_validate_game_innings(entry->''innings'',(ids->>(g->>''away''))::integer,(ids->>(g->>''home''))::integer);'
    ||E'\n  '||insertion);
  new_def:=replace(new_def,
    '''players'',arr,''scores'',ids,''postedAt'',now()',
    '''players'',arr,''scores'',ids,''innings'',entry->''innings'',''postedAt'',now()');
  EXECUTE new_def;
END $migration$;
