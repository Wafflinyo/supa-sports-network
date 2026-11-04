-- SSL date-free weekly season workflow.
-- Seasons progress Draft -> Preseason -> Regular -> Postseason, then the
-- finished season is archived and a NEW season opens in Offseason.
-- Database statuses and report publication remain server-authoritative.

DO $migration$
DECLARE f record; definition text;
BEGIN
  -- Use the existing deployed functions as the source of truth; retain their
  -- authorization, scoring, roster, draft, contracts and trade safeguards.
  FOR f IN SELECT p.oid,p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('league_private','public') AND p.prosrc LIKE '%postdraft%'
    ORDER BY n.nspname,p.proname
  LOOP
    definition:=replace(pg_get_functiondef(f.oid),'postdraft','preseason');
    IF f.proname='ssl_manage_core' THEN
      IF position('Set a game time' IN definition)=0
        THEN RAISE EXCEPTION 'Expected match-time guard is missing'; END IF;
      definition:=replace(definition,
        $old$if (payload->>'startsAt')::timestamptz is null then raise exception 'Set a game time';end if;$old$,
        $new$-- Matchups and Project Rio reports are independent of dates.$new$);
      -- Keep the freshly opened next season in Offseason during preparation.
      -- Team selection and draft scheduling must work there.
      definition:=replace(definition,
        $old$st->>'status' not in ('setup','poll')$old$,
        $new$st->>'status' not in ('setup','poll','offseason')$new$);
      definition:=replace(definition,
        $old$st->>'status' not in ('setup','poll','scheduled')$old$,
        $new$st->>'status' not in ('setup','poll','scheduled','offseason')$new$);
    END IF;
    IF f.proname='ssl_manage_before_stars' THEN
      -- Result release is a commissioner-confirmed event, not a clock event.
      definition:=replace(definition,
        $old$ or now()<(g->>'startsAt')::timestamptz$old$, '');
      -- Awards are still possible after the automatic switch to Postseason.
      definition:=replace(definition,
        $old$st->>'status'<>'regular' or jsonb_array_length(coalesce(st->'finalStandings'$old$,
        $new$st->>'status' not in ('regular','postseason') or jsonb_array_length(coalesce(st->'finalStandings'$new$);
      definition:=replace(definition,
        $old$st->>'status'<>'regular' then raise exception 'Finish the regular season before the awards ceremony'$old$,
        $new$st->>'status' not in ('regular','postseason') then raise exception 'Finish the regular season before the awards ceremony'$new$);
      definition:=replace(definition,
        $old$if st->>'status'<>'postseason' then raise exception 'Open the postseason first';end if;$old$,
        $new$if st->>'status'<>'postseason' then raise exception 'Open the postseason first';end if;
  if not coalesce((st->>'awardsComplete')::boolean,false) then raise exception 'Complete the season awards ceremony before starting playoffs';end if;$new$);
    END IF;
    EXECUTE definition;
  END LOOP;

  -- Existing completed drafts enter the real Preseason stage.
  UPDATE league_private.ssl_season_states
  SET state=jsonb_set(state,'{status}',to_jsonb('preseason'::text))
  WHERE state->>'status'='postdraft';
END $migration$;

CREATE OR REPLACE FUNCTION league_private.ssl_tick_contracts(target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE s league_private.ssl_season_states;
  st jsonb;t jsonb;r jsonb:='{}';new_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(736114221);
  PERFORM league_private.ssl_tick_draft(target);
  SELECT * INTO s FROM league_private.ssl_season_states WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  st:=s.state;
  -- The last released Week 12 result, not a calendar deadline, closes trades.
  IF st->>'status' IN ('regular','postseason')
      AND (SELECT count(*) FROM jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) g
           WHERE g->>'phase'='regular' AND g->>'week'='12')=6
      AND NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(st->'games') g
        WHERE g->>'phase'='regular' AND g->>'week'='12'
          AND g->>'stage'<>'final') THEN
    IF coalesce((st->>'tradingOpen')::boolean,false) THEN
      st:=st||jsonb_build_object('tradingOpen',false,'extensionsOpen',false);
      UPDATE league_private.ssl_offers SET status='expired'
        WHERE season=target AND status IN('pending','ready');
    END IF;
  END IF;
  -- Keep the championship extension window; its completion creates the new
  -- season's Offseason, archives the old season, and carries retained players.
  IF st->>'status'='retention' AND st->>'championshipEndedAt' IS NOT NULL THEN
    st:=st||jsonb_build_object('extensionsOpen',true);
    IF now()>=coalesce((st->>'extensionClosesAt')::timestamptz,'infinity'::timestamptz)
       OR NOT EXISTS(
        SELECT 1 FROM league_private.ssl_franchises f
        JOIN jsonb_array_elements(st->'teams') tm ON tm->>'id'=f.id::text
        WHERE f.tokens>0) THEN
      FOR t IN SELECT value FROM jsonb_array_elements(st->'teams') LOOP
        r:=jsonb_set(r,ARRAY[t->>'id'],
          (SELECT coalesce(jsonb_agg(e.player),'[]'::jsonb)
           FROM league_private.ssl_extensions e
           WHERE e.season_number=s.number+1 AND e.franchise=(t->>'id')::uuid));
      END LOOP;
      UPDATE league_private.ssl_franchises SET tokens=0
        WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(st->'teams'));
      st:=st||jsonb_build_object('status','offseason',
        'extensionsOpen',false,'tradingOpen',true,'offseasonAt',now(),
        'completedRosters',st->'rosters','completedDefaults',st->'defaults',
        'rosters',r,'defaults','{}'::jsonb,'needsDefault','[]'::jsonb);
      INSERT INTO league_private.ssl_actions(season,operation)
        VALUES(target,'extension_period_closed');
    END IF;
  END IF;
  IF coalesce((st->>'offseasonTrading')::boolean,false)
      AND st->>'status'='drafting' THEN
    st:=st||jsonb_build_object('offseasonTrading',false,'tradingOpen',false);
    UPDATE league_private.ssl_offers SET status='expired'
      WHERE season=target AND status IN('pending','ready');
  END IF;
  IF st IS DISTINCT FROM s.state THEN
    UPDATE league_private.ssl_season_states SET state=st WHERE id=target;
  END IF;

  IF st->>'status'='offseason'
    AND NOT EXISTS(SELECT 1 FROM league_private.ssl_season_states
                   WHERE number=s.number+1) THEN
    -- Make the prior season immutable for SSL History. Offseason is stored
    -- solely on the NEW season, with retained players and future draft picks.
    new_number:=s.number+1;
    UPDATE league_private.ssl_season_states SET state=st||
      jsonb_build_object('status','archived','archivedAt',now(),
       'offseasonRosterSnapshot',st->'rosters',
       'rosters',coalesce(st->'completedRosters',st->'rosters'),
       'defaults',coalesce(st->'completedDefaults','{}'::jsonb),
       'archivedPickAssets',(
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id',a.id,'season',a.season_number,
            'originalTeam',a.original_team,'round',a.round,'owner',a.owner)),
          '[]'::jsonb)
          FROM league_private.ssl_pick_assets a
          WHERE a.season_number=new_number),
       'archivedBalances',(
          SELECT coalesce(jsonb_agg(jsonb_build_object('team',f.id,'tokens',f.tokens)),
                         '[]'::jsonb)
          FROM league_private.ssl_franchises f))
    WHERE id=target;
    UPDATE league_private.ssl_offers SET status='expired'
      WHERE season=target AND status IN('pending','ready');
    INSERT INTO league_private.ssl_season_states(number,name,state)
      VALUES(new_number,'Season '||new_number,
        jsonb_build_object('status','offseason',
          'teams',st->'teams','conferencesSet',st->'conferencesSet',
          'order','[]'::jsonb,'picks','[]'::jsonb,
          'rosters',st->'rosters','defaults','{}'::jsonb,'needsDefault','[]'::jsonb,
          'games','[]'::jsonb,'schedulePublished',false,
          'tradingOpen',true,'offseasonTrading',true,
          'paused',false,'pickElapsed',0))
      ON CONFLICT(number) DO NOTHING;
    INSERT INTO league_private.ssl_actions(season,operation)
      VALUES(target,'archive_for_next_season');
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION league_private.ssl_tick(target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE st jsonb;g jsonb;arr jsonb:='[]';
  ranking jsonb;champions jsonb;qualified jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(736114221);
  PERFORM league_private.ssl_tick_contracts(target);
  SELECT state INTO st FROM league_private.ssl_season_states WHERE id=target FOR UPDATE;
  IF st IS NULL THEN RETURN; END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(coalesce(st->'games','[]'::jsonb)) LOOP
    IF g->>'stage'='recorded' AND NOT coalesce((g->>'postponed')::boolean,false)
      AND g->>'releaseAt' IS NOT NULL
      AND now()>=(g->>'releaseAt')::timestamptz THEN
      g:=g||jsonb_build_object('stage','final','releasedAt',now());
    END IF;
    arr:=arr||jsonb_build_array(g);
  END LOOP;
  st:=st||jsonb_build_object('games',arr,
    'playoffSeries',league_private.ssl_series(st||jsonb_build_object('games',arr)));

  -- Release of the championship in the 11-match preseason bracket, with a
  -- complete 12-team schedule and valid defaults, starts the regular season.
  IF st->>'status'='preseason'
    AND coalesce((st->>'schedulePublished')::boolean,false)
    AND (SELECT count(*) FROM public.ssl_preseason_results WHERE season_id=target)=11
    AND EXISTS(SELECT 1 FROM public.ssl_preseason_results
               WHERE season_id=target AND match_key='R4-1')
    AND (SELECT count(*) FROM jsonb_array_elements(arr)
         WHERE value->>'phase'='regular')=132
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(st->'teams') t
      WHERE NOT league_private.ssl_valid_lineup(st,t->>'id',st->'defaults'->(t->>'id')))
  THEN
    st:=st||jsonb_build_object('status','regular','regularStartedAt',now());
  END IF;

  -- A complete public 132-game slate advances directly into Postseason.
  IF st->>'status' IN('regular','postseason')
    AND (SELECT count(*) FROM jsonb_array_elements(arr)
         WHERE value->>'phase'='regular')=132
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(arr)
                   WHERE value->>'phase'='regular' AND value->>'stage'<>'final')
  THEN
    ranking:=league_private.ssl_rankings(st);
    SELECT coalesce(jsonb_object_agg(conference,id),'{}'::jsonb)
      INTO champions FROM (
        SELECT DISTINCT ON(t->>'conference') t->>'conference' conference,t->>'id' id
        FROM jsonb_array_elements(st->'teams') t
        JOIN jsonb_array_elements(ranking) r ON r->>'id'=t->>'id'
        WHERE t->>'conference' IN('supa','galaxy')
        ORDER BY t->>'conference',(r->>'rank')::int
      ) q;
    SELECT coalesce(jsonb_agg(r.value->'id' ORDER BY (r.value->>'rank')::int),'[]'::jsonb)
      INTO qualified FROM jsonb_array_elements(ranking) r(value)
      WHERE (r.value->>'rank')::int<=8;
    st:=st||jsonb_build_object('finalStandings',ranking,
      'conferenceChampions',champions,'playoffTeams',qualified,'status','postseason');
  END IF;
  UPDATE league_private.ssl_season_states SET state=st
    WHERE id=target AND state IS DISTINCT FROM st;
END $function$;

-- Promote an already-finished preseason (such as SSL Season 1) without
-- adding dates or rewriting any reported scores.
SELECT league_private.ssl_tick(id)
  FROM league_private.ssl_season_states WHERE state->>'status'='preseason';
