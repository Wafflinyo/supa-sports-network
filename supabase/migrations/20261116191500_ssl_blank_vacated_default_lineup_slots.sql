-- Remove departed players from current default lineups without changing batting-order slots.
-- Incoming acquisitions remain unassigned until their GM resubmits a valid default.
-- Completed/saved game lineups and historical results are never touched.
CREATE OR REPLACE FUNCTION league_private.ssl_reconcile_default_lineup_rosters(snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path TO ''
AS $reconcile$
DECLARE
  cleaned jsonb := snapshot;
  current_roster jsonb;
  lineup jsonb;
  clean_starters jsonb;
  clean_bench jsonb;
  team_id text;
BEGIN
  IF pg_catalog.jsonb_typeof(snapshot->'defaults') IS DISTINCT FROM 'object'
     OR pg_catalog.jsonb_typeof(snapshot->'rosters') IS DISTINCT FROM 'object' THEN
    RETURN snapshot;
  END IF;
  FOR team_id, lineup IN
    SELECT key, value FROM pg_catalog.jsonb_each(snapshot->'defaults')
  LOOP
    IF pg_catalog.jsonb_typeof(lineup) IS DISTINCT FROM 'object' THEN
      CONTINUE;
    END IF;
    current_roster := COALESCE(snapshot->'rosters'->team_id, '[]'::jsonb);
    IF pg_catalog.jsonb_typeof(current_roster) IS DISTINCT FROM 'array' THEN
      CONTINUE;
    END IF;
    -- Leave vacant starters at their original batting-order and defensive positions.
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        CASE
          WHEN pg_catalog.jsonb_typeof(slot.item) = 'object'
            AND slot.item ? 'player'
            AND NOT (current_roster @> pg_catalog.jsonb_build_array(slot.item->'player'))
          THEN pg_catalog.jsonb_set(slot.item,'{player}','null'::jsonb)
          ELSE slot.item
        END ORDER BY slot.ord),
      '[]'::jsonb)
    INTO clean_starters
    FROM pg_catalog.jsonb_array_elements(
      COALESCE(lineup->'starters','[]'::jsonb)
    ) WITH ORDINALITY AS slot(item,ord);
    -- Bench players who departed are no longer shown as belonging to this team.
    SELECT COALESCE(pg_catalog.jsonb_agg(slot.item ORDER BY slot.ord),'[]'::jsonb)
    INTO clean_bench
    FROM pg_catalog.jsonb_array_elements(
      COALESCE(lineup->'bench','[]'::jsonb)
    ) WITH ORDINALITY AS slot(item,ord)
    WHERE current_roster @> pg_catalog.jsonb_build_array(slot.item);
    IF clean_starters IS DISTINCT FROM lineup->'starters'
       OR clean_bench IS DISTINCT FROM lineup->'bench' THEN
      cleaned := pg_catalog.jsonb_set(
        cleaned, ARRAY['defaults',team_id],
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(lineup,'{starters}',clean_starters),
          '{bench}',clean_bench));
    END IF;
  END LOOP;
  RETURN cleaned;
END;
$reconcile$;

CREATE OR REPLACE FUNCTION league_private.ssl_clear_departed_default_lineup_slots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $trigger$
BEGIN
  NEW.state := league_private.ssl_reconcile_default_lineup_rosters(NEW.state);
  RETURN NEW;
END;
$trigger$;

DROP TRIGGER IF EXISTS ssl_clear_departed_default_lineup_slots
  ON league_private.ssl_season_states;
CREATE TRIGGER ssl_clear_departed_default_lineup_slots
BEFORE UPDATE OF state ON league_private.ssl_season_states
FOR EACH ROW
WHEN (OLD.state->'rosters' IS DISTINCT FROM NEW.state->'rosters')
EXECUTE FUNCTION league_private.ssl_clear_departed_default_lineup_slots();

-- One-time correction for already-approved trades in the active season.
-- Preserve completed-game snapshots; modify only the default lineup records.
UPDATE league_private.ssl_season_states
SET state = league_private.ssl_reconcile_default_lineup_rosters(state)
WHERE state->>'status' <> 'archived'
  AND state IS DISTINCT FROM league_private.ssl_reconcile_default_lineup_rosters(state);
