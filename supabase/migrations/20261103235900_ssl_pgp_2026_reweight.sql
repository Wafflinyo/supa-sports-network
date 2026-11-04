-- Replace only the server-side SSL scoring coefficients and shutout allocation.
-- Preserve commissioner-only authorization, all existing season data and report locking.
-- The server independently validates each newly imported player score and the
-- 40-point team shutout distribution; no saved games are modified.
DO $pgp_reweight$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN
    RAISE EXCEPTION 'Cannot locate SSL result verifier';
  END IF;
  IF strpos(definition,'4000.0*outs/total_outs')>0
     AND strpos(definition,'rn<=4000-allocated')>0
     AND strpos(definition,'+ 20*coalesce((score_row->''stats''->>''completeGames'')')>0
    THEN RETURN; END IF;
  IF strpos(definition,'3000.0*outs/total_outs')=0
    OR strpos(definition,'rn<=3000-allocated')=0
    OR strpos(definition,'coalesce((score_row->>''shutoutBonus'')::numeric,0)>30')=0
    OR strpos(definition,'30 Game Points must be split')=0
    OR strpos(definition,'+ (2.0/3)*coalesce((score_row->''stats''->>''outs'')::numeric,0)')=0
    OR strpos(definition,'+ 8*coalesce((score_row->''stats''->>''completeGames'')::numeric,0)')=0
    OR strpos(definition,'- 10*coalesce((score_row->''stats''->>''hrAllowed'')::numeric,0)')=0
    THEN RAISE EXCEPTION 'SSL score verifier has changed; refusing unsafe patch'; END IF;
  definition:=replace(definition,'3000.0*outs/total_outs','4000.0*outs/total_outs');
  definition:=replace(definition,'rn<=3000-allocated','rn<=4000-allocated');
  definition:=replace(definition,
    'coalesce((score_row->>''shutoutBonus'')::numeric,0)>30',
    'coalesce((score_row->>''shutoutBonus'')::numeric,0)>40');
  definition:=replace(definition,'30 Game Points must be split',
    '40 Game Points must be split');
  definition:=replace(definition,
    '+ (2.0/3)*coalesce((score_row->''stats''->>''outs'')::numeric,0)',
    '+ 1*coalesce((score_row->''stats''->>''outs'')::numeric,0)');
  definition:=replace(definition,
    '+ 8*coalesce((score_row->''stats''->>''completeGames'')::numeric,0)',
    '+ 20*coalesce((score_row->''stats''->>''completeGames'')::numeric,0)');
  definition:=replace(definition,
    '- 10*coalesce((score_row->''stats''->>''hrAllowed'')::numeric,0)',
    '- 8*coalesce((score_row->''stats''->>''hrAllowed'')::numeric,0)');
  EXECUTE definition;
END $pgp_reweight$;
