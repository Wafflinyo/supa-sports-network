// Official custom SSL Game Score calculated at Project Rio import time.
// Corrections automatically update the score, heat history and streaks.
import {SSL_HEATING_THRESHOLD} from './ssl-game-score.js';
export const HEATING_UP_THRESHOLD = SSL_HEATING_THRESHOLD;
export function heatingUpForSeason(season,{includeRecorded=false}={}) {
  const players={},byGame={},ready={},lastEarned={};
  const ordered=[...(season?.games||[])].filter(g=>g.stage!=='cancelled')
    .sort((a,b)=>Date.parse(a.startsAt||0)-Date.parse(b.startsAt||0)||String(a.id).localeCompare(String(b.id)));
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
          const event={playerId:id,gameId:g.id,at:g.startsAt,team,gameScore:score,streak,starredGame:null,phase:g.phase};
          record.events.push(event);
          lastEarned[id]=event;
          next.add(id);
        }else record.currentHotStreak=0;
      }
      // A star applies to one following team game only, not all future fixtures.
      ready[team]=next;
    }
  }
  return {players,byGame,events:Object.values(players).flatMap(r=>r.events)
    .sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0))};
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
