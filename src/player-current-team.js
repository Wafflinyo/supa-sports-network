// Resolve the player's current club from the selected season roster.
// Use IDs rather than a player's last box-score team so a trade or release
// updates Player Stats immediately, even before the next game.
export function playerCurrentTeamName(season,playerId){
  if(!season?.teams?.length)return 'Unassigned';
  const team=season.teams.find(team=>
    (season.rosters?.[team.id]||[]).some(id=>String(id)===String(playerId)));
  if(team)return team.name;
  return season.status==='drafting'?'Undrafted':'Free Agent';
}
