import {validLineup} from './season-data.js';
// All lineup editors use the SAME official defaults and scheduled-game storage.
// No separate GM roster cache: changes saved here appear on the Schedule page.
export function effectiveGameLineup(season,team,game){
  return game?.lineups?.[team] || season?.defaults?.[team] || null;
}
export function gameLineupIsEditable(season,team,game){
  return Boolean(season?.schedulePublished &&
    ['regular','postseason'].includes(season.status) &&
    game && ['scheduled','live'].includes(game.stage) &&
    !game.lockedAt && [game.away,game.home].includes(team));
}
// Notify only for genuinely upcoming, dated fixtures in an active season.
// Published schedules can contain months of TBD games; those are NOT lineup
// deadlines and must never trigger the persistent GM action banner.
export const GAME_LINEUP_REMINDER_WINDOW_MS=7*24*60*60*1000;
export function upcomingLineupReminderGames(season,team,now=Date.now()){
  if(!season?.schedulePublished||!['regular','postseason'].includes(season.status))return [];
  return (season.games||[]).filter(game=>{
    const kickoff=Date.parse(game?.startsAt||'');
    return game.stage==='scheduled' &&
      gameLineupIsEditable(season,team,game) &&
      Number.isFinite(kickoff) && kickoff>now && kickoff<=now+GAME_LINEUP_REMINDER_WINDOW_MS &&
      !validLineup(season,team,game.lineups?.[team]);
  }).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
}
export function teamGameLineups(season,team){
  return [...(season?.games||[])].filter(g=>[g.away,g.home].includes(team))
    .sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime());
}
export function savedLineupLabel(season,team,game){
  if(game?.lineups?.[team] && validLineup(season,team,game.lineups[team]))return 'Game lineup submitted';
  if(validLineup(season,team,season?.defaults?.[team]))return 'Using default lineup';
  return 'Lineup required';
}


// Distinguish an explicit submission from the lineup merely displayed as
// fallback. Starting a game can automatically copy defaults into game.lineups,
// so the dedicated server-side submission audit is authoritative where present.
const sameLineup=(a,b)=>{
  if(!a||!b)return false;
  const slots=x=>(x.starters||[]).map(p=>String(p.player)+':'+p.position).join('|');
  const bench=x=>(x.bench||[]).map(String).sort().join('|');
  return slots(a)===slots(b)&&bench(a)===bench(b);
};
export function gameLineupSubmissionStatus(season,team,game){
  const submitted=game?.lineups?.[team];
  const fallback=season?.defaults?.[team];
  const audit=game?.lineupSubmission?.[team];
  const defaultReady=validLineup(season,team,fallback);
  const gameReady=validLineup(season,team,submitted);
  if(!gameReady){
    return defaultReady
      ?{kind:'fallback',label:'NOT SUBMITTED · DEFAULT LINEUP SHOWN',detail:'This is only the automatic fallback. No game-specific lineup has been submitted.'}
      :{kind:'missing',label:'LINEUP REQUIRED',detail:'No valid game lineup or saved default is available.'};
  }
  if(audit?.source==='default'||audit?.source==='custom'){
    const actor=audit.by==='commissioner'?'Commissioner':'GM';
    return {
      kind:audit.source,
      label:audit.source==='default'?actor.toUpperCase()+' SUBMITTED DEFAULT LINEUP':actor.toUpperCase()+' SUBMITTED CUSTOM LINEUP',
      detail:audit.source==='default'?'Explicitly submitted the saved default for this game.':'Explicitly submitted a game-specific batting order and positions.',
      at:audit.at||null,
    };
  }
  // Older games may lack the submission audit. Only scheduled games can
  // safely treat a stored game lineup as manually submitted; start_game also
  // writes automatic defaults into game.lineups for live/final games.
  if(game?.stage==='scheduled'){
    return sameLineup(submitted,fallback)
      ?{kind:'legacy-default',label:'GAME LINEUP SUBMITTED · MATCHES CURRENT DEFAULT',detail:'A game lineup was submitted, but whether the default button was used was not recorded.'}
      :{kind:'legacy-custom',label:'GAME LINEUP SUBMITTED · CUSTOM ORDER',detail:'A separate game lineup was submitted before the game started.'};
  }
  return {kind:'unknown',label:'LOCKED LINEUP · SUBMISSION SOURCE UNKNOWN',
    detail:'An older game may have automatically copied its default lineup at kickoff; a GM submission cannot be confirmed from this saved record.'};
}
