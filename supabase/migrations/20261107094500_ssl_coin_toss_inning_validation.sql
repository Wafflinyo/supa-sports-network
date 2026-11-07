-- Project Rio may put the scheduled HOME team in the TOP batting half,
-- because Mario Super Sluggers uses a coin toss. Keep the SSL schedule
-- away/home identities for rosters and scoring, but accept the in-game
-- top/bottom batting order when validating inning-by-inning scorecards.
--
-- In the incoming JSON:
--   away: score array of scheduled AWAY club
--   home: score array of scheduled HOME club
--   top: 'away' or 'home' (optional; legacy exports default to 'away')
-- Only the coin-toss BOTTOM club can have null/X in the final inning.
CREATE OR REPLACE FUNCTION league_private.ssl_validate_game_innings(
  lines jsonb, away_runs integer, home_runs integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  count_innings integer;
  i integer;
  away_inning jsonb;
  home_inning jsonb;
  top_side text;
  away_total integer:=0;
  home_total integer:=0;
BEGIN
  IF lines IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(lines)<>'object'
     OR jsonb_typeof(lines->'away') IS DISTINCT FROM 'array'
     OR jsonb_typeof(lines->'home') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'Invalid Game Info line score: expected away/home inning arrays';
  END IF;
  top_side:=coalesce(lines->>'top','away');
  IF top_side NOT IN ('away','home') THEN
    RAISE EXCEPTION 'Invalid Game Info batting order: top must be scheduled away or scheduled home';
  END IF;
  count_innings:=jsonb_array_length(lines->'away');
  IF count_innings<3 OR count_innings>20
     OR jsonb_array_length(lines->'home')<>count_innings
  THEN
    RAISE EXCEPTION 'Invalid Game Info inning count';
  END IF;
  FOR i IN 0..count_innings-1 LOOP
    away_inning:=lines->'away'->i;
    home_inning:=lines->'home'->i;

    -- The scheduled AWAY team may have batted BOTTOM after the coin toss.
    IF jsonb_typeof(away_inning)='null'
       AND i=count_innings-1 AND top_side='home'
    THEN
      NULL; -- An explicit X in the skipped bottom-half of the final inning.
    ELSE
      IF jsonb_typeof(away_inning)<>'number'
         OR away_inning::text!~'^[0-9]{1,2}$'
         OR (away_inning::text)::integer>99
      THEN
        RAISE EXCEPTION 'Invalid scheduled away-team runs in inning %',i+1;
      END IF;
      away_total:=away_total+(away_inning::text)::integer;
    END IF;

    -- The scheduled HOME team may have batted BOTTOM instead.
    IF jsonb_typeof(home_inning)='null'
       AND i=count_innings-1 AND top_side='away'
    THEN
      NULL;
    ELSE
      IF jsonb_typeof(home_inning)<>'number'
         OR home_inning::text!~'^[0-9]{1,2}$'
         OR (home_inning::text)::integer>99
      THEN
        RAISE EXCEPTION 'Invalid scheduled home-team runs in inning %',i+1;
      END IF;
      home_total:=home_total+(home_inning::text)::integer;
    END IF;
  END LOOP;
  IF away_total<>away_runs OR home_total<>home_runs THEN
    RAISE EXCEPTION 'Game Info inning totals (%) / (%) do not match player runs (%) / (%)',
      away_total,home_total,away_runs,home_runs;
  END IF;
  RETURN true;
END $function$;
