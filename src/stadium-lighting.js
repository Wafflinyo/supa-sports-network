import {homeStadium,matchupTeams} from './matchup-display.js';

// Names match the official 13-Stadium draft catalog. These are exactly the
// six venues that have selectable Day and Night game variants.
export const DAY_NIGHT_STADIUMS=Object.freeze([
  'Mario Stadium',
  'Peach Ice Garden', // Peach’s Ice Garden in the game
  'DK Jungle',
  'Wario City',
  'Daisy Cruiser', // Daisy’s Cruiser in the game
  'Yoshi Park', // Yoshi’s Park in the game
]);
export const STADIUM_VARIANTS=Object.freeze(['Day','Night']);
export const supportsStadiumVariant=stadium=>DAY_NIGHT_STADIUMS.includes(stadium);
export const matchupStadiumVariant=(season,game)=>{
  const stadium=homeStadium(season,game?.home);
  if(!supportsStadiumVariant(stadium))return null;
  return STADIUM_VARIANTS.includes(game?.stadiumVariant)?game.stadiumVariant:null;
};
export const canEditStadiumVariant=(season,game,teamId)=>{
  if(!season||!game||!teamId||String(game.home)!==String(teamId))return false;
  if(['archived','setup','poll','scheduled','drafting'].includes(season.status))return false;
  if(!['regular','playoffs'].includes(game.phase))return false;
  if(game.stage!=='scheduled'||game.lockedAt)return false;
  return supportsStadiumVariant(homeStadium(season,teamId));
};
export function homeGames(season,teamId) {
  return (season?.games||[]).filter(g=>String(g.home)===String(teamId)&&
    ['regular','playoffs'].includes(g.phase)).sort((a,b)=>
    Number(a.week||999)-Number(b.week||999)||
    (a.startsAt||'').localeCompare(b.startsAt||'')||
    String(a.id).localeCompare(String(b.id)));
}
export function homeOpponent(season,game) {
  return matchupTeams(season,game).away?.name||'Opponent TBD';
}
