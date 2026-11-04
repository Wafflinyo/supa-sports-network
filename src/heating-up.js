// Official custom SSL Game Score calculated at Project Rio import time.
// Corrections automatically update the score, heat history and streaks.
import {SSL_HEATING_THRESHOLD} from './ssl-game-score.js';
export const HEATING_UP_THRESHOLD = SSL_HEATING_THRESHOLD;
export function heatingUpForSeason(season,{includeRecorded=false}={}) {
  const players={},byGame={},ready={},lastEarned={};
  // SSL no longer uses game dates. Put the actual schedule in week order
  // (and postseason series order), otherwise UUID sorting assigns a hot game
  // to an arbitrary later opponent and loses the icon from the real lineup.
  const roundOrder={quarterfinal:1,semifinal:2,final:3};
  const orderKey=g=>{
    if(g.phase==='regular')return [0,Number(g.week||999),0];
    if(g.phase==='playoffs')return [1,roundOrder[g.playoffRound]||9,Number(g.seriesGame||999)];
    return [2,0,0];
  };
  const ordered=[...(season?.games||[])].map((g,index)=>({g,index}))
    .filter(({g})=>g.stage!=='cancelled')
    .sort((a,b)=>{
      const x=orderKey(a.g),y=orderKey(b.g);
      return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]||a.index-b.index;
    }).map(({g})=>g);
  for(const g of ordered){
    const finalized=(g.stage==='final'||(includeRecorded&&g.stage==='recorded'))&&Array.isArray(g.result?.players);
    const appearances=new Map((finalized?g.result.players:[]).map(p=>[Number(p.player),p]));
    byGame[g.id]={};
    for(const team of [g.away,g.home]){
      if(!team)continue;
      const roster=(g.frozenRosters?.[team]||season?.rosters?.[team]||[]).map(Number);
      const active=roster.filter(id=>ready[team]?.has(id));
      byGame[g.id][team]=active;
      for(const id of active)if(lastEarned[id]&&!lastEarned[id].starredGame)lastEarned[id].starredGame=g.id;
      const next=new Set();
      if(finalized)for(const id of roster){
        const score=appearances.get(id)?.gameScore;
        const good=typeof score==='number'&&Number.isFinite(score)&&score>=HEATING_UP_THRESHOLD;
        const record=players[id]||={heatingUpCount:0,hotStreaks:0,currentHotStreak:0,longestHotStreak:0,events:[]};
        if(good){
          const streak=++record.currentHotStreak;
          record.heatingUpCount++;
          if(streak===2)record.hotStreaks++;
          record.longestHotStreak=Math.max(streak,record.longestHotStreak);
          const event={playerId:id,gameId:g.id,at:g.releasedAt||g.result?.postedAt||g.startsAt||null,team,gameScore:score,streak,starredGame:null,phase:g.phase};
          record.events.push(event);
          lastEarned[id]=event;
          next.add(id);
        }else record.currentHotStreak=0;
      }
      // A star applies to one following team game only, not all future fixtures.
      ready[team]=next;
    }
  }
  const gameOrder=new Map(ordered.map((g,i)=>[String(g.id),i]));
  return {players,byGame,events:Object.values(players).flatMap(r=>r.events)
    .sort((a,b)=>(gameOrder.get(String(b.gameId))||0)-(gameOrder.get(String(a.gameId))||0))};
}
export function heatingUpCareer(id,seasons,options={}){
  let heatingUpCount=0,hotStreaks=0,longestHotStreak=0,currentHotStreak=0;
  const events=[];
  for(const s of [...seasons].sort((a,b)=>(a.number||0)-(b.number||0))){
    const r=heatingUpForSeason(s,options).players[id];if(!r)continue;
    heatingUpCount+=r.heatingUpCount;hotStreaks+=r.hotStreaks;
    longestHotStreak=Math.max(longestHotStreak,r.longestHotStreak);
    currentHotStreak=r.currentHotStreak;
    for(const event of r.events)events.push({...event,season:s.name||'SSL Season'});
  }
  return {heatingUpCount,hotStreaks,longestHotStreak,currentHotStreak,events:events.reverse()};
}
