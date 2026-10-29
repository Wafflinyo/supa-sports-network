import {matchupDisplay} from './matchup-display.js';

// Track published matchups for the signed-in GM. This is deliberately a
// separate client-side record: it never modifies scheduled games or the draft.
const validDate=value=>Number.isFinite(Date.parse(value||''))?Date.parse(value):0;
const displayTime=value=>value?new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',
  hour:'numeric',minute:'2-digit',timeZoneName:'short',
}).format(new Date(value)):'Date TBD';
const sameTeam=(g,id)=>String(g.home)===String(id)||String(g.away)===String(id);

export function snapshotTeamSchedule(season,teamId){
  if(!season?.schedulePublished||!teamId)return null;
  return Object.fromEntries((season.games||[])
    .filter(g=>sameTeam(g,teamId) && g.phase!=='exhibition' && g.stage!=='final' && g.stage!=='recorded')
    .map(g=>[String(g.id),{
      startsAt:g.startsAt||null,
      stadium:matchupDisplay(season,g).stadium||null,
      postponed:Boolean(g.postponed),cancelled:g.stage==='cancelled',
      away:g.away,home:g.home,
    }]));
}

export function reconcileScheduleHistory({season,teamId,previous=null,history=[],now=Date.now()}={}){
  const snapshot=snapshotTeamSchedule(season,teamId);
  if(!snapshot)return {snapshot:null,history};
  // A first visit is a baseline, not evidence of a newly changed matchup.
  if(previous===null)return {snapshot,history};
  const events=[...history];
  for(const [gameId,next] of Object.entries(snapshot)){
    const old=previous[gameId];
    if(!old)continue; // the overall schedule-publication alert covers new matchups
    const changes=[];
    if(old.startsAt!==next.startsAt)changes.push(next.startsAt
      ? (old.startsAt?'New date: ':'Date set: ')+displayTime(next.startsAt)
      : 'Date and time now TBD');
    if(old.stadium!==next.stadium)changes.push('Stadium: '+(next.stadium||'TBD'));
    if(old.postponed!==next.postponed)changes.push(next.postponed?'Game postponed':'Postponement lifted');
    if(old.cancelled!==next.cancelled)changes.push(next.cancelled?'Game cancelled':'Cancellation lifted');
    if(!changes.length)continue;
    const away=season.teams?.find(t=>String(t.id)===String(next.away))?.name||'Away Team';
    const home=season.teams?.find(t=>String(t.id)===String(next.home))?.name||'Home Team';
    const identifier=String(season.id)+':schedule-change:'+gameId+':'+
      [next.startsAt,next.stadium,next.postponed,next.cancelled,now].join(':');
    events.unshift({
      id:identifier,type:'announcement',title:'Matchup schedule updated',
      detail:away+' @ '+home+' · '+changes.join(' · '),
      target:{page:'Schedule',focus:'game',gameId},
      createdAt:now,
    });
  }
  // The most recent 30 change events remain available even after a game is
  // played. Dedupe so polling or an unchanged snapshot cannot add copies.
  return {snapshot,history:[...new Map(events.map(e=>[e.id,e])).values()]
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,30)};
}
