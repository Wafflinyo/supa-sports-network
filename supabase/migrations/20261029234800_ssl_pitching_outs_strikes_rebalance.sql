-- Modify only the existing SSL result Game Score verifier, preserving its
-- original commissioner authorization, action handlers and security definer.
-- No season, draft, lineup, trade, fantasy or saved game results are modified.
DO $migration$
DECLARE
  definition text;
  old_weights text := $old_weights$+ 15*coalesce((score_row->'stats'->>'pitchStrikeouts')::numeric,0)
       + 3*coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)
       - 3*coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)
       + 5*coalesce((score_row->'stats'->>'completeGames')::numeric,0)
       - 10*coalesce((score_row->'stats'->>'hrAllowed')::numeric,0)
       + 10*coalesce((score_row->'stats'->>'mvps')::numeric,0)$old_weights$;
  new_weights text := $new_weights$+ 15*coalesce((score_row->'stats'->>'pitchStrikeouts')::numeric,0)
       + (2.0/3)*coalesce((score_row->'stats'->>'outs')::numeric,0)
       + 0.5*coalesce((score_row->'stats'->>'strikes')::numeric,0)
       - 3*coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)
       + 8*coalesce((score_row->'stats'->>'completeGames')::numeric,0)
       - 10*coalesce((score_row->'stats'->>'hrAllowed')::numeric,0)
       + 10*coalesce((score_row->'stats'->>'mvps')::numeric,0)$new_weights$;
  old_guard text := $old_guard$-- Validate the manually recorded scoreless full innings and CG flag.
     -- The aggregate Project Rio sheet does not report inning-by-inning scoring.
     IF coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)<0
       OR coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)
          <> trunc(coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0))
       OR coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)>
          floor(coalesce((score_row->'stats'->>'outs')::numeric,0)/3)
       OR coalesce((score_row->'stats'->>'completeGames')::numeric,0) NOT IN (0,1)
       OR coalesce((score_row->'stats'->>'mvps')::numeric,0) NOT IN (0,1)
       THEN RAISE EXCEPTION 'Invalid scoreless-innings, complete-game or MVP scoring input'; END IF;$old_guard$;
  new_guard text := $new_guard$-- Pitching IP counts three outs per inning; strike totals come from Rio.
     -- Validate raw outs and strikes as nonnegative integers.
     IF coalesce((score_row->'stats'->>'outs')::numeric,0)<0
       OR coalesce((score_row->'stats'->>'outs')::numeric,0)
          <> trunc(coalesce((score_row->'stats'->>'outs')::numeric,0))
       OR coalesce((score_row->'stats'->>'strikes')::numeric,0)<0
       OR coalesce((score_row->'stats'->>'strikes')::numeric,0)
          <> trunc(coalesce((score_row->'stats'->>'strikes')::numeric,0))
       OR coalesce((score_row->'stats'->>'completeGames')::numeric,0) NOT IN (0,1)
       OR coalesce((score_row->'stats'->>'mvps')::numeric,0) NOT IN (0,1)
       THEN RAISE EXCEPTION 'Invalid outs, strikes, complete-game or MVP scoring input'; END IF;$new_guard$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL OR strpos(definition, old_weights) = 0
    OR strpos(substr(definition, strpos(definition,old_weights)+length(old_weights)),old_weights)>0
    THEN RAISE EXCEPTION 'SSL pitching Game Score verifier changed: refusing to patch old weights'; END IF;
  IF strpos(definition,old_guard)=0
    OR strpos(substr(definition,strpos(definition,old_guard)+length(old_guard)),old_guard)>0
    THEN RAISE EXCEPTION 'SSL pitching Game Score verifier changed: refusing to patch old validation'; END IF;
  definition := replace(replace(definition,old_weights,new_weights),old_guard,new_guard);
  EXECUTE definition;
END $migration$;
