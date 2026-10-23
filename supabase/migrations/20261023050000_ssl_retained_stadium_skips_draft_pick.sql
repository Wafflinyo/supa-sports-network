-- A successful one-season Stadium extension carries the Stadium into the new season.
-- Such a franchise receives all eleven tradable player picks, but NO Stadium Pick.
-- Without an extended Stadium it retains the nontradable Stadium Pick as usual.
--
-- Idempotent because the same change may have been applied to the remote database
-- before this repository migration was checked in.

DO $stadium_retention$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('league_private.ssl_next_pick(jsonb,integer)'::regprocedure);
 IF position($marker$if r=12 and jsonb_array_length(coalesce(st->'retainedStadiums'->tid,'[]'::jsonb))>0 then$marker$ in definition)=0 THEN
   IF position('if r=12 then' in definition)=0 OR
      position('''stageAlreadyChosen'',exists(' in definition)=0 THEN
     RAISE EXCEPTION 'Unexpected Stadium draft function; review before changing';
   END IF;
   definition:=replace(definition,'if r=12 then',
    $replacement$if r=12 and jsonb_array_length(coalesce(st->'retainedStadiums'->tid,'[]'::jsonb))>0 then
       c:=c+1;
       continue;
     end if;
     if r=12 then$replacement$);
   definition:=replace(definition,
      '''stageAlreadyChosen'',exists(',
      $replacement$'stadiumRetained',
           jsonb_array_length(coalesce(st->'retainedStadiums'->owner_id,'[]'::jsonb))>0,
       'stageAlreadyChosen',
           jsonb_array_length(coalesce(st->'retainedStadiums'->owner_id,'[]'::jsonb))>0
           or exists($replacement$);
   definition:=replace(definition,
      $original$'mustStage',
       not exists($original$,
      $replacement$'mustStage',
       jsonb_array_length(coalesce(st->'retainedStadiums'->owner_id,'[]'::jsonb))=0
       and not exists($replacement$);
   EXECUTE definition;
 END IF;

 definition:=pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
 IF position('This team already made its one stage selection' in definition)>0 THEN
   definition:=replace(definition,
    'This team already made its one stage selection',
    'This team has already selected or retained its Stadium');
   definition:=replace(definition,
    'This is your final available turn: you must select a stage',
    'This is your final available turn: you must select a Stadium');
   EXECUTE definition;
 END IF;
END $stadium_retention$;
