-- Retain the submission method of each game lineup without changing the
-- existing authorization, game lineup, draft, or preseason storage.
-- The core manager already validates commissioner/GM permissions, matchup
-- ownership, lineup contents, and game lock state before this hook runs.
DO $lineup_provenance$
DECLARE
  definition text;
  anchor constant text:='answer:=league_private.ssl_manage_before_stars(op,target,payload);';
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF position('lineupSubmission' IN definition)>0 THEN
    RETURN;
  END IF;
  IF position(anchor IN definition)=0 THEN
    RAISE EXCEPTION 'Cannot locate approved ssl_manage delegation to insert lineup provenance';
  END IF;
  EXECUTE replace(definition,anchor,anchor||$lineup_audit$
  -- Explicit game lineup save. Unlike start_game, this code runs only for
  -- validated game_lineup actions. Automatic fallback never creates this audit.
  if op='game_lineup' then
    select state into st
    from league_private.ssl_season_states where id=target for update;
    select value,ordinality::int-1 into g,idx
      from jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) with ordinality
      where value->>'id'=payload->>'game';
    if a->>'role'='commissioner' then
      team:=(payload->>'team')::uuid;
    else
      select id into team from league_private.ssl_franchises
        where slot=(a->>'slot')::int;
    end if;
    if g is null or team is null or team::text not in(g->>'away',g->>'home') then
      raise exception 'Submitted game lineup identity missing';
    end if;
    g:=g||jsonb_build_object('lineupSubmission',
      coalesce(g->'lineupSubmission','{}'::jsonb)||
      jsonb_build_object(team::text,jsonb_build_object(
        'source',case when coalesce((payload->>'useDefault')::boolean,false) then 'default' else 'custom' end,
        'by',case when a->>'role'='commissioner' then 'commissioner' else 'gm' end,
        'at',now()
      )));
    st:=jsonb_set(st,array['games',idx::text],g);
    update league_private.ssl_season_states set state=st where id=target;
  end if;
$lineup_audit$);
END
$lineup_provenance$;
