-- Permit negative signed SSL custom Game Scores; preserve every stored result, draft and trade.
-- Use exact-match guarded source replacement so the existing commissioner security logic is unchanged.
DO $migration$
DECLARE
  definition text;
  old_guard text := $guard$or (score_row->>'gameScore')::numeric < 0$guard$;
  old_start text := 'calculated := greatest(0,round(';
  old_end text := $ending$,2));
     if abs((score_row->>'gameScore')$ending$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL
    OR strpos(definition,old_guard)=0
    OR strpos(definition,old_start)=0
    OR strpos(definition,old_end)=0
    OR strpos(substr(definition,strpos(definition,old_guard)+length(old_guard)),old_guard)>0
    OR strpos(substr(definition,strpos(definition,old_start)+length(old_start)),old_start)>0
    OR strpos(substr(definition,strpos(definition,old_end)+length(old_end)),old_end)>0
    THEN RAISE EXCEPTION 'Unexpected SSL report verifier; negative Game Score patch aborted'; END IF;
  definition:=replace(definition,old_guard,'false');
  definition:=replace(definition,old_start,'calculated := round(');
  definition:=replace(definition,old_end,$ending$,2);
     if abs((score_row->>'gameScore')$ending$);
  EXECUTE definition;
END $migration$;
