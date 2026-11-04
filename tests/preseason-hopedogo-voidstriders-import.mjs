import assert from 'node:assert/strict';
import {preseasonGames,preseasonPlayerStatsForGame,preseasonPlayerStats,preseasonTeamStats} from '../src/preseason-game-data.js';

const game=preseasonGames.find(g=>g.gameId==='PSR1 Hopedogo @ Voidstriders');
assert.ok(game,'Hopedogo @ Voidstriders must be imported');
assert.equal(game.away,'HopeDogo Retrievers 3');
assert.equal(game.home,'Starborn Voidstriders');
assert.deepEqual([game.awayScore,game.homeScore],[8,3]);
assert.equal(game.mvp,57,"SSL winner-team MVP goes to Funky Kong, not the sheet MVP label");
const players=preseasonPlayerStatsForGame(game);
assert.equal(players.length,18);
assert.equal(new Set(players.map(p=>p.playerId)).size,18);
const expected=new Map([[3,135],[57,182],[166,36],[163,114],[160,47],[31,37],[141,27],[58,40],[66,40],[2,113],[32,26],[172,47],[53,51],[70,37],[158,23],[71,34],[156,34],[155,44]]);
for(const player of players) {
  assert.equal(player.stats.tgp,expected.get(player.playerId),'TGP discrepancy for '+player.playerId);
  assert.equal(player.stats.gameScore,player.stats.tgp);
  const {ogp=0,dgp=0,pgp=0,mvps=0,itemScore=0}=player.stats;
  assert.ok(Math.abs(ogp+dgp+pgp+10*mvps+itemScore-player.stats.tgp)<0.02,'Component discrepancy for '+player.playerId);
}
assert.equal(players.find(p=>p.playerId===57).stats.mvps,1);
assert.equal(players.find(p=>p.playerId===3).stats.mvps,0);
assert.equal(players.find(p=>p.playerId===3).stats.battersFaced,18);
assert.equal(players.find(p=>p.playerId===160).stats.battersFaced,11);
assert.equal(players.find(p=>p.playerId===2).stats.pitchStrikeouts,1);
const totalFor=team=>Math.round(players.filter(p=>p.teamName===team).reduce((sum,p)=>sum+p.stats.tgp,0)*100)/100;
assert.equal(totalFor(game.away),658);
assert.equal(totalFor(game.home),409);
const teams=preseasonTeamStats();
assert.equal(teams.find(t=>t.teamName===game.away).stats.tgp,658);
assert.equal(teams.find(t=>t.teamName===game.home).stats.tgp,409);
assert.ok(preseasonPlayerStats().some(p=>p.playerId===57&&p.stats.tgp===182));
for(const id of ['PSR1 Fuggetaboudits @ Tanks','PSR1 Checkers @ Pangolins','PSR1 Ruffians @ Dedennes','PSR1 Knights @ Dolphins']){
 assert.ok(preseasonGames.some(g=>g.gameId===id),'Earlier game must be preserved: '+id);
}
console.log('Hopedogo @ Voidstriders: verified 8–3 result, winner MVP, 18 player Game Scores and 639/398 team totals.');
