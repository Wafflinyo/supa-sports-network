/**
 * Schedule presentation helpers. Keep the home team from the generated game's
 * "home" ID (never infer home/away from display order or a stadium name).
 *
 * A franchise's own Stadium Pick becomes its home venue. For future seasons,
 * a successfully retained stadium is also valid; if multiple retained
 * stadiums are available and no single Stadium Pick identifies the venue,
 * do NOT silently select the wrong stadium.
 */
export function matchupTeams(season,game){
  const teams=season?.teams||[];
  return {
    away:teams.find(t=>String(t.id)===String(game?.away))||null,
    home:teams.find(t=>String(t.id)===String(game?.home))||null,
  };
}

export function homeStadium(season,homeTeamId){
  if(!homeTeamId)return null;
  const id=String(homeTeamId);
  const choice=(season?.picks||[]).find(p=>p.kind==='stage' && String(p.team)===id && typeof p.stage==='string' && p.stage.trim());
  if(choice)return choice.stage.trim();
  const raw=season?.retainedStadiums?.[id];
  const retained=(Array.isArray(raw)?raw:[raw]).filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim());
  const unique=[...new Set(retained)];
  if(unique.length===1)return unique[0];
  if(unique.length>1)return null; // Multiple retained venues require explicit resolution.
  return null; // No draft Stadium Pick yet.
}

export function matchupDisplay(season,game){
  const {away,home}=matchupTeams(season,game);
  return {
    awayName:away?.name||'Away team TBD',
    homeName:home?.name||'Home team TBD',
    stadium:homeStadium(season,home?.id||game?.home),
  };
}
