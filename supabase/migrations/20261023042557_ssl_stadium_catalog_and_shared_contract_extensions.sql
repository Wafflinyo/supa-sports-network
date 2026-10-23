
-- Exactly the thirteen SSL stadiums are available to every team's nontradable stadium selection.
DO $patch$
DECLARE def text;
BEGIN
 def := pg_get_functiondef('league_private.ssl_manage_core(text,uuid,jsonb)'::regprocedure);
 IF position('''Bowser Castle''' IN def) = 0 OR position('''Karting Stadium''' IN def)=0 THEN
   RAISE EXCEPTION 'Unexpected draft stadium validator; unchanged';
 END IF;
 def := replace(def, '''Bowser Castle''', '''Bowser’s Castle''');
 def := replace(def, '''Bowser Jr. Playroom''', '''Bowser Jr’s Playroom''');
 def := replace(def, '''Luigi''''s Mansion''', '''Luigi’s Mansion''');
 def := replace(def, '''Cascade Kingdom''', '''Cascade Kingdom Stadium''');
 def := replace(def, '''Karting Stadium''', '''Mario Karting Stadium''');
 EXECUTE def;
END $patch$;

CREATE TABLE IF NOT EXISTS league_private.ssl_stadium_extension_history (
 franchise uuid NOT NULL REFERENCES league_private.ssl_franchises(id),
 stadium text NOT NULL,
 accepted integer NOT NULL DEFAULT 0 CHECK (accepted >= 0),
 PRIMARY KEY (franchise, stadium)
);
CREATE TABLE IF NOT EXISTS league_private.ssl_stadium_extensions (
 season_number integer NOT NULL,
 franchise uuid NOT NULL REFERENCES league_private.ssl_franchises(id),
 stadium text NOT NULL,
 PRIMARY KEY (season_number, franchise, stadium)
);
CREATE TABLE IF NOT EXISTS league_private.ssl_stadium_extension_offers (
 attempt bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 season uuid NOT NULL REFERENCES league_private.ssl_season_states(id),
 franchise uuid NOT NULL REFERENCES league_private.ssl_franchises(id),
 stadium text NOT NULL,
 chance integer NOT NULL CHECK (chance BETWEEN 0 AND 100),
 roll integer NOT NULL CHECK (roll BETWEEN 1 AND 100),
 accepted boolean NOT NULL,
 breakdown jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ssl_stadium_extension_offers_by_season
 ON league_private.ssl_stadium_extension_offers(season, franchise);

CREATE OR REPLACE FUNCTION league_private.ssl_stadium_extension_preview(target uuid, franchise uuid, chosen text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE a jsonb:=league_private.current_access();s league_private.ssl_season_states;f uuid;n integer;
BEGIN
 IF auth.uid() IS NULL OR coalesce(a->>'role','') NOT IN ('commissioner','gm') THEN
   RAISE EXCEPTION 'GM or commissioner access required';
 END IF;
 SELECT id INTO f FROM league_private.ssl_franchises WHERE slot=(a->>'slot')::int;
 IF a->>'role'<>'commissioner' AND franchise IS DISTINCT FROM f THEN
   RAISE EXCEPTION 'Choose your own franchise';
 END IF;
 PERFORM league_private.ssl_tick(target);
 SELECT * INTO s FROM league_private.ssl_season_states WHERE id=target;
 IF s.id IS NULL OR NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(coalesce(s.state->'teams','[]'::jsonb)) t
   WHERE t->>'id'=franchise::text
 ) THEN RAISE EXCEPTION 'Choose a season franchise'; END IF;
 IF coalesce(chosen,'')='' OR NOT (
    EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(s.state->'picks','[]'::jsonb)) p
            WHERE p->>'kind'='stage' AND p->>'team'=franchise::text AND p->>'stage'=chosen)
    OR coalesce(s.state->'retainedStadiums'->(franchise::text),'[]'::jsonb) @> jsonb_build_array(chosen)
 ) THEN
   RAISE EXCEPTION 'Choose a stadium belonging to this franchise';
 END IF;
 SELECT coalesce(h.accepted,0) INTO n
 FROM league_private.ssl_stadium_extension_history h
 WHERE h.franchise=ssl_stadium_extension_preview.franchise AND h.stadium=chosen;
 RETURN league_private.ssl_extension_quote(s.state,franchise,coalesce(n,0))
  || jsonb_build_object('contracts',(SELECT tokens FROM league_private.ssl_franchises WHERE id=franchise));
END $body$;
REVOKE ALL ON FUNCTION league_private.ssl_stadium_extension_preview(uuid,uuid,text) FROM public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.ssl_stadium_extension_preview(season uuid, team uuid, stadium text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$
 SELECT league_private.ssl_stadium_extension_preview(season,team,stadium)
$body$;
REVOKE ALL ON FUNCTION public.ssl_stadium_extension_preview(uuid,uuid,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.ssl_stadium_extension_preview(uuid,uuid,text) TO authenticated;
GRANT USAGE ON SCHEMA league_private TO authenticated;
GRANT EXECUTE ON FUNCTION league_private.ssl_stadium_extension_preview(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION league_private.ssl_stadium_extension_apply(target uuid, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE a jsonb:=league_private.current_access();s league_private.ssl_season_states;
f uuid;team uuid;chosen text;quote jsonb;n integer;dice integer;accepted_offer boolean;
BEGIN
 IF auth.uid() IS NULL OR coalesce(a->>'role','') NOT IN ('commissioner','gm') THEN
   RAISE EXCEPTION 'GM or commissioner access required';
 END IF;
 PERFORM pg_advisory_xact_lock(736114221);
 PERFORM league_private.ssl_tick(target);
 SELECT * INTO s FROM league_private.ssl_season_states WHERE id=target FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Season not found'; END IF;
 SELECT id INTO f FROM league_private.ssl_franchises WHERE slot=(a->>'slot')::int;
 team:=CASE WHEN a->>'role'='commissioner' THEN (payload->>'team')::uuid ELSE f END;
 chosen:=payload->>'stadium';
 IF s.state->>'status'<>'retention' OR NOT coalesce((s.state->>'extensionsOpen')::boolean,false) THEN
  RAISE EXCEPTION 'The extension window is closed';
 END IF;
 quote:=league_private.ssl_stadium_extension_preview(target,team,chosen);
 IF payload->>'quoteFingerprint' IS DISTINCT FROM quote->>'fingerprint' THEN
  RAISE EXCEPTION 'Acceptance odds changed. Review the updated chance before applying';
 END IF;
 IF EXISTS(
  SELECT 1 FROM league_private.ssl_stadium_extensions e
  WHERE e.season_number=s.number+1 AND e.franchise=team AND e.stadium=chosen
 ) THEN RAISE EXCEPTION 'This stadium already signed an extension'; END IF;
 UPDATE league_private.ssl_franchises SET tokens=tokens-1 WHERE id=team AND tokens>0;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'No unused extension contracts'; END IF;
 dice:=floor(random()*100)+1;
 accepted_offer:=dice<=(quote->>'total')::int;
 INSERT INTO league_private.ssl_stadium_extension_offers(season,franchise,stadium,chance,roll,accepted,breakdown)
 VALUES(target,team,chosen,(quote->>'total')::int,dice,accepted_offer,quote);
 IF accepted_offer THEN
  INSERT INTO league_private.ssl_stadium_extension_history(franchise,stadium,accepted)
  VALUES(team,chosen,1)
  ON CONFLICT(franchise,stadium) DO UPDATE
   SET accepted=league_private.ssl_stadium_extension_history.accepted+1;
  INSERT INTO league_private.ssl_stadium_extensions(season_number,franchise,stadium)
  VALUES(s.number+1,team,chosen) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO league_private.ssl_actions(season,actor,operation,details)
 VALUES(target,auth.uid(),'extension_stadium',
 jsonb_build_object('team',team,'stadium',chosen,'chance',quote->'total','accepted',accepted_offer));
 PERFORM league_private.ssl_tick(target);
 RETURN jsonb_build_object('ok',true,'accepted',accepted_offer,'quote',quote,
 'remaining',(SELECT tokens FROM league_private.ssl_franchises WHERE id=team));
END $body$;
REVOKE ALL ON FUNCTION league_private.ssl_stadium_extension_apply(uuid,jsonb) FROM public,anon,authenticated;

-- The existing read endpoint returns stadium offers alongside player offers.
DO $patch$
DECLARE def text;
BEGIN
 def:=pg_get_functiondef('league_private.ssl_read_contracts()'::regprocedure);
 IF position('''extensionHistory'',' IN def)=0 THEN
   RAISE EXCEPTION 'Unexpected extension history read format';
 END IF;
 def:=replace(def,'''extensionHistory'',',
 $replace$'stadiumExtensionOffers',(select coalesce(jsonb_agg(
  jsonb_build_object('attempt',o.attempt,'franchise',o.franchise,
   'stadium',o.stadium,'chance',o.chance,'roll',o.roll,'accepted',o.accepted,
   'breakdown',o.breakdown)
  ORDER BY o.attempt),'[]'::jsonb)
  from league_private.ssl_stadium_extension_offers o WHERE o.season=s.id),
  'extensionHistory',$replace$);
 EXECUTE def;
END $patch$;

-- Extend existing management entrypoint without replacing its other season logic.
DO $patch$
DECLARE def text;
BEGIN
 def:=pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure);
 IF position('if op in(''extension'',''void_extensions'') then' IN def)=0
  OR position('if op=''extension'' then perform league_private.ssl_tick(target);end if;' IN def)=0 THEN
   RAISE EXCEPTION 'Unexpected ssl_manage wrapper; no changes applied';
 END IF;
 def:=replace(def,
  'if op in(''extension'',''void_extensions'') then',
  $replace$if op='extension_stadium' then
    return league_private.ssl_stadium_extension_apply(target,payload);
  end if;
  if op in('extension','void_extensions') then$replace$);
 def:=replace(def,
  'if op=''extension'' then perform league_private.ssl_tick(target);end if;',
  $replace$if op='create' and answer ? 'id' then
    update league_private.ssl_season_states s set state=s.state ||
    jsonb_build_object('retainedStadiums',(
      select coalesce(jsonb_object_agg(franchise::text,stadiums),'{}'::jsonb)
      from (select e.franchise,jsonb_agg(e.stadium ORDER BY e.stadium) as stadiums
       from league_private.ssl_stadium_extensions e
       WHERE e.season_number=s.number GROUP BY e.franchise) q))
    where s.id=(answer->>'id')::uuid;
  end if;
  if op='extension' then perform league_private.ssl_tick(target);end if;$replace$);
 EXECUTE def;
END $patch$;
