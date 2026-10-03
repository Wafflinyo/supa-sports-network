// Official season rows only. Each season has an id and playerStats keyed by player ID.
// Store raw counts (including pitching outs); never average season rate percentages.
export function playerCareer(playerId, seasons) {
  const rows = [...new Map(seasons.map(s => [s.id, s])).values()]
    .map(s => s.playerStats?.[playerId]).filter(s => Number.isInteger(s?.gamesPlayed) && s.gamesPlayed > 0)
  const sum = key => rows.length && rows.every(s => typeof s[key] === 'number' && Number.isFinite(s[key]))
    ? rows.reduce((total, s) => total + s[key], 0) : null
  const ratio = (n, d) => n != null && d > 0 ? n / d : null
  const games = sum('gamesPlayed')
  const perGame = key => ratio(sum(key), games)
  const hits = sum('hits'), walks = sum('batWalks'), hbp = sum('hitByPitch')
  const obp = hits != null && walks != null && hbp != null
    ? ratio(hits + walks + hbp, sum('plateAppearances')) : null
  const slug = ratio(sum('totalBases'), sum('atBats'))
  return {
    seasons: rows.length || null, games, mvps: sum('mvps'),
    averages: {
      battingAverage: ratio(hits, sum('atBats')), onBase: obp, slug,
      onBasePlusSlug: obp != null && slug != null ? obp + slug : null,
      hits: perGame('hits'), homeRuns: perGame('homeRuns'), rbi: perGame('rbi'),
      runs: perGame('runs'), putouts: perGame('putouts'), assists: perGame('assists'),
      pitchStrikeouts: perGame('pitchStrikeouts'),
      era7: ratio(sum('earnedRuns') == null ? null : sum('earnedRuns') * 21, sum('outs')),
    },
  }
}
