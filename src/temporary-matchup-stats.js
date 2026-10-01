import rules from './fantasy-rules.json' with { type: 'json' }

const battingAliases = {batWalks:'walks',batStrikeouts:'strikeouts'}
const pitchingAliases = {pitchWalks:'walks',pitchStrikeouts:'strikeouts',threeInningGames:'threeInningBonus',completeGames:'completeGameBonus'}
const battingKeys = ['singles','doubles','triples','homeRuns','runs','rbi','batWalks','hitByPitch','stolenBases','caughtStealing','batStrikeouts','doublePlaysHitInto','grandSlams']
const fieldingKeys = ['putouts','assists','buddyJumpPutouts','doublePlays','triplePlays','bobbles']
const pitchingKeys = ['outs','pitchStrikeouts','hitsAllowed','earnedRuns','hrAllowed','pitchWalks','beanBalls','pickoffs','threeInningGames','completeGames']
export const scoringWeights = Object.fromEntries([
  ...battingKeys.map(key=>[key,rules.batting[battingAliases[key]||key]]),
  ...fieldingKeys.map(key=>[key,rules.fielding[key]]),
  ...pitchingKeys.map(key=>[key,rules.pitching[pitchingAliases[key]||key]]),
  ['teamShutouts',rules.team.shutoutBonus],
])
export const roundPoints = value => Math.round(value*100)/100
export function playerBreakdown(id, results) {
  const games=results.games.filter(game=>game.playerScores?.[id])
  const summary=Object.fromEntries(['batting','fielding','pitching','teamBonus','total'].map(key=>[key,roundPoints(games.reduce((sum,game)=>sum+(game.playerScores[id][key]||0),0))]))
  return {...summary,gamesPlayed:games.length,games}
}
export function starterStats(team, results) {
  const keys=['gamesPlayed',...Object.keys(scoringWeights)]
  return Object.fromEntries(keys.map(key=>[key,team.starters.reduce((sum,id)=>sum+(results.playerStats[id]?.[key]||0),0)]))
}
