-- Credit +1 official RBI (worth +8 OGP/TGP) for every recorded
-- sacrifice fly. Project Rio's RBI column can exclude sacrifice-fly RBIs.
-- The frontend now normalizes raw Rio counts *once* on import.
-- This idempotent historical backfill aligns stored score sheets with
-- the new import behavior, including the public preseason compact view.
-- No actual baseball runs, inning scorecards, pitching, defense, MVP awards,
-- roster allocations or published/unpublished visibility are changed.
DO $credit_sacrifice_fly_rbis$
DECLARE
  season_row record;
  pre record;
  game_row jsonb;
  player_row jsonb;
  compact_row jsonb;
  compact_values jsonb;
  new_games jsonb;
  new_players jsonb;
  new_compact_players jsonb;
  compact_report jsonb;
  sf numeric;
  current_rbi numeric;
  score numeric;
  item numeric;
  rbi_key text;
  sf_key text;
  revision constant text := 'rbi_sac_fly_plus_one_20261107';
BEGIN
  -- Saved regular-season/postseason official player stat lines.
  FOR season_row IN
    SELECT id,state FROM league_private.ssl_season_states FOR UPDATE
  LOOP
    new_games:='[]'::jsonb;
    FOR game_row IN
      SELECT value FROM jsonb_array_elements(coalesce(season_row.state->'games','[]'::jsonb))
    LOOP
      IF jsonb_typeof(game_row->'result'->'players')='array'
         AND coalesce(game_row->'result'->>'sslSacFlyRbiRevision','')<>revision
      THEN
        new_players:='[]'::jsonb;
        FOR player_row IN
          SELECT value FROM jsonb_array_elements(game_row->'result'->'players')
        LOOP
          IF jsonb_typeof(player_row->'stats')='object' THEN
            sf:=coalesce((player_row->'stats'->>'sacFlys')::numeric,0);
            IF sf>0 THEN
              current_rbi:=coalesce((player_row->'stats'->>'rbi')::numeric,0);
              player_row:=jsonb_set(player_row,'{stats,rbi}',to_jsonb(current_rbi+sf),true);
              IF player_row ? 'gameScore' THEN
                score:=round((player_row->>'gameScore')::numeric+8*sf,2);
                item:=coalesce((player_row->>'itemScore')::numeric,0);
                player_row:=player_row||jsonb_build_object(
                  'gameScore',score,'baseGameScore',round(score-item,2));
              END IF;
            END IF;
          END IF;
          new_players:=new_players||jsonb_build_array(player_row);
        END LOOP;
        game_row:=jsonb_set(game_row,'{result}',game_row->'result'||
          jsonb_build_object('players',new_players,'sslSacFlyRbiRevision',revision));
      END IF;
      new_games:=new_games||jsonb_build_array(game_row);
    END LOOP;
    IF new_games IS DISTINCT FROM season_row.state->'games' THEN
      UPDATE league_private.ssl_season_states
        SET state=jsonb_set(season_row.state,'{games}',new_games)
        WHERE id=season_row.id;
    END IF;
  END LOOP;

  -- Saved preseason uploads have BOTH the full player report and the compact
  -- numbered-column export which feeds public preseason tables and box scores.
  -- Mutating only report.players would leave the website showing stale RBI.
  FOR pre IN
    SELECT season_id,match_key,report
    FROM league_private.ssl_preseason_game_reports FOR UPDATE
  LOOP
    IF jsonb_typeof(pre.report->'players')<>'array'
      OR coalesce(pre.report->>'sslSacFlyRbiRevision','')=revision
    THEN CONTINUE; END IF;

    new_players:='[]'::jsonb;
    FOR player_row IN SELECT value FROM jsonb_array_elements(pre.report->'players')
    LOOP
      IF jsonb_typeof(player_row->'stats')='object' THEN
        sf:=coalesce((player_row->'stats'->>'sacFlys')::numeric,0);
        IF sf>0 THEN
          current_rbi:=coalesce((player_row->'stats'->>'rbi')::numeric,0);
          player_row:=jsonb_set(player_row,'{stats,rbi}',to_jsonb(current_rbi+sf),true);
          IF player_row ? 'gameScore' THEN
            score:=round((player_row->>'gameScore')::numeric+8*sf,2);
            item:=coalesce((player_row->>'itemScore')::numeric,0);
            player_row:=player_row||jsonb_build_object(
              'gameScore',score,'baseGameScore',round(score-item,2));
          END IF;
        END IF;
      END IF;
      new_players:=new_players||jsonb_build_array(player_row);
    END LOOP;

    compact_report:=pre.report->'compact';
    IF jsonb_typeof(compact_report->'players')='array' THEN
      SELECT (ordinality::int-1)::text INTO rbi_key
        FROM jsonb_array_elements_text(compact_report->'fields') WITH ORDINALITY f(field,ordinality)
        WHERE field='rbi';
      SELECT (ordinality::int-1)::text INTO sf_key
        FROM jsonb_array_elements_text(compact_report->'fields') WITH ORDINALITY f(field,ordinality)
        WHERE field='sacFlys';
      IF rbi_key IS NULL OR sf_key IS NULL THEN
        RAISE EXCEPTION 'Missing RBI or Sac Fly field in preseason match %',pre.match_key;
      END IF;
      new_compact_players:='[]'::jsonb;
      FOR compact_row IN SELECT value FROM jsonb_array_elements(compact_report->'players')
      LOOP
        compact_values:=compact_row->3;
        IF jsonb_typeof(compact_values)='object' THEN
          sf:=coalesce((compact_values->>sf_key)::numeric,0);
          IF sf>0 THEN
            current_rbi:=coalesce((compact_values->>rbi_key)::numeric,0);
            compact_values:=jsonb_set(compact_values,array[rbi_key],to_jsonb(current_rbi+sf),true);
            compact_row:=jsonb_set(compact_row,'{3}',compact_values);
          END IF;
        END IF;
        new_compact_players:=new_compact_players||jsonb_build_array(compact_row);
      END LOOP;
      compact_report:=jsonb_set(compact_report,'{players}',new_compact_players);
    END IF;

    UPDATE league_private.ssl_preseason_game_reports
      SET report=pre.report||jsonb_build_object(
        'players',new_players,
        'compact',compact_report,
        'sslSacFlyRbiRevision',revision)
      WHERE season_id=pre.season_id AND match_key=pre.match_key;
  END LOOP;
END $credit_sacrifice_fly_rbis$;
