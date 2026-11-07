-- Rescore every persisted postseason-style preseason Project Rio player row from
-- canonical raw stats, NOT by adding an offensive delta to an older saved score.
-- Some preseason pitchers were saved before the final +1/out and +0.25/pitch
-- weights; simply applying the offensive adjustment leaves stale PGP behind.
-- Keep draft records, raw stats, innings, game results and published flags intact.
DO $recalculate_preseason_official_points$
DECLARE
  season_report record;
  pl jsonb;
  amended_players jsonb;
  score numeric;
  item_score numeric;
  shutout numeric;
  outs_count numeric;
  earned_runs numeric;
  k text;
  weight text;
  official_revision constant text := 'official_weights_20261107';
  scoring_weights constant jsonb := '{
    "hits":4,"runs":6,"rbi":8,"homeRuns":15,
    "doubles":4,"triples":6,"twoHr":2,"threeHr":4,
    "grandSlams":6,"totalBases":4,
    "batStrikeouts":-10,"doublePlaysHitInto":-6,
    "triplePlaysHitInto":-10,
    "putouts":5,"assists":4,"buddyJumpPutouts":15,
    "doublePlays":8,"triplePlays":18,"bobbles":-6,
    "pitchStrikeouts":15,"outs":1,"strikes":0.5,"pitches":0.25,
    "earnedRuns":-3,"hitsAllowed":-0.25,"pitchWalks":-2,
    "beanBalls":-2,"completeGames":20,"hrAllowed":-8,"mvps":10
  }'::jsonb;
BEGIN
  FOR season_report IN
    SELECT season_id,match_key,report FROM league_private.ssl_preseason_game_reports FOR UPDATE
  LOOP
    IF coalesce(season_report.report->>'sslScoringRecalculated','')=official_revision
       OR jsonb_typeof(season_report.report->'players')<>'array'
    THEN CONTINUE; END IF;
    amended_players:='[]'::jsonb;
    FOR pl IN SELECT value FROM jsonb_array_elements(season_report.report->'players')
    LOOP
      IF jsonb_typeof(pl->'stats')='object' AND pl ? 'gameScore' THEN
        item_score:=coalesce((pl->>'itemScore')::numeric,0);
        shutout:=coalesce((pl->>'shutoutBonus')::numeric,0);
        outs_count:=coalesce((pl->'stats'->>'outs')::numeric,0);
        earned_runs:=coalesce((pl->'stats'->>'earnedRuns')::numeric,0);
        score:=item_score+shutout;
        FOR k,weight IN SELECT key,value FROM jsonb_each_text(scoring_weights)
        LOOP
          score:=score+coalesce((pl->'stats'->>k)::numeric,0)*weight::numeric;
        END LOOP;
        score:=score
          -2*greatest(
            coalesce((pl->'stats'->>'atBats')::numeric,0)
            -coalesce((pl->'stats'->>'hits')::numeric,0),0);
        -- The solo 30-point pitching shutout *replaces*, not stacks with,
        -- the +20 complete-game award.
        IF shutout=30 THEN
          score:=score-20*coalesce((pl->'stats'->>'completeGames')::numeric,0);
        END IF;
        -- Earned-run outing bonuses for 3+ innings (0/1/2/3 ER -> 12/10/8/6).
        IF outs_count>=9 AND earned_runs IN (0,1,2,3) THEN
          score:=score+12-2*earned_runs;
        END IF;
        score:=round(score,2);
        pl:=pl || jsonb_build_object(
          'gameScore',score,
          'baseGameScore',round(score-item_score,2)
        );
      END IF;
      amended_players:=amended_players || jsonb_build_array(pl);
    END LOOP;
    UPDATE league_private.ssl_preseason_game_reports
       SET report=season_report.report || jsonb_build_object(
         'players',amended_players,
         'sslScoringRecalculated',official_revision)
     WHERE season_id=season_report.season_id
       AND match_key=season_report.match_key;
  END LOOP;
END $recalculate_preseason_official_points$;
