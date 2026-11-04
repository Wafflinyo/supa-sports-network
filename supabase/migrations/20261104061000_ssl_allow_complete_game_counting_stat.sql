-- Project Rio upload saves integer counting stats, including the official
-- complete-games stat. The backend used completeGames for Game Score but
-- accidentally rejected it from its allowed counting stats list.
DO $fix$
DECLARE old_definition text; modified text;
BEGIN
  old_definition:=pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
  IF position('''starBases'',''mvps''];' in old_definition)=0 THEN
    IF position('''starBases'',''mvps'',''completeGames''];' in old_definition)>0
      THEN RETURN; END IF;
    RAISE EXCEPTION 'Cannot find exact safe complete-games whitelist anchor';
  END IF;
  modified:=replace(old_definition,
    '''starBases'',''mvps''];',
    '''starBases'',''mvps'',''completeGames''];');
  EXECUTE modified;
END $fix$;
