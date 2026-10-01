import { weekKey, matchupScore } from './fantasy-scoring.js'

export function weekResults(results, start) {
  const games = results.games.filter(game => weekKey(new Date(game.startsAt)) === start)
  const playerStats = {}
  for (const game of games) for (const [id, stats] of Object.entries(game.playerStats || {})) {
    const total = playerStats[id] ||= { positionsPlayed: [] }
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'number') total[key] = (total[key] || 0) + value
      if (key === 'positionsPlayed') total[key] = [...new Set([...total[key], ...value.map(p => p.trim())])]
    }
  }
  return { ...results, games, playerStats }
}

export function fantasyStandings(test, results) {
  const rows = test.fantasyTeams.map(team => ({ id: team.id, name: team.name, played: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }))
  for (const week of test.weeks) {
    const fixtures = test.schedule.filter(game => weekKey(new Date(game.startsAt)) === week.start)
    if (!fixtures.length || !fixtures.every(fixture => results.games.some(game => game.id === fixture.id))) continue
    for (const pair of week.fantasyMatchups) {
      const scores = pair.map(id => matchupScore(week.fantasyTeams.find(team => team.id === id).starters.map(player_id => ({ player_id, slot: 'starter' })), results.games, week.start))
      pair.forEach((id, i) => {
        const row = rows.find(team => team.id === id), score = scores[i], opponent = scores[1-i]
        row.played++; row.pointsFor += score; row.pointsAgainst += opponent
        row[score > opponent ? 'wins' : score < opponent ? 'losses' : 'ties']++
      })
    }
  }
  return rows.sort((a,b) => (b.wins + b.ties/2) / (b.played || 1) - (a.wins + a.ties/2) / (a.played || 1) || b.pointsFor-a.pointsFor || a.name.localeCompare(b.name))
}
