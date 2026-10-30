// SSL's custom per-player Game Score; this is NOT Sluggers Fantasy scoring
// and does not use Project Rio's in-game Game Score field.
export const SSL_GAME_SCORE_WEIGHTS=Object.freeze({
  hits:4,runs:6,rbi:8,homeRuns:15,doubles:4,triples:6,
  twoHr:8,threeHr:12,grandSlams:15,totalBases:4,
  putouts:5,assists:4,buddyJumpPutouts:15,doublePlays:8,triplePlays:18,
  // Every three recorded pitching outs equal one inning (+2 total).
  // Score full and partial innings proportionally; don't use rounded Rio IP.
  pitchStrikeouts:15,outs:2/3,strikes:.5,earnedRuns:-3,
  completeGames:8,hrAllowed:-10,mvps:10,
  bobbles:-6,doublePlaysHitInto:-8,triplePlaysHitInto:-12
});
export const SSL_HEATING_THRESHOLD=95;
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
export function customGameScore(stats,itemScore=0){
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
  raw=round2(raw+item);
  return {gameScore:Math.max(0,raw),baseGameScore:round2(raw-item),
    itemScore:round2(item),rawScore:raw,detail,
    heatingUp:Math.max(0,raw)>=SSL_HEATING_THRESHOLD};
}
