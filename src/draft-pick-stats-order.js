import {lotteryProgress} from './lottery-timing.js';

// The backend persists all twelve lottery positions at once; do not reveal
// or reorder the draft UI until the LAST ball has actually been announced.
export function lotteryOrderReady(season,now){
  const order=season?.order,teams=season?.teams;
  if(!Array.isArray(order)||order.length!==12||!Array.isArray(teams)||teams.length!==12)return false;
  const ids=new Set(teams.map(t=>String(t.id)));
  if(new Set(order.map(String)).size!==12||order.some(id=>!ids.has(String(id))))return false;
  return lotteryProgress(order.length,season.lotteryAt,now).phase==='complete';
}

export function orderedDraftPickTeams(season,now){
  const teams=season?.teams||[];
  if(!lotteryOrderReady(season,now))
    return teams.map(team=>({team,lotteryPosition:null}));
  const byId=new Map(teams.map(team=>[String(team.id),team]));
  return season.order.map((id,index)=>({team:byId.get(String(id)),lotteryPosition:index+1}));
}

export const teamsInLotteryOrder=(season,now)=>orderedDraftPickTeams(season,now).map(x=>x.team);

/** Builds one exact round's draft slots. Snake positions are from the saved
 * lottery order; pick ownership is from currentPickAssets (server data). */
export function draftRoundQueue(season,round,now){
  if(!lotteryOrderReady(season,now))return [];
  if(!Number.isInteger(round)||round<1||round>12)return [];
  const byId=new Map(season.teams.map(t=>[String(t.id),t]));
  const reversed=round%2===0;
  const originalOrder=reversed?[...season.order].reverse():season.order;
  const picks=season.picks||[];
  return originalOrder.flatMap((id,slot)=>{
    const original=String(id);
    if(round===12&&(season.retainedStadiums?.[original]||[]).length>0)return [];
    const cursor=(round-1)*12+slot;
    // Round 12's untradeable Stadium entitlement always belongs to the
    // original team; other picks can have been traded beforehand.
    const asset=round===12?null:(season.currentPickAssets||[]).find(a=>
      Number(a.round)===round&&String(a.originalTeam)===original);
    const owner=round===12?original:String(asset?.owner||original);
    const done=picks.find(p=>Number(p.cursor)===cursor);
    const isCurrent=season.status==='drafting'&&
      Number(season.nextPick?.cursor)===cursor&&Boolean(season.nextPick);
    const pick=done||null;
    return [{
      cursor,round,roundPosition:slot+1,originalTeam:byId.get(original),
      pickingTeam:byId.get(String(pick?.team||owner)),
      transferred:owner!==original,pick,isCurrent,
      status:pick?'picked':isCurrent?'on-clock':'upcoming',
      mustStage:isCurrent&&Boolean(season.nextPick?.mustStage),
    }];
  });
}
