-- Keep the Stadium-selection validator consistent with labels shown across the site.
-- This changes only user-visible wording, not draft eligibility.
DO $stadium_label$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
  IF position('Choose an available stadium for your stage selection' IN definition)>0 THEN
    definition := replace(definition,
      'Choose an available stadium for your stage selection',
      'Choose a Stadium from the official Stadium list');
    EXECUTE definition;
  ELSIF position('Choose a Stadium from the official Stadium list' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected Stadium selection validator; no changes made';
  END IF;
END $stadium_label$;
