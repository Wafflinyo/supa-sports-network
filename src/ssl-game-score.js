// SSL's custom per-player Game Score; this is NOT Sluggers Fantasy scoring
// and does not use Project Rio's in-game Game Score field.
import {SSL_PITCHING_SHUTOUT_BONUS} from './pitching-shutout.js';
export const SSL_GAME_SCORE_WEIGHTS=Object.freeze({
  hits:4,runs:6,rbi:8,homeRuns:15,doubles:4,triples:6,
  twoHr:8,threeHr:12,grandSlams:15,totalBases:4,
  putouts:5,assists:4,buddyJumpPutouts:15,doublePlays:8,triplePlays:18,
  // Every three recorded pitching outs equal one inning (+3 total).
  // Score full and partial innings proportionally; don't use rounded Rio IP.
  pitchStrikeouts:15,outs:1,strikes:.5,pitches:.25,earnedRuns:-3,
  completeGames:20,hrAllowed:-8,mvps:10,
  bobbles:-6,doublePlaysHitInto:-8,triplePlaysHitInto:-12
});
// One earned-run performance tier per pitcher who records at least 9 outs
// (three full innings), independent of complete-game and shutout awards.
export const SSL_THREE_INNING_EARNED_RUN_BONUSES=Object.freeze([12,10,8,6]);
export function pitchingOutingBonus(stats={}){
  const outs=Number(stats?.outs??0);
  const earnedRuns=Number(stats?.earnedRuns??0);
  if(!Number.isInteger(outs)||outs<9||!Number.isInteger(earnedRuns)||earnedRuns<0||earnedRuns>3)return 0;
  return SSL_THREE_INNING_EARNED_RUN_BONUSES[earnedRuns];
}
export const SSL_HEATING_THRESHOLD=120;
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function customGameScore(stats,itemScore=0,shutoutBonus=0){
  const bonus=Number(shutoutBonus);
  if(!Number.isFinite(bonus)||bonus<0||bonus>SSL_PITCHING_SHUTOUT_BONUS||
    Math.abs(bonus*100-Math.round(bonus*100))>0.00001)
    throw Error('Shutout bonus must be 0–'+SSL_PITCHING_SHUTOUT_BONUS+
      ' points with no more than two decimal places.');
  const item=Number(itemScore);
  if(!Number.isFinite(item)||item<0)throw Error('Item Score must be a nonnegative number.');
  let raw=0;
  const detail={};
  for(const [key,weight] of Object.entries(SSL_GAME_SCORE_WEIGHTS)){
    const n=Number(stats?.[key]??0);
    if(!Number.isInteger(n)||n<0)throw Error('Invalid Game Score count: '+key);
    detail[key]=n*weight;
    raw+=detail[key];
  }
  detail.shutoutBonus=bonus;
  detail.pitchingOutingBonus=pitchingOutingBonus(stats);
  raw=round2(raw+item+bonus+detail.pitchingOutingBonus);
  return {gameScore:raw,baseGameScore:round2(raw-item),
    itemScore:round2(item),rawScore:raw,detail,
    heatingUp:raw>=SSL_HEATING_THRESHOLD};
}
