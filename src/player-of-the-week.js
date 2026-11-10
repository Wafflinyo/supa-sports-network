import {aggregate} from './season-data.js';
import pool from './players.json';

const namedPlayers = new Map(pool.map(player => [Number(player.id),player]));

export const potwTrophyUrl = (conference='supa') => import.meta.env.BASE_URL+(conference==='galaxy'?'potw-mario-galaxy.svg':'potw-supa-mario.svg');
export const potwConferenceName = conference => conference==='galaxy' ? 'Mario Galaxy Player of the Week' : 'Supa Mario Player of the Week';
export const potwConferenceLabel = conference => conference==='galaxy' ? 'Mario Galaxy Conference' : 'Supa Mario Conference';
export const potwPlayer = id => namedPlayers.get(Number(id));
export const potwWeekLabel = round => 'Weeks '+(2*round-1)+'/'+(2*round);
export const potwDate = value => value ? new Intl.DateTimeFormat('en-US',{
  month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'
}).format(new Date(value)) : 'Award date pending';
export const potwDeadline = value => value ? new Intl.DateTimeFormat('en-US',{
  month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'
}).format(new Date(value))+' ET' : 'Not scheduled';
export const potwRateKeys = new Set([
 'agp','gameScoreAvg','battingAverage','onBase','slug','onBasePlusSlug',
 'starSlug','era7','era9','whip','baAgainst','obAgainst'
]);
const priority = ['homeRuns','rbi','runs','hits','atBats','plateAppearances',
 'singles','doubles','triples','batWalks','batStrikeouts','stolenBases',
 'totalBases','bunting','putouts','assists','bobbles','doublePlays',
 'triplePlays','pitchStrikeouts','outs','earnedRuns','hitsAllowed','hrAllowed',
 'pitchWalks','strikes','pitches','inningsPitched','era7','whip','battingAverage',
 'onBase','slug','onBasePlusSlug','shutouts','combinedShutouts','itemScore'];
const omit = new Set(['tgp','ogp','dgp','pgp','agp','gamesPlayed','gameScore',
 'gameScoreAvg','positionsPlayed','shutoutBonus']);
export const potwExtraFields = rows => {
 const keys=new Set(rows.flatMap(row=>Object.keys(row.stats).filter(key=>
  typeof row.stats[key]==='number' && Number.isFinite(row.stats[key]) && !omit.has(key)
 )));
 return [...keys].sort((a,b)=>{
  const ia=priority.indexOf(a), ib=priority.indexOf(b);
  if(ia===-1&&ib===-1)return a.localeCompare(b);
  return (ia===-1?999:ia)-(ib===-1?999:ib);
 });
};
export function potwRounds(season){
 const weekly=(season?.games||[]).filter(g=>g.phase==='regular'&&Number.isFinite(Number(g.week)));
 const maxWeek=Math.max(0,...weekly.map(g=>Number(g.week)));
 return Array.from({length:Math.floor(maxWeek/2)},(_,index)=>{
  const roundNo=index+1,start=roundNo*2-1,end=start+1;
  const matches=weekly.filter(g=>Number(g.week)>=start && Number(g.week)<=end);
  const finished=matches.filter(g=>g.stage==='final').length;
  return {roundNo,start,end,total:matches.length,finished,complete:matches.length>0&&finished===matches.length};
 });
}
export function potwLeaderboard(season,roundNo){
 if(!season || !roundNo)return [];
 const games=(season.games||[]).filter(g=>g.phase==='regular'&&g.stage==='final'
  &&Number(g.week)>=roundNo*2-1 &&Number(g.week)<=roundNo*2);
 const stats=aggregate({...season,games});
 const teamMap=new Map((season.teams||[]).map(t=>[String(t.id),t.name]));
 return Object.entries(stats).map(([id,st])=>{
  const player=potwPlayer(id);
  const played=games.flatMap(g=>(g.result?.players||[])
    .filter(p=>Number(p.player)===Number(id))
    .map(p=>({team:p.team,week:Number(g.week),game:g.id})));
  played.sort((a,b)=>b.week-a.week);
  // A trophy belongs to the team that currently rosters the player, not to
  // a prior franchise appearing in the two-week game logs.
  const rosterTeam=(season.teams||[]).find(t=>(season.rosters?.[t.id]||[]).some(p=>Number(p)===Number(id)));
  if(!rosterTeam)return null;
  const team=rosterTeam.id;
  return {id:Number(id),name:player?.name||'Player '+id,
   team,conference:rosterTeam.conference,
   teamName:teamMap.get(String(team))||'SSL Team',stats:st,gamesPlayed:st.gamesPlayed||0};
 });
}
export function potwStatValue(row,key,view){
 if(key==='gamesPlayed')return row.gamesPlayed;
 const number=Number(row.stats?.[key]||0);
 if(key==='agp')return Number(row.stats?.agp||0);
 if(view==='Averages per Game' && !potwRateKeys.has(key))
  return row.gamesPlayed>0 ? number/row.gamesPlayed : 0;
 return number;
}
export const potwStatName = key => ({
 agp:'AGP',tgp:'TGP',ogp:'OGP',dgp:'DGP',pgp:'PGP',
 gamesPlayed:'GP',homeRuns:'HR',rbi:'RBI',era7:'ERA (7)',whip:'WHIP',
 pitchStrikeouts:'Pitch K',batStrikeouts:'Bat K',onBase:'OBP',slug:'SLG',
 onBasePlusSlug:'OPS',battingAverage:'AVG',hitsAllowed:'H Allowed',
 itemScore:'Item Score',inningsPitched:'IP'
})[key] || key.replace(/([A-Z])/g,' $1').replace(/^./,a=>a.toUpperCase());
export function potwSort(rows,key,view,direction){
 const lowBetter=new Set(['era7','era9','whip','baAgainst','obAgainst']);
 const dir=direction||(lowBetter.has(key)?'asc':'desc');
 return [...rows].sort((a,b)=>{
  const v=potwStatValue(a,key,view)-potwStatValue(b,key,view);
  return (dir==='asc'?v:-v) || b.gamesPlayed-a.gamesPlayed || a.name.localeCompare(b.name);
 });
}
