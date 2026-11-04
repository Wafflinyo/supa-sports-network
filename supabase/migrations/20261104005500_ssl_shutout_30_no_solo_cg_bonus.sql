-- Rebalance SSL shutouts to +30 per winning shutout, shared proportional to
-- pitching outs. A solo shutout still counts as a complete game in player stats,
-- but does not also award +20 complete-game Game Points.
-- Preserve commissioner permissions, game locking and saved game data.
DO $ssl_shutout_no_double_credit$
DECLARE
  definition text;
  old_cg constant text := $cg$
       + 20*coalesce((score_row->'stats'->>'completeGames')::numeric,0)$cg$;
  new_cg constant text := $cg_new$
       + CASE WHEN coalesce((score_row->>'shutoutBonus')::numeric,0)=30
           THEN 0
           ELSE 20*coalesce((score_row->'stats'->>'completeGames')::numeric,0)
         END$cg_new$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'SSL report verifier not found'; END IF;
  IF strpos(definition,'rn<=3000-allocated')>0
    AND strpos(definition,'THEN 0' || chr(10) || '           ELSE 20*coalesce((score_row->''stats''->>''completeGames'')::numeric,0)')>0
    THEN RETURN; END IF;
  IF strpos(definition,'4000.0*outs/total_outs')=0
    OR strpos(definition,'rn<=4000-allocated')=0
    OR strpos(definition,'coalesce((score_row->>''shutoutBonus'')::numeric,0)>40')=0
    OR strpos(definition,'40 Game Points must be split')=0
    OR strpos(definition,old_cg)=0
    OR strpos(definition,'+ 0.25*coalesce((score_row->''stats''->>''pitches'')::numeric,0)')=0
    OR strpos(definition,'THEN 12-2*coalesce((score_row->''stats''->>''earnedRuns'')::numeric,0)')=0
    THEN RAISE EXCEPTION 'SSL result verifier changed; refusing unsafe shutout rebalance'; END IF;
  definition:=replace(definition,'4000.0*outs/total_outs','3000.0*outs/total_outs');
  definition:=replace(definition,'rn<=4000-allocated','rn<=3000-allocated');
  definition:=replace(definition,
    'coalesce((score_row->>''shutoutBonus'')::numeric,0)>40',
    'coalesce((score_row->>''shutoutBonus'')::numeric,0)>30');
  definition:=replace(definition,'40 Game Points must be split','30 Game Points must be split');
  definition:=replace(definition,old_cg,new_cg);
  EXECUTE definition;
END $ssl_shutout_no_double_credit$;