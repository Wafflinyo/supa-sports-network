// Official category totals sum to TGP. Item Score is part of offense; MVP
// awards are split across eligible categories in proportion to performance.
import {SSL_GAME_SCORE_WEIGHTS,customGameScore,gameScoreStatCount,pitchingOutingBonus,soloShutoutReplacesCompleteGame} from './ssl-game-score.js';
export const GAME_POINT_KEYS=Object.freeze({
  ogp:['hits','runs','rbi','homeRuns','doubles','triples','twoHr','threeHr','grandSlams','totalBases','hitlessAtBats','batStrikeouts','stolenBases','caughtStealing','doublePlaysHitInto','triplePlaysHitInto'],
  dgp:['putouts','assists','buddyJumpPutouts','doublePlays','triplePlays','bobbles'],
  pgp:['pitchStrikeouts','outs','strikes','pitches','earnedRuns','hitsAllowed','pitchWalks','beanBalls','zeroOutRemoval','completeGames','hrAllowed'],
});
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;

// Any pitching appearance qualifies the MVP for a three-way split, even if
// they record no outs. Non-pitchers split their award between OGP and DGP.
const PITCHING_APPEARANCE_FIELDS=[
  'outs','pitches','strikes','battersFaced','inningsPitched',
  'pitchStrikeouts','pitchWalks','beanBalls','hitsAllowed','runsAllowed',
  'earnedRuns','completeGames','hrAllowed','inheritedRuns',
  'pickoffs','pickoffAttempts',
];
export function pitchedInGame(stats={}){
  return PITCHING_APPEARANCE_FIELDS.some(key=>Number(stats?.[key]??0)>0);
}

// Allocate exact cents, with one cent minimum per eligible category per MVP.
// Positive category scores determine proportional shares. If every category
// is non-positive, use relative rankings so the strongest still gets the most.
// Sorting remainders deterministically ensures no TGP points are lost.
export function splitMvpGamePoints(categoryPoints,stats={}){
  const awards=gameScoreStatCount(stats,'mvps');
  const result={ogp:0,dgp:0,pgp:0};
  if(!awards)return result;
  const keys=pitchedInGame(stats)?['ogp','dgp','pgp']:['ogp','dgp'];
  const raw=keys.map(k=>Number(categoryPoints[k]||0));
  let weights=raw.map(n=>Math.max(0,n));
  if(!weights.some(n=>n>0)){
    const min=Math.min(...raw);
    weights=raw.map(n=>n-min);
  }
  if(!weights.some(n=>n>0))weights=keys.map(()=>1);
  const sum=weights.reduce((a,b)=>a+b,0);
  const cents=1000*awards;
  const floorPerCategory=awards; // one cent per category for each MVP
  const distributable=cents-keys.length*floorPerCategory;
  const exact=weights.map(n=>distributable*n/sum);
  const pieces=exact.map(n=>Math.floor(n));
  const remainders=pieces.map((_,i)=>i).sort((a,b)=>
    (exact[b]-pieces[b])-(exact[a]-pieces[a])||
    raw[b]-raw[a]||a-b);
  let leftover=distributable-pieces.reduce((a,b)=>a+b,0);
  for(let i=0;i<leftover;i++)pieces[remainders[i%remainders.length]]++;
  const splitCents=pieces.map(n=>n+floorPerCategory);
  // The highest *unique* scoring category always takes strictly the largest
  // MVP share, even if proportional rounding would have tied the top two.
  const ranking=keys.map((_,i)=>i).sort((a,b)=>raw[b]-raw[a]||a-b);
  if(raw[ranking[0]]>raw[ranking[1]]&&
      splitCents[ranking[0]]<=splitCents[ranking[1]]&&
      splitCents[ranking[1]]>floorPerCategory){
    splitCents[ranking[0]]++;
    splitCents[ranking[1]]--;
  }
  keys.forEach((k,i)=>{result[k]=splitCents[i]/100;});
  return result;
}

export function gamePointComponents(stats={},shutoutBonus=0,itemScore=stats?.itemScore??0){
  const points={};
  for(const [group,keys] of Object.entries(GAME_POINT_KEYS))
    points[group]=round2(keys.reduce((sum,key)=>sum+
      gameScoreStatCount(stats,key)*SSL_GAME_SCORE_WEIGHTS[key],0));
  const completeGameAdjustment=soloShutoutReplacesCompleteGame(stats,shutoutBonus)
    ?Number(stats?.completeGames??0)*SSL_GAME_SCORE_WEIGHTS.completeGames:0;
  points.pgp=round2(points.pgp+Number(shutoutBonus||0)+pitchingOutingBonus(stats)-completeGameAdjustment);
  // Item Score is an offensive award, not a fourth point category.
  const item=Number(itemScore);
  if(!Number.isFinite(item)||item<0)throw Error('Item Score must be a nonnegative number.');
  points.ogp=round2(points.ogp+item);
  const mvp=splitMvpGamePoints(points,stats);
  for(const key of ['ogp','dgp','pgp'])points[key]=round2(points[key]+mvp[key]);
  return points;
}
export function gamePointsForReport(report){
  const stats=report?.stats||{};
  const bonus=Number(report?.shutoutBonus??stats.shutoutBonus??0);
  const item=report?.itemScore??stats.itemScore??0;
  const parts=gamePointComponents(stats,bonus,item);
  // Recompute old saved games with current official weights. A stored
  // Game Score is an import-time snapshot, not a canonical scoring formula.
  const hasSourceStats=report?.stats&&Object.keys(report.stats).length>0;
  const tgp=hasSourceStats
    ?customGameScore(stats,item,bonus).gameScore
    :typeof report?.gameScore==='number'&&Number.isFinite(report.gameScore)
      ?report.gameScore:customGameScore({},item,bonus).gameScore;
  return {...parts,tgp:round2(tgp)};
}
