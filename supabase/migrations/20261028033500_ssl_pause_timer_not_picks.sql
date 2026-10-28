-- SSL: pause the PICK TIMER, not the draft itself.
-- Changes ONLY the currently deployed league_private.ssl_manage_core definition.
-- The source function signature, owner, security definer, rights and all
-- remaining commissioner/GM selection validations are retained.
-- The current season's order, picks, rosters and pick clock state are untouched.
DO $pause_timer_migration$
DECLARE
  source_definition text;
  next_definition text;
  old_guard text := $old_guard$if st->>'status'<>'drafting' or (st->>'paused')::boolean then raise exception 'Draft is not open or is paused';end if;$old_guard$;
  new_guard text := $new_guard$if st->>'status'<>'drafting' then raise exception 'Draft is not open';end if;$new_guard$;
  old_seconds text := $old_seconds$seconds:=coalesce((st->>'pickElapsed')::numeric,0)+greatest(0,extract(epoch from now()-(st->>'pickStartedAt')::timestamptz));$old_seconds$;
  new_seconds text := $new_seconds$seconds:=coalesce((st->>'pickElapsed')::numeric,0)+case when coalesce((st->>'paused')::boolean,false) then 0 else greatest(0,extract(epoch from now()-(st->>'pickStartedAt')::timestamptz)) end;$new_seconds$;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure)
    INTO source_definition;
  IF source_definition IS NULL THEN RAISE EXCEPTION 'SSL draft server function missing'; END IF;
  IF (length(source_definition)-length(replace(source_definition,old_guard,''))) / length(old_guard) <> 1 THEN
    RAISE EXCEPTION 'Unexpected draft selection guard; refusing to change the live draft function';
  END IF;
  IF (length(source_definition)-length(replace(source_definition,old_seconds,''))) / length(old_seconds) <> 1 THEN
    RAISE EXCEPTION 'Unexpected pick time formula; refusing to change the live draft function';
  END IF;
  IF position('elsif op=''pause'' then' in source_definition)=0 THEN
    RAISE EXCEPTION 'Cannot locate existing commissioner clock toggle';
  END IF;

  next_definition := replace(source_definition,old_guard,new_guard);
  next_definition := replace(next_definition,old_seconds,new_seconds);
  -- CREATE OR REPLACE preserves function OID, owner and EXECUTE privileges.
  EXECUTE next_definition;
END;
$pause_timer_migration$;
