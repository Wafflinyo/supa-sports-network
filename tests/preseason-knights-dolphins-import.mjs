import assert from 'node:assert/strict';
import {preseasonGames,preseasonPlayerStatsForGame,preseasonPlayerStats,preseasonTeamStats} from '../src/preseason-game-data.js';

const game=preseasonGames.find(g=>g.gameId==='PSR1 Knights @ Dolphins');
assert.ok(game, 'The original Knights at Dolphins match must be imported');
assert.equal(game.away,'New Donk City Knights');
assert.equal(game.home,'Delfino Dolphins');
assert.deepEqual([game.awayScore,game.homeScore],[4,5]);
assert.equal(game.mvp,6, 'Daisy won game MVP');
const players=preseasonPlayerStatsForGame(game);
assert.equal(players.length,18);
assert.equal(new Set(players.map(p=>p.playerId)).size,18);
const expected=new Map([
  [55,31],[39,59],[175,29.83],[6,98.67],[56,47],[48,61.5],
  [169,65],[83,71],[80,59],[65,66],[19,46],[162,10],
  [143,87],[24,54.67],[14,40.33],[23,66],[33,59],[64,66.5]
]);
for(const player of players){
  assert.equal(player.stats.tgp,expected.get(player.playerId),'Game Score mismatch: '+player.playerId);
  assert.equal(player.stats.gameScore,player.stats.tgp);
  assert.equal(Math.round((player.stats.ogp+player.stats.dgp+player.stats.pgp+(player.stats.itemScore||0)+10*(player.stats.mvps||0))*100)/100,
    player.stats.tgp,'Game Points components do not sum for player '+player.playerId);
}
assert.equal(players.find(p=>p.playerId===6).stats.pitchStrikeouts,1);
assert.equal(players.find(p=>p.playerId===6).stats.mvps,1);
assert.equal(players.find(p=>p.playerId===83).stats.rbi,2);
assert.equal(players.find(p=>p.playerId===80).stats.buddyJumpPutouts,1);
assert.equal(players.find(p=>p.playerId===24).stats.inningsPitched,5.33333333333333);
const totalFor=team=>Math.round(players.filter(p=>p.teamName===team).reduce((sum,p)=>sum+p.stats.tgp,0)*100)/100;
assert.equal(totalFor(game.away),495.5);
assert.equal(totalFor(game.home),522);
const teams=preseasonTeamStats();
assert.equal(teams.find(t=>t.teamName===game.away).stats.tgp,495.5);
assert.equal(teams.find(t=>t.teamName===game.home).stats.tgp,522);
assert.ok(preseasonPlayerStats().some(p=>p.playerId===6&&p.stats.gameScore===98.67));
for(const id of ['PSR1 Fuggetaboudits @ Tanks','PSR1 Checkers @ Pangolins','PSR1 Ruffians @ Dedennes']){
  assert.ok(preseasonGames.some(game=>game.gameId===id),'Previous game removed: '+id);
}
console.log('Knights at Dolphins: 18 player stats/Game Scores, MVP, OGP/DGP/PGP and team totals verified.');
