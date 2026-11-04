-- Award +0.25 for each pitch thrown in the official SSL Game Score.
-- Keep the +0.5 strike bonus, earned-run outing tiers, existing shutout
-- allocation, commissioner auth and all saved results unchanged.
DO $pitch_count_pgp$
DECLARE
  definition text;
  strike_score_anchor constant text := $score_anchor$
       + 0.5*coalesce((score_row->'stats'->>'strikes')::numeric,0)$score_anchor$;
  pitches_score text := $pitch_add$
       + 0.5*coalesce((score_row->'stats'->>'strikes')::numeric,0)
       + 0.25*coalesce((score_row->'stats'->>'pitches')::numeric,0)$pitch_add$;
  guard_anchor constant text := $guard$
       OR coalesce((score_row->'stats'->>'completeGames')::numeric,0) NOT IN (0,1)$guard$;
  guard_added text := $guard_new$
       OR coalesce((score_row->'stats'->>'pitches')::numeric,0)<0
       OR coalesce((score_row->'stats'->>'pitches')::numeric,0)
          <> trunc(coalesce((score_row->'stats'->>'pitches')::numeric,0))
       OR coalesce((score_row->'stats'->>'completeGames')::numeric,0) NOT IN (0,1)$guard_new$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN
    RAISE EXCEPTION 'SSL scoring verifier is missing';
  END IF;
  IF strpos(definition,'+ 0.25*coalesce((score_row->''stats''->>''pitches'')::numeric,0)')>0
     AND strpos(definition,'<> trunc(coalesce((score_row->''stats''->>''pitches'')::numeric,0))')>0
    THEN RETURN; END IF;
  IF strpos(definition,strike_score_anchor)=0
     OR strpos(definition,guard_anchor)=0
     OR strpos(definition,'THEN 12-2*coalesce((score_row->''stats''->>''earnedRuns'')::numeric,0)')=0
     OR strpos(definition,'4000.0*outs/total_outs')=0
     THEN RAISE EXCEPTION 'SSL score verifier changed; refusing unsafe pitch-count patch'; END IF;
  definition:=replace(definition,strike_score_anchor,pitches_score);
  definition:=replace(definition,guard_anchor,guard_added);
  EXECUTE definition;
END $pitch_count_pgp$;
