// Exactly forty SSL pitching Game Points for a winning team that allows
// zero runs. Divide by actual pitching outs (not the decimal appearance of IP).
// Largest-remainder rounding guarantees that shared bonuses total $40.00$
// Game Points even when pitchers have uneven or equal innings.
export const SSL_PITCHING_SHUTOUT_BONUS=40;
export function pitchingShutoutBonuses({away,home,awayScore,homeScore,pitchers=[]}={}){
  const scores=[Number(awayScore),Number(homeScore)];
  if(!away||!home||scores.some(s=>!Number.isFinite(s)||s<0))return new Map();
  const winner=scores[0]>0&&scores[1]===0?String(away)
    :scores[1]>0&&scores[0]===0?String(home):null;
  if(!winner)return new Map();
  const eligible=pitchers
    .filter(row=>String(row.team)===winner&&Number.isInteger(Number(row.outs))&&Number(row.outs)>0)
    .map(row=>({player:String(row.player),outs:Number(row.outs)}));
  if(!eligible.length||new Set(eligible.map(row=>row.player)).size!==eligible.length)return new Map();
  const totalOuts=eligible.reduce((sum,row)=>sum+row.outs,0);
  const totalCents=SSL_PITCHING_SHUTOUT_BONUS*100;
  const entries=eligible.map(row=>{
    const exact=totalCents*row.outs/totalOuts;
    const whole=Math.floor(exact+1e-10);
    return {...row,cents:whole,fraction:exact-whole};
  });
  let remainder=totalCents-entries.reduce((sum,row)=>sum+row.cents,0);
  const ranked=[...entries].sort((a,b)=>
    b.fraction-a.fraction||b.outs-a.outs||
    a.player.localeCompare(b.player,undefined,{numeric:true}));
  for(let i=0;i<remainder;i++)ranked[i%ranked.length].cents+=1;
  return new Map(entries.map(row=>[row.player,row.cents/100]));
}

export function pitcherShutoutStats(bonus,pitcherCount){
  const credited=Number(bonus)>0;
  return {
    shutouts:Number(credited&&pitcherCount===1),
    combinedShutouts:Number(credited&&pitcherCount>1),
  };
}
