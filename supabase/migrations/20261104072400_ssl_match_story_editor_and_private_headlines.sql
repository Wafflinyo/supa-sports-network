-- Commissioner-supplied narrative facts for game headlines.
-- Project Rio contains final counts, not inning-scoring progression.
-- Stored game story remains embargoed alongside an unreleased result.
CREATE OR REPLACE FUNCTION public.ssl_game_story_save(
  target_season uuid,target_game uuid,story jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE access jsonb; current league_private.ssl_season_states;
  g jsonb; idx int; lead_count int; ending text; note text;
BEGIN
  access:=league_private.current_access();
  IF auth.uid() IS NULL OR access->>'role' IS DISTINCT FROM 'commissioner'
    THEN RAISE EXCEPTION 'Commissioner access required'; END IF;
  IF story IS NULL OR jsonb_typeof(story)<>'object'
    THEN RAISE EXCEPTION 'A structured game story is required'; END IF;
  IF story ? 'leadChanges' AND
    (jsonb_typeof(story->'leadChanges')<>'number' OR
     (story->>'leadChanges')!~ '^[0-9]{1,2}$')
    THEN RAISE EXCEPTION 'Lead changes must be a whole number from 0 to 20'; END IF;
  lead_count:=COALESCE((story->>'leadChanges')::int,0);
  IF lead_count NOT BETWEEN 0 AND 20
    THEN RAISE EXCEPTION 'Lead changes must be between 0 and 20'; END IF;
  ending:=COALESCE(story->>'lateFinish','none');
  IF ending NOT IN ('none','walkoff','late-comeback')
    THEN RAISE EXCEPTION 'Choose a valid game ending'; END IF;
  note:=trim(COALESCE(story->>'note',''));
  IF char_length(note)>240 THEN RAISE EXCEPTION 'Game story note cannot exceed 240 characters'; END IF;
  PERFORM pg_advisory_xact_lock(736114221);
  SELECT * INTO current FROM league_private.ssl_season_states
    WHERE id=target_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF current.state->>'status'='archived'
    THEN RAISE EXCEPTION 'Completed season is archived'; END IF;
  SELECT value,ordinality::int-1 INTO g,idx
    FROM jsonb_array_elements(COALESCE(current.state->'games','[]'::jsonb))
      WITH ORDINALITY WHERE value->>'id'=target_game::text;
  IF g IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g->>'stage' NOT IN ('recorded','final')
    THEN RAISE EXCEPTION 'Upload a game report before confirming its story'; END IF;
  g:=jsonb_set(g,'{story}',jsonb_build_object(
    'leadChanges',lead_count,'lateFinish',ending,'note',note));
  UPDATE league_private.ssl_season_states SET state=jsonb_set(current.state,
    ARRAY['games',idx::text],g) WHERE id=target_season;
  INSERT INTO league_private.ssl_actions(season,actor,operation)
    VALUES(target_season,auth.uid(),'save_game_story');
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.ssl_game_story_save(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ssl_game_story_save(uuid,uuid,jsonb) TO authenticated,service_role;

-- Private stories must not reveal embargoed walk-offs or late game results.
DO $privacy$
DECLARE old_def text; new_def text;
BEGIN
  old_def:=pg_get_functiondef('league_private.ssl_read_before_stars()'::regprocedure);
  IF position('g:=g-''result'';' in old_def)=0 THEN
    IF position('g:=g-''result''-''story'';' in old_def)>0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected private result filter has changed: review before patching';
  END IF;
  new_def:=replace(old_def,'g:=g-''result'';','g:=g-''result''-''story'';');
  EXECUTE new_def;
END
$privacy$;
