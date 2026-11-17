// Client-side preview of the post-trade limits enforced by the database.
// The server is authoritative and rechecks before all trade writes.
export function validateTradeLimits(season, participants = [], moves = [], actingTeam = null) {
  const issues = [];
  const projections = [];
  if (!season || participants.length < 2 || moves.length < 1) return {issues, projections};
  const activeAssets = (season.offseasonTrading || Number(season.tradePickSeason) === Number(season.number)) && Array.isArray(season.currentPickAssets)
    ? season.currentPickAssets
    : season.pickAssets || [];
  const teamNames = new Map((season.teams || []).map(t => [String(t.id), t.name]));
  const teamIds = new Set(participants.map(String));
  const seen = new Set();
  const label = id => (teamNames.get(String(id)) || 'Unknown team') +
    (String(id) === String(actingTeam) ? ' (proposing team)' : ' (other participating team)');
  for (const move of moves) {
    const from = String(move.from || ''), to = String(move.to || '');
    if (!teamIds.has(from) || !teamIds.has(to) || from === to) {
      issues.push('Every asset must move between two different participating teams.');
      continue;
    }
    if (move.kind !== 'player' && move.kind !== 'pick') continue;
    const key = move.kind + ':' + String(move.id);
    if (seen.has(key)) {
      issues.push('The same ' + (move.kind === 'player' ? 'character' : 'draft pick') +
        ' cannot be included more than once.');
      continue;
    }
    seen.add(key);
    if (move.kind === 'player' && !(season.rosters?.[from] || []).some(id => Number(id) === Number(move.id))) {
      issues.push(label(from) + ' no longer owns the offered character.');
    }
    if (move.kind === 'pick' && !activeAssets.some(p => String(p.id) === String(move.id) && String(p.owner) === from)) {
      issues.push(label(from) + ' no longer owns the offered draft pick.');
    }
  }
  for (const id of participants.map(String)) {
    const currentCharacters = (season.rosters?.[id] || []).length;
    const currentPicks = activeAssets.filter(p => String(p.owner) === id).length;
    const characters = currentCharacters + moves.reduce((n, m) => n +
      (m.kind === 'player' ? (String(m.to) === id ? 1 : 0) - (String(m.from) === id ? 1 : 0) : 0), 0);
    const picks = currentPicks + moves.reduce((n, m) => n +
      (m.kind === 'pick' ? (String(m.to) === id ? 1 : 0) - (String(m.from) === id ? 1 : 0) : 0), 0);
    projections.push({id, name:teamNames.get(id) || 'Unknown team', characters, picks});
    if (characters < 11) issues.push(label(id) + ' would have ' + characters + ' characters (minimum 11).');
    if (characters > 14) issues.push(label(id) + ' would have ' + characters + ' characters (maximum 14).');
    if (picks < 9) issues.push(label(id) + ' would have ' + picks + ' tradable next-season picks (minimum 9).');
  }
  return {issues: [...new Set(issues)], projections};
}
