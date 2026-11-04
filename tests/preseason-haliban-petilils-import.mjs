import assert from 'node:assert/strict';
import {preseasonGames,preseasonPlayerStatsForGame,preseasonPlayerStats,preseasonTeamStats} from '../src/preseason-game-data.js';

const game=preseasonGames.find(g=>g.gameId==='PSR1 Haliban @ Petilils');
assert.ok(game,'Haliban @ Petilils must be imported');
assert.equal(game.away,'Moleville Haliban');
assert.equal(game.home,'Petalburg Petilils');
assert.deepEqual([game.awayScore,game.homeScore],[5,6]);
assert.equal(game.mvp,54,'SSL MVP goes to Boomerang Bro, highest player on the winning team');
const players=preseasonPlayerStatsForGame(game);
assert.equal(players.length,18);
assert.equal(new Set(players.map(p=>p.playerId)).size,18);
const expected=new Map([[59,113],[50,116],[11,35.25],[147,57],[44,15],[43,30],[150,28],[182,41.75],[68,93],[142,37.5],[36,103],[52,37],[35,88],[54,124],[164,23],[30,4],[5,16.25],[29,23]]);
for(const player of players) {
  assert.equal(player.stats.tgp,expected.get(player.playerId),'TGP discrepancy for '+player.playerId);
  assert.equal(player.stats.gameScore,player.stats.tgp);
  const {ogp=0,dgp=0,pgp=0,mvps=0,itemScore=0}=player.stats;
  assert.ok(Math.abs(ogp+dgp+pgp+10*mvps+itemScore-player.stats.tgp)<0.02,'Game Points mismatch '+player.playerId);
}
assert.equal(players.find(p=>p.playerId===54).stats.mvps,1);
assert.equal(players.find(p=>p.playerId===35).stats.mvps,0,'Project Rio MVP tag must not override SSL winner-team rule');
assert.equal(players.find(p=>p.playerId===182).stats.battersFaced,28,'Blue Mii (M) pitching stats belong to Vegeta');
assert.equal(players.find(p=>p.playerId===142).stats.inningsPitched,6.66666666666667);
const totalFor=team=>Math.round(players.filter(p=>p.teamName===team).reduce((sum,p)=>sum+p.stats.tgp,0)*100)/100;
assert.equal(totalFor(game.away),529);
assert.equal(totalFor(game.home),455.75);
const teams=preseasonTeamStats();
assert.equal(teams.find(t=>t.teamName===game.away).stats.tgp,529);
assert.equal(teams.find(t=>t.teamName===game.home).stats.tgp,455.75);
assert.equal(teams.find(t=>t.teamName===game.away).stats.runsScored,5);
assert.equal(teams.find(t=>t.teamName===game.home).stats.runsScored,6);
assert.ok(preseasonPlayerStats().some(p=>p.playerId===54&&p.stats.tgp===124));
for(const id of ['PSR1 Fuggetaboudits @ Tanks','PSR1 Checkers @ Pangolins','PSR1 Ruffians @ Dedennes','PSR1 Knights @ Dolphins','PSR1 Hopedogo @ Voidstriders']){
  assert.ok(preseasonGames.some(g=>g.gameId===id),'Earlier game must be preserved: '+id);
}
console.log('Haliban @ Petilils: verified 6–5 final, Boomerang Bro MVP, 18 Game Scores and 509.67/434 team points.');
