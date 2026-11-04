-- Add nonstacking 3+ IP earned-run performance tiers to verified Game Score.
-- This only patches the formula used for future commissioner-uploaded reports.
-- It preserves access checks, saved results, game locking and the +40 shutout rule.
DO $earned_run_tier$
DECLARE
  definition text;
  score_anchor constant text := $anchor$calculated := round(
       (score_row->>'itemScore')::numeric
       + coalesce((score_row->>'shutoutBonus')::numeric,0)$anchor$;
  added_scoring constant text := $added$calculated := round(
       (score_row->>'itemScore')::numeric
       + coalesce((score_row->>'shutoutBonus')::numeric,0)
       + CASE WHEN coalesce((score_row->'stats'->>'outs')::numeric,0)>=9
               AND coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)
                   IN (0,1,2,3)
              THEN 12-2*coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)
              ELSE 0 END$added$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN
    RAISE EXCEPTION 'SSL result verifier not found';
  END IF;
  IF strpos(definition,'THEN 12-2*coalesce((score_row->''stats''->>''earnedRuns'')::numeric,0)')>0 THEN
    RETURN;
  END IF;
  IF strpos(definition,score_anchor)=0
     OR strpos(definition,'+ 1*coalesce((score_row->''stats''->>''outs'')::numeric,0)')=0
     OR strpos(definition,'+ 20*coalesce((score_row->''stats''->>''completeGames'')::numeric,0)')=0
     OR strpos(definition,'4000.0*outs/total_outs')=0 THEN
    RAISE EXCEPTION 'SSL result verifier has changed; refusing unsafe PGP patch';
  END IF;
  definition:=replace(definition,score_anchor,added_scoring);
  EXECUTE definition;
END $earned_run_tier$;
