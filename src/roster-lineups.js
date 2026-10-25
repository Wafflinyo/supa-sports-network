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
export function teamGameLineups(season,team){
  return [...(season?.games||[])].filter(g=>[g.away,g.home].includes(team))
    .sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime());
}
export function savedLineupLabel(season,team,game){
  if(game?.lineups?.[team] && validLineup(season,team,game.lineups[team]))return 'Game lineup submitted';
  if(validLineup(season,team,season?.defaults?.[team]))return 'Using default lineup';
  return 'Lineup required';
}
