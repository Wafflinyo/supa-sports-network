-- Add an independently verified +30 point pitching shutout award to the
-- existing Project Rio result verifier. Never trust client-supplied allocations.
-- Preserve commissioner authorization, report locking, trading and state data.
DO $shutout_migration$
DECLARE
  definition text;
  declaration_anchor constant text := 'score_row jsonb;calculated numeric;begin';
  score_anchor constant text := $anchor$calculated := round(
       (score_row->>'itemScore')::numeric$anchor$;
  validation_sql constant text := $shutout_validator$
     -- Reconstruct the exact cents-weighted shutout distribution from this
     -- report's runs and recorded pitching outs (three outs per inning).
     -- Only a team winning with zero runs allowed receives the award.
     WITH raw AS (
       SELECT p.value->>'player' AS player_id,
              p.value->>'team' AS team_id,
              coalesce((p.value->'stats'->>'outs')::numeric,0) AS outs,
              coalesce((p.value->'stats'->>'runs')::numeric,0) AS runs
       FROM jsonb_array_elements(payload->'report'->'players') AS p(value)
     ), team_runs AS (
       SELECT team_id, sum(runs) AS scored FROM raw GROUP BY team_id
     ), pitchers AS (
       SELECT r.player_id,r.team_id,r.outs,
         sum(r.outs) OVER(PARTITION BY r.team_id) AS total_outs
       FROM raw r
       JOIN team_runs tr ON tr.team_id=r.team_id
       WHERE r.outs>0 AND tr.scored>0
         AND (SELECT count(*) FROM team_runs)=2
         AND (SELECT sum(opp.scored) FROM team_runs opp
              WHERE opp.team_id<>r.team_id)=0
     ), exact AS (
       SELECT player_id,team_id,outs,
         floor(3000.0*outs/total_outs) AS whole_cents,
         3000.0*outs/total_outs-floor(3000.0*outs/total_outs) AS fraction
       FROM pitchers
     ), ranked AS (
       SELECT player_id,team_id,outs,whole_cents,
         row_number() OVER(PARTITION BY team_id
           ORDER BY fraction DESC,outs DESC,player_id::integer ASC) AS rn,
         sum(whole_cents) OVER(PARTITION BY team_id) AS allocated
       FROM exact
     )
     SELECT coalesce((SELECT
          (whole_cents+CASE WHEN rn<=3000-allocated THEN 1 ELSE 0 END)/100.0
         FROM ranked WHERE player_id=score_row->>'player'),0)
       INTO shutout_expected;
     IF score_row ? 'shutoutBonus'
        AND jsonb_typeof(score_row->'shutoutBonus') IS DISTINCT FROM 'number'
       THEN RAISE EXCEPTION 'Shutout bonus must be a number'; END IF;
     IF coalesce((score_row->>'shutoutBonus')::numeric,0)<0
        OR coalesce((score_row->>'shutoutBonus')::numeric,0)>30
        OR trunc(coalesce((score_row->>'shutoutBonus')::numeric,0)*100)
              <> coalesce((score_row->>'shutoutBonus')::numeric,0)*100
        OR coalesce((score_row->>'shutoutBonus')::numeric,0)<>shutout_expected
       THEN RAISE EXCEPTION 'Incorrect pitching shutout bonus: 30 Game Points must be split by recorded outs for the winning shutout team'; END IF;
  $shutout_validator$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF position('shutout_expected numeric' IN definition)>0 THEN RETURN; END IF;
  IF position(declaration_anchor IN definition)=0 OR position(score_anchor IN definition)=0 THEN
    RAISE EXCEPTION 'SSL result verifier changed: cannot safely install shutout scoring';
  END IF;
  definition:=replace(definition,declaration_anchor,
    'score_row jsonb;calculated numeric;shutout_expected numeric;begin');
  definition:=replace(definition,score_anchor,validation_sql||E'\n'||
    $new_score$calculated := round(
       (score_row->>'itemScore')::numeric
       + coalesce((score_row->>'shutoutBonus')::numeric,0)$new_score$);
  EXECUTE definition;
END $shutout_migration$;
