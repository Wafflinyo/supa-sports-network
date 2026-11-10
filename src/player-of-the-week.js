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

// The award is for the two games within this two-week award period.
// If a reschedule puts more games into the period, use only a team's two
// most recent played games, never earlier season/career numbers.
const gameOrder=(a,b)=>
 Number(a.week||0)-Number(b.week||0) ||
 (Date.parse(a.releasedAt||a.startsAt||a.result?.postedAt||'')||0)-
 (Date.parse(b.releasedAt||b.startsAt||b.result?.postedAt||'')||0) ||
 String(a.id||'').localeCompare(String(b.id||''));
export function potwWindowGames(season,roundNo){
 const start=2*Number(roundNo)-1,end=start+1;
 return (season?.games||[]).filter(g=>g.phase==='regular'&&g.stage==='final'&&
   Number(g.week)>=start&&Number(g.week)<=end).sort(gameOrder);
}
export function potwTeamGames(season,roundNo,teamId){
 return potwWindowGames(season,roundNo).filter(g=>
  String(g.home)===String(teamId)||String(g.away)===String(teamId)).slice(-2);
}
export function potwLeaderboard(season,roundNo){
 if(!season||!roundNo)return [];
 // Snapshot the team a player represents NOW; an old team does not receive
 // award credit for a player it traded before the commissioner submits.
 return (season.teams||[]).flatMap(team=>{
   const games=potwTeamGames(season,roundNo,team.id);
   if(!games.length)return [];
   const teamGames=games.map(game=>({...game,result:{...game.result,
     players:(game.result?.players||[]).filter(p=>String(p.team)===String(team.id))
   }}));
   const stats=aggregate({...season,games:teamGames});
   return (season.rosters?.[team.id]||[]).map(id=>{
     const st=stats[id];
     if(!st?.gamesPlayed)return null;
     const player=potwPlayer(id);
     return {id:Number(id),name:player?.name||'Player '+id,
       team:team.id,conference:team.conference,teamName:team.name,
       stats:st,gamesPlayed:st.gamesPlayed,gameIds:games.map(g=>g.id)};
   }).filter(Boolean);
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
