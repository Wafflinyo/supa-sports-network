-- Official SSL baserunning scoring: +4 OGP per stolen base, -4 per
-- caught stealing. TGP uses the same score; no fantasy scoring changes.
-- Safely patch the protected commissioner upload validator in place and
-- update all saved regular-season and preseason scores from source stats.
DO $server_scoring$
DECLARE
  ddl text;
  old_term constant text := $old$       + 4*coalesce((score_row->'stats'->>'totalBases')::numeric,0)$old$;
  new_term constant text := $new$       + 4*coalesce((score_row->'stats'->>'totalBases')::numeric,0)
       + 4*coalesce((score_row->'stats'->>'stolenBases')::numeric,0)
       - 4*coalesce((score_row->'stats'->>'caughtStealing')::numeric,0)$new$;
BEGIN
  ddl:=pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure);
  IF ddl IS NULL THEN RAISE EXCEPTION 'Protected SSL scoring validator is missing'; END IF;
  IF strpos(ddl,new_term)>0 THEN RETURN; END IF;
  IF (length(ddl)-length(replace(ddl,old_term,'')))<>length(old_term)
    OR strpos(ddl,'- 10*coalesce((score_row->''stats''->>''batStrikeouts'')::numeric,0)')=0
    OR strpos(ddl,'+ 15*coalesce((score_row->''stats''->>''homeRuns'')::numeric,0)')=0
  THEN RAISE EXCEPTION 'Unexpected SSL score validator: refusing to modify access-controlled function'; END IF;
  EXECUTE replace(ddl,old_term,new_term);
END $server_scoring$;

DO $backfill_stolen_base_scores$
DECLARE
  s record;
  pre record;
  game_row jsonb;
  player_row jsonb;
  new_games jsonb;
  new_players jsonb;
  delta numeric;
  total numeric;
  item numeric;
  rev constant text := 'stolen_4_caught_minus_4_20261107';
BEGIN
  -- Official season score sheets; preserve statistics, inning scorecards,
  -- rosters, game outcomes, releases, and access settings.
  FOR s IN SELECT id,state FROM league_private.ssl_season_states FOR UPDATE LOOP
    new_games:='[]'::jsonb;
    FOR game_row IN
      SELECT value FROM jsonb_array_elements(coalesce(s.state->'games','[]'::jsonb))
    LOOP
      IF jsonb_typeof(game_row->'result'->'players')='array'
         AND coalesce(game_row->'result'->>'sslStealScoreRevision','')<>rev
      THEN
        new_players:='[]'::jsonb;
        FOR player_row IN
          SELECT value FROM jsonb_array_elements(game_row->'result'->'players')
        LOOP
          IF player_row ? 'gameScore' AND jsonb_typeof(player_row->'stats')='object' THEN
            delta:=4*coalesce((player_row->'stats'->>'stolenBases')::numeric,0)
                  -4*coalesce((player_row->'stats'->>'caughtStealing')::numeric,0);
            IF delta<>0 THEN
              total:=round((player_row->>'gameScore')::numeric+delta,2);
              item:=coalesce((player_row->>'itemScore')::numeric,0);
              player_row:=player_row || jsonb_build_object(
                'gameScore',total,'baseGameScore',round(total-item,2));
            END IF;
          END IF;
          new_players:=new_players||jsonb_build_array(player_row);
        END LOOP;
        game_row:=jsonb_set(game_row,'{result}',game_row->'result'||
          jsonb_build_object('players',new_players,'sslStealScoreRevision',rev));
      END IF;
      new_games:=new_games||jsonb_build_array(game_row);
    END LOOP;
    IF new_games IS DISTINCT FROM s.state->'games' THEN
      UPDATE league_private.ssl_season_states
        SET state=jsonb_set(s.state,'{games}',new_games)
        WHERE id=s.id;
    END IF;
  END LOOP;

  -- Preseason reports are stored separately and used in archived box scores
  -- and per-player preseason aggregates.
  FOR pre IN
    SELECT season_id,match_key,report
      FROM league_private.ssl_preseason_game_reports FOR UPDATE
  LOOP
    IF jsonb_typeof(pre.report->'players')<>'array'
      OR coalesce(pre.report->>'sslStealScoreRevision','')=rev
    THEN CONTINUE; END IF;
    new_players:='[]'::jsonb;
    FOR player_row IN
      SELECT value FROM jsonb_array_elements(pre.report->'players')
    LOOP
      IF player_row ? 'gameScore' AND jsonb_typeof(player_row->'stats')='object' THEN
        delta:=4*coalesce((player_row->'stats'->>'stolenBases')::numeric,0)
              -4*coalesce((player_row->'stats'->>'caughtStealing')::numeric,0);
        IF delta<>0 THEN
          total:=round((player_row->>'gameScore')::numeric+delta,2);
          item:=coalesce((player_row->>'itemScore')::numeric,0);
          player_row:=player_row || jsonb_build_object(
            'gameScore',total,'baseGameScore',round(total-item,2));
        END IF;
      END IF;
      new_players:=new_players||jsonb_build_array(player_row);
    END LOOP;
    UPDATE league_private.ssl_preseason_game_reports
      SET report=pre.report || jsonb_build_object(
          'players',new_players,'sslStealScoreRevision',rev)
      WHERE season_id=pre.season_id AND match_key=pre.match_key;
  END LOOP;
END $backfill_stolen_base_scores$;
