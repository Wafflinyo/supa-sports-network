// Per-game components use the same official SSL Game Score weights.
// Item Score and MVP bonus belong to TGP, not the three performance categories.
import {SSL_GAME_SCORE_WEIGHTS,customGameScore} from './ssl-game-score.js';
export const GAME_POINT_KEYS=Object.freeze({
  ogp:['hits','runs','rbi','homeRuns','doubles','triples','twoHr','threeHr','grandSlams','totalBases','doublePlaysHitInto','triplePlaysHitInto'],
  dgp:['putouts','assists','buddyJumpPutouts','doublePlays','triplePlays','bobbles'],
  pgp:['pitchStrikeouts','outs','strikes','earnedRuns','completeGames','hrAllowed'],
});
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function gamePointComponents(stats={}){
  const points={};
  for(const [group,keys] of Object.entries(GAME_POINT_KEYS))
    points[group]=round2(keys.reduce((sum,key)=>sum+(Number(stats?.[key]??0)||0)*SSL_GAME_SCORE_WEIGHTS[key],0));
  return points;
}
export function gamePointsForReport(report){
  const parts=gamePointComponents(report?.stats);
  const tgp=typeof report?.gameScore==='number'&&Number.isFinite(report.gameScore)
    ?report.gameScore:customGameScore(report?.stats||{},report?.itemScore||0).gameScore;
  return {...parts,tgp:round2(tgp)};
}
