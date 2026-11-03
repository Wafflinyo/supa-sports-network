import assert from 'node:assert/strict';
import {preseasonGames,preseasonPlayerStatsForGame,preseasonPlayerStats} from '../src/preseason-game-data.js';

const game=preseasonGames.find(g=>g.gameId==='PSR1 Fuggetaboudits @ Tanks');
assert.ok(game);
const waluigi=preseasonPlayerStatsForGame(game).find(p=>p.playerId===12);
assert.ok(waluigi);
assert.equal(waluigi.teamName,'Twilight Town Tanks');
assert.equal(waluigi.stats.plateAppearances,4,'Waluigi has four recorded plate appearances');
assert.equal(waluigi.stats.atBats,3,'Do not change at-bats without source verification');
assert.equal(waluigi.stats.hits,4,'Correcting PA must not change recorded hits');
assert.equal(waluigi.stats.itemScore,10);
const aggregate=preseasonPlayerStats().find(p=>p.playerId===12&&p.teamName==='Twilight Town Tanks');
assert.equal(aggregate.stats.plateAppearances,4);
assert.equal(aggregate.stats.hits,4);
assert.equal(aggregate.stats.gameScore,waluigi.stats.gameScore);
console.log('Waluigi plate appearances corrected to 4 in preseason without changing scoring.');
