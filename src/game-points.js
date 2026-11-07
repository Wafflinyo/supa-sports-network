// Per-game components use the same official SSL Game Score weights.
// Item Score and MVP bonus belong to TGP, not the three performance categories.
import {SSL_GAME_SCORE_WEIGHTS,customGameScore,gameScoreStatCount,pitchingOutingBonus,soloShutoutReplacesCompleteGame} from './ssl-game-score.js';
export const GAME_POINT_KEYS=Object.freeze({
  ogp:['hits','runs','rbi','homeRuns','doubles','triples','twoHr','threeHr','grandSlams','totalBases','hitlessAtBats','batStrikeouts','doublePlaysHitInto','triplePlaysHitInto'],
  dgp:['putouts','assists','buddyJumpPutouts','doublePlays','triplePlays','bobbles'],
  pgp:['pitchStrikeouts','outs','strikes','pitches','earnedRuns','hitsAllowed','pitchWalks','beanBalls','completeGames','hrAllowed'],
});
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function gamePointComponents(stats={},shutoutBonus=0){
  const points={};
  for(const [group,keys] of Object.entries(GAME_POINT_KEYS))
    points[group]=round2(keys.reduce((sum,key)=>sum+(gameScoreStatCount(stats,key))*SSL_GAME_SCORE_WEIGHTS[key],0));
  const completeGameAdjustment=soloShutoutReplacesCompleteGame(stats,shutoutBonus)
    ?Number(stats?.completeGames??0)*SSL_GAME_SCORE_WEIGHTS.completeGames:0;
  points.pgp=round2(points.pgp+Number(shutoutBonus||0)+pitchingOutingBonus(stats)-completeGameAdjustment);
  return points;
}
export function gamePointsForReport(report){
  const bonus=Number(report?.shutoutBonus??report?.stats?.shutoutBonus??0);
  const parts=gamePointComponents(report?.stats,bonus);
  // Recompute old saved games with the current official weights. A stored
  // gameScore is an import-time snapshot, not a canonical scoring formula.
  const hasSourceStats=report?.stats&&Object.keys(report.stats).length>0;
  const tgp=hasSourceStats
    ?customGameScore(report.stats,report?.itemScore??report.stats?.itemScore??0,bonus).gameScore
    :typeof report?.gameScore==='number'&&Number.isFinite(report.gameScore)
      ?report.gameScore:customGameScore({},report?.itemScore||0,bonus).gameScore;
  return {...parts,tgp:round2(tgp)};
}
