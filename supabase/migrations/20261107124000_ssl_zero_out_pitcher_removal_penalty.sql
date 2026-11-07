-- SSL official PGP: -10 when a pitcher who ACTUALLY threw pitches/faced
-- batters finishes with 0 defensive outs AND is relieved by a subsequent
-- same-team pitcher. Client parses Pitching worksheet row order and stores
-- integer stats.zeroOutRemoval=1; it remains 0 for unused pitchers and for
-- zero-out appearances not followed by another same-team pitcher.
--
-- Preserve the full authorization/commissioner checks of ssl_manage by
-- patching only its official saved Game Score validator expression. Historical
-- report stats don't preserve the source Pitching worksheet appearance order,
-- so do not retrospectively guess who was replaced.
DO $validate_zero_out_removal$
DECLARE
  ddl text;
  old_term constant text:=$old$       - 2*coalesce((score_row->'stats'->>'beanBalls')::numeric,0)$old$;
  new_term constant text:=$new$       - 2*coalesce((score_row->'stats'->>'beanBalls')::numeric,0)
       - 10*coalesce((score_row->'stats'->>'zeroOutRemoval')::numeric,0)$new$;
BEGIN
  ddl:=pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure);
  IF ddl IS NULL THEN
    RAISE EXCEPTION 'Protected SSL game-result validator is missing';
  END IF;
  IF strpos(ddl,new_term)>0 THEN RETURN; END IF;
  IF (length(ddl)-length(replace(ddl,old_term,'')))<>length(old_term) THEN
    RAISE EXCEPTION 'Unexpected official pitching score formula: refusing patch';
  END IF;
  IF strpos(ddl,$s$+ 0.25*coalesce((score_row->'stats'->>'pitches')::numeric,0)$s$)=0
     OR strpos(ddl,$s$- 3*coalesce((score_row->'stats'->>'earnedRuns')::numeric,0)$s$)=0
  THEN
    RAISE EXCEPTION 'Other official pitching weights changed unexpectedly';
  END IF;
  EXECUTE replace(ddl,old_term,new_term);
END $validate_zero_out_removal$;
