/**
 * Draft pedigree follows the PLAYER, not their current roster, so trades,
 * releases and later-season signings never rewrite Round/Pick #.
 * Only use verified official season picks; a free agent has no fake draft #.
 */
export function originalPlayerDraft(playerId,seasons=[]) {
  const id=Number(playerId);
  if(!Number.isInteger(id))return null;
  const chronological=[...seasons].filter(Boolean).sort((a,b)=>Number(a.number||1)-Number(b.number||1));
  for(const season of chronological) {
    const hit=(season.picks||[]).find(p=>p.kind!=='stage' && Number(p.player)===id &&
      Number.isInteger(Number(p.round)) && Number(p.round)>0 &&
      Number.isInteger(Number(p.number)) && Number(p.number)>0);
    if(hit)return {season:Number(season.number||1),round:Number(hit.round),
      number:Number(hit.number),team:hit.team||null,supplemental:Boolean(hit.supplemental)};
  }
  return null;
}
/**
 * Only display UNDRAFTED once a player has actually belonged to an official
 * SSL team without a recorded draft selection. An untouched free-agent pool
 * player is simply AVAILABLE, not a free-agent signing.
 *
 * Checking all accessible seasons preserves UNDRAFTED after trades, releases
 * and moves to another roster. An authentic original pick always takes priority.
 */
export function isUndraftedSigning(playerId,seasons=[]) {
  const id=Number(playerId);
  if(!Number.isInteger(id)||originalPlayerDraft(id,seasons))return false;
  return seasons.some(season=>season&&Object.values(season.rosters||{}).some(roster=>
    Array.isArray(roster)&&roster.some(rosteredId=>Number(rosteredId)===id)));
}

export function teamDraftedPlayers(season,teamId){
  if(!season||teamId==null)return [];
  const roster=season.rosters?.[String(teamId)]||[];
  return roster.map(id=>({playerId:Number(id),draft:originalPlayerDraft(id,[season])}));
}
export function sslCareerTenure(playerId,seasons=[]) {
  const id=Number(playerId);
  const chronological=[...seasons].filter(s=>s&&Number.isInteger(Number(s.number)))
    .sort((a,b)=>Number(a.number)-Number(b.number));
  const current=chronological.filter(s=>s.status!=='archived').at(-1)||chronological.at(-1);
  // In SSL's FIRST league season, every player is a rookie, even if games
  // have already been played or the team has not drafted them yet.
  if(!current||Number(current.number)===1)return 'ROOKIE';
  const preceding=chronological.filter(s=>Number(s.number)<Number(current.number));
  const experience=preceding.filter(s=>(s.picks||[]).some(p=>Number(p.player)===id) ||
    Object.values(s.rosters||{}).some(ids=>Array.isArray(ids)&&ids.some(p=>Number(p)===id)) ||
    (s.games||[]).some(g=>g.stage==='final'&&(g.result?.players||[]).some(p=>Number(p.player)===id))).length;
  if(!experience)return 'ROOKIE';
  const years=experience+1;
  return years===1?'1 YEAR':years+' YEARS';
}
