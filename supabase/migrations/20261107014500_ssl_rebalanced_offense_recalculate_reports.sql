-- Retroactively apply the commissioner's November 2026 offensive-scoring revision.
-- Standard HR +15 is unchanged. 2HR +2, 3HR +4, GS +6.
-- A non-hit AB costs 2; a batting strikeout costs an extra 10.
-- Hitting into a DP costs 6; a TP costs 10. Buddy Jump hits incur no extra cost.
-- Preserve pitcher scoring, item points, MVP awards, game outcomes, team rosters,
-- completed lineup selections, innings, published dates and access protections.

-- Patch ONLY the existing protected result-scoring validator. This avoids
-- replacing its commissioner authorization, shutout logic, future rules, etc.
DO $official_scoring_verifier$
DECLARE
  definition text;
  old_anchor constant text := $a$       + 4*coalesce((score_row->'stats'->>'hits')::numeric,0)$a$;
  new_anchor constant text := $b$       + 4*coalesce((score_row->'stats'->>'hits')::numeric,0)
       - 2*greatest(coalesce((score_row->'stats'->>'atBats')::numeric,0)
                    -coalesce((score_row->'stats'->>'hits')::numeric,0),0)
       - 10*coalesce((score_row->'stats'->>'batStrikeouts')::numeric,0)$b$;
  old_keys text[] := array[
    '+ 8*coalesce((score_row->''stats''->>''twoHr'')::numeric,0)',
    '+ 12*coalesce((score_row->''stats''->>''threeHr'')::numeric,0)',
    '+ 15*coalesce((score_row->''stats''->>''grandSlams'')::numeric,0)',
    '- 8*coalesce((score_row->''stats''->>''doublePlaysHitInto'')::numeric,0)',
    '- 12*coalesce((score_row->''stats''->>''triplePlaysHitInto'')::numeric,0)'
  ];
  new_keys text[] := array[
    '+ 2*coalesce((score_row->''stats''->>''twoHr'')::numeric,0)',
    '+ 4*coalesce((score_row->''stats''->>''threeHr'')::numeric,0)',
    '+ 6*coalesce((score_row->''stats''->>''grandSlams'')::numeric,0)',
    '- 6*coalesce((score_row->''stats''->>''doublePlaysHitInto'')::numeric,0)',
    '- 10*coalesce((score_row->''stats''->>''triplePlaysHitInto'')::numeric,0)'
  ];
  i integer;
BEGIN
  SELECT pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Protected SSL score verifier is missing'; END IF;
  IF strpos(definition,new_anchor)>0
     AND strpos(definition,new_keys[5])>0 THEN RETURN; END IF;
  IF strpos(definition,old_anchor)=0
     OR strpos(definition,'+ 15*coalesce((score_row->''stats''->>''homeRuns'')::numeric,0)')=0
     OR strpos(definition,'THEN 12-2*coalesce((score_row->''stats''->>''earnedRuns'')::numeric,0)')=0
  THEN RAISE EXCEPTION 'SSL validator unexpectedly changed: refusing formula patch'; END IF;
  definition := replace(definition,old_anchor,new_anchor);
  FOR i IN 1..array_length(old_keys,1) LOOP
    IF strpos(definition,old_keys[i])=0
      THEN RAISE EXCEPTION 'SSL verifier expected old scoring key %',old_keys[i]; END IF;
    definition := replace(definition,old_keys[i],new_keys[i]);
  END LOOP;
  EXECUTE definition;
END $official_scoring_verifier$;

-- A one-time, idempotent adjustment to the *persisted* official player scores
-- so direct score sheets, pre-existing Hot Game snapshots and public box scores
-- no longer retain the pre-revision totals. Every stat count stays unchanged.
DO $recalculate_saved_ssl_games$
DECLARE
  season_row record;
  preseason_row record;
  game_record jsonb;
  player_record jsonb;
  saved_games jsonb;
  saved_players jsonb;
  current_score numeric;
  item_score numeric;
  delta numeric;
  revision constant text := 'offense_rebalance_20261106';
BEGIN
  FOR season_row IN
    SELECT id,state FROM league_private.ssl_season_states FOR UPDATE
  LOOP
    saved_games := '[]'::jsonb;
    FOR game_record IN
      SELECT value FROM jsonb_array_elements(coalesce(season_row.state->'games','[]'::jsonb))
    LOOP
      IF jsonb_typeof(game_record->'result'->'players')='array'
         AND coalesce(game_record->'result'->>'sslScoringRevision','')<>revision
      THEN
        saved_players := '[]'::jsonb;
        FOR player_record IN
          SELECT value FROM jsonb_array_elements(game_record->'result'->'players')
        LOOP
          IF player_record ? 'gameScore' THEN
            delta :=
              - 2*greatest(coalesce((player_record->'stats'->>'atBats')::numeric,0)
                           -coalesce((player_record->'stats'->>'hits')::numeric,0),0)
              - 10*coalesce((player_record->'stats'->>'batStrikeouts')::numeric,0)
              - 6*coalesce((player_record->'stats'->>'twoHr')::numeric,0)
              - 8*coalesce((player_record->'stats'->>'threeHr')::numeric,0)
              - 9*coalesce((player_record->'stats'->>'grandSlams')::numeric,0)
              + 2*coalesce((player_record->'stats'->>'doublePlaysHitInto')::numeric,0)
              + 2*coalesce((player_record->'stats'->>'triplePlaysHitInto')::numeric,0);
            current_score := round((player_record->>'gameScore')::numeric+delta,2);
            item_score := coalesce((player_record->>'itemScore')::numeric,0);
            player_record := player_record || jsonb_build_object(
              'gameScore',current_score,
              'baseGameScore',round(current_score-item_score,2));
          END IF;
          saved_players := saved_players || jsonb_build_array(player_record);
        END LOOP;
        game_record := jsonb_set(game_record,'{result}',
          (game_record->'result') || jsonb_build_object(
            'players',saved_players,'sslScoringRevision',revision));
      END IF;
      saved_games := saved_games || jsonb_build_array(game_record);
    END LOOP;
    IF saved_games IS DISTINCT FROM season_row.state->'games'
    THEN UPDATE league_private.ssl_season_states
      SET state=jsonb_set(season_row.state,'{games}',saved_games)
      WHERE id=season_row.id; END IF;
  END LOOP;

  -- Released and private preseason report score snapshots are a separate
  -- store. The report.compact field contains only Rio source statistics,
  -- and the site recomputes its score display from those unchanged counts.
  FOR preseason_row IN
    SELECT season_id,match_key,report
      FROM league_private.ssl_preseason_game_reports FOR UPDATE
  LOOP
    IF jsonb_typeof(preseason_row.report->'players')='array'
       AND coalesce(preseason_row.report->>'sslScoringRevision','')<>revision
    THEN
      saved_players := '[]'::jsonb;
      FOR player_record IN
        SELECT value FROM jsonb_array_elements(preseason_row.report->'players')
      LOOP
        IF player_record ? 'gameScore' THEN
          delta :=
            - 2*greatest(coalesce((player_record->'stats'->>'atBats')::numeric,0)
                         -coalesce((player_record->'stats'->>'hits')::numeric,0),0)
            - 10*coalesce((player_record->'stats'->>'batStrikeouts')::numeric,0)
            - 6*coalesce((player_record->'stats'->>'twoHr')::numeric,0)
            - 8*coalesce((player_record->'stats'->>'threeHr')::numeric,0)
            - 9*coalesce((player_record->'stats'->>'grandSlams')::numeric,0)
            + 2*coalesce((player_record->'stats'->>'doublePlaysHitInto')::numeric,0)
            + 2*coalesce((player_record->'stats'->>'triplePlaysHitInto')::numeric,0);
          current_score := round((player_record->>'gameScore')::numeric+delta,2);
          item_score := coalesce((player_record->>'itemScore')::numeric,0);
          player_record := player_record || jsonb_build_object(
            'gameScore',current_score,
            'baseGameScore',round(current_score-item_score,2));
        END IF;
        saved_players := saved_players || jsonb_build_array(player_record);
      END LOOP;
      UPDATE league_private.ssl_preseason_game_reports
        SET report=preseason_row.report || jsonb_build_object(
          'players',saved_players,'sslScoringRevision',revision)
        WHERE season_id=preseason_row.season_id
          AND match_key=preseason_row.match_key;
    END IF;
  END LOOP;
END $recalculate_saved_ssl_games$;
