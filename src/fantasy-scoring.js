import rules from './fantasy-rules.json' with { type: 'json' }

export { rules }

export function weekKey(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: rules.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]))
  const localDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  localDay.setUTCDate(localDay.getUTCDate() - localDay.getUTCDay())
  return localDay.toISOString().slice(0, 10)
}

export function previousWeek(key, weeks = 1) {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7 * weeks)
  return d.toISOString().slice(0, 10)
}

export function sumScores(gameScores, playerId, week) {
  return gameScores.filter(game => weekKey(new Date(game.startsAt)) === week)
    .reduce((total, game) => total + (game.playerScores?.[playerId]?.total || 0), 0)
}

export function matchupPairs(userIds, round = 0) {
  const positions = [...userIds]
  if (positions.length < 2 || positions.length % 2) return []
  for (let i = 0; i < round % (positions.length - 1); i++) {
    positions.splice(1, 0, positions.pop())
  }
  return Array.from({ length: positions.length / 2 }, (_, i) => [positions[i], positions[positions.length - 1 - i]])
}

export function matchupScore(lineup, gameScores, week) {
  return Math.round(lineup.filter(row => row.slot === 'starter')
    .reduce((points, row) => points + sumScores(gameScores, row.player_id, week), 0) * 100) / 100
}
