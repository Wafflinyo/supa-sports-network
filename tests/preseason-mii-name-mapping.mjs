import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import playerPool from '../src/players.json' with {type:'json'};
import {preseasonGames,preseasonPlayerStats,preseasonPlayerStatsForGame,preseasonTeamStats} from '../src/preseason-game-data.js';
import {preseasonBoxScore} from '../src/game-box-score-data.js';

const roster=new Map(playerPool.map(p=>[p.id,p]));
assert.equal(roster.get(118)?.name,'Ada Wong');
assert.equal(roster.get(118)?.kind,'mii');
for(const game of preseasonGames){
  for(const [playerId] of game.players){
    assert.equal(typeof playerId,'number','All imported preseason player IDs must map to the SSL player roster');
    assert.ok(roster.has(playerId),'Unknown player ID in '+game.gameId+': '+playerId);
  }
  assert.equal(game.playerNames,undefined,'Do not override official Mii names with Project Rio generic labels');
}

const game=preseasonGames.find(g=>g.gameId==='PSR1 Checkers @ Pangolins');
assert.ok(game);
const adaInSource=game.players.filter(([id])=>id===118);
assert.equal(adaInSource.length,1,'Ada Wong must appear once for the Pangolins');
assert.equal(adaInSource[0][1],1,'Ada Wong plays for the home Pangolins');
assert.equal(adaInSource[0][2],'P, 1B');
assert.equal(game.players.some(([id])=>id==='preseason:red-mii-f'),false);
assert.equal(JSON.stringify(game).includes('Red Mii (F)'),false);
const ada=preseasonPlayerStatsForGame(game).find(p=>p.playerId===118);
assert.ok(ada);
assert.equal(ada.teamName,'Petalburg Pangolins');
assert.equal(ada.stats.gameScore,ada.stats.tgp,'Game Score and Game Points stay consistent after reweighting');
assert(Number.isFinite(ada.stats.tgp),'Ada retains calculated game points');
assert.equal(ada.stats.runs,1);
assert.equal(ada.stats.pitchStrikeouts??0,0);
assert.equal(ada.stats.battersFaced,13);
assert.equal(ada.stats.inningsPitched,1.6666666667);
const agg=preseasonPlayerStats().find(p=>p.playerId===118);
assert.ok(agg);
assert.equal(agg.stats.gamesPlayed,1);
assert.equal(agg.stats.tgp,ada.stats.tgp,'Ada career aggregate retains the same single-game points');
const pangolins=preseasonTeamStats().find(t=>t.teamName==='Petalburg Pangolins');
assert.ok(pangolins);
assert(pangolins.stats.tgp>=ada.stats.tgp,'The Pangolins total includes Ada and the rest of their players');
const preseasonUI=readFileSync(new URL('../src/PreseasonStats.jsx',import.meta.url),'utf8');
const bracketUI=readFileSync(new URL('../src/SeasonPreseason.jsx',import.meta.url),'utf8');
assert.match(preseasonUI,/byId\.get\(String\(row\.playerId\)\)\?\.name\|\|row\.playerName/);
assert.match(bracketUI,/onOpen\(preseasonBoxScore\(report\)\)/);
const box=preseasonBoxScore(game);
const adaInBox=box.teams.flatMap(team=>team.players).find(p=>p.playerId===118);
assert.equal(adaInBox.name,'Ada Wong','Preseason bracket game box scores use official named Mii records');
console.log('All imported preseason participants resolve to SSL player names; Ada Wong points and team stats preserved.');
