-- Update ONLY the score verification in the existing SSL result-upload wrapper.
-- No season state, draft, game result, roster, fantasy or trade data is rewritten.
-- Keep the existing commissioner authorization and prior trade dispatch intact.
DO $migration$
DECLARE
  definition text;
  needle text;
  replacement text;
  guard_needle text;
  guard_replacement text;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  needle := $piece$+ 15*coalesce((score_row->'stats'->>'pitchStrikeouts')::numeric,0)$piece$;
  replacement := $piece$+ 15*coalesce((score_row->'stats'->>'pitchStrikeouts')::numeric,0)
       + 3*coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)
       - 3*coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)
       + 5*coalesce((score_row->'stats'->>'completeGames')::numeric,0)
       - 10*coalesce((score_row->'stats'->>'hrAllowed')::numeric,0)
       + 10*coalesce((score_row->'stats'->>'mvps')::numeric,0)$piece$;
  IF strpos(definition,needle)=0 OR
     strpos(substr(definition,strpos(definition,needle)+length(needle)),needle)>0
    THEN RAISE EXCEPTION 'Expected unique official SSL strikeout weight in result verifier'; END IF;
  definition := replace(definition,needle,replacement);

  guard_needle := $piece$     calculated := greatest(0,round($piece$;
  guard_replacement := $piece$     -- Validate the manually recorded scoreless full innings and CG flag.
     -- The aggregate Project Rio sheet does not report inning-by-inning scoring.
     IF coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)<0
       OR coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)
          <> trunc(coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0))
       OR coalesce((score_row->'stats'->>'scorelessInnings')::numeric,0)>
          floor(coalesce((score_row->'stats'->>'outs')::numeric,0)/3)
       OR coalesce((score_row->'stats'->>'completeGames')::numeric,0) NOT IN (0,1)
       OR coalesce((score_row->'stats'->>'mvps')::numeric,0) NOT IN (0,1)
       THEN RAISE EXCEPTION 'Invalid scoreless-innings, complete-game or MVP scoring input'; END IF;
     calculated := greatest(0,round($piece$;
  IF strpos(definition,guard_needle)=0 OR
     strpos(substr(definition,strpos(definition,guard_needle)+length(guard_needle)),guard_needle)>0
    THEN RAISE EXCEPTION 'Expected unique SSL scoring calculation block'; END IF;
  definition := replace(definition,guard_needle,guard_replacement);
  EXECUTE definition;
END $migration$;