import assert from 'node:assert/strict';
import {customGameScore,SSL_GAME_SCORE_WEIGHTS,SSL_HEATING_THRESHOLD} from '../src/ssl-game-score.js';
import {buildReport,previewCustomGameScore,aggregate} from '../src/season-data.js';
import {heatingUpForSeason} from '../src/heating-up.js';
import {playerCareer} from '../src/player-career.js';
assert.equal(SSL_HEATING_THRESHOLD,95);
assert.deepEqual(SSL_GAME_SCORE_WEIGHTS,{
  hits:4,runs:6,rbi:8,homeRuns:15,doubles:4,triples:6,
  twoHr:8,threeHr:12,grandSlams:15,totalBases:4,
  putouts:5,assists:4,buddyJumpPutouts:15,doublePlays:8,triplePlays:18,
  pitchStrikeouts:15,bobbles:-6,doublePlaysHitInto:-8,triplePlaysHitInto:-12
});
assert.equal(Object.keys(SSL_GAME_SCORE_WEIGHTS).length,19);
const sample={
 hits:2,runs:1,rbi:2,homeRuns:1,doubles:1,twoHr:1,totalBases:6,
 putouts:1,pitchStrikeouts:1,bobbles:1
};
assert.deepEqual(Object.fromEntries(Object.entries(customGameScore(sample,10).detail).filter(([,v])=>v)),{
 hits:8,runs:6,rbi:16,homeRuns:15,doubles:4,twoHr:8,totalBases:24,
 putouts:5,pitchStrikeouts:15,bobbles:-6
});
assert.equal(customGameScore(sample).gameScore,95);
assert.equal(customGameScore(sample,10).gameScore,105,'Item Score adds to custom raw stat score');
assert.throws(()=>customGameScore(sample,-1),/Item Score/);
assert.equal(customGameScore({bobbles:10}).gameScore,0,'negative totals floor at zero');
assert.equal(customGameScore({hits:400}).gameScore,1600,'do not cap large legitimate Game Scores');
assert.equal(customGameScore({...sample,bobbles:2},0).gameScore,89);
assert.equal(customGameScore({...sample,bobbles:2},6).gameScore,95);
const row={player:'Bowser',position:'P',label:'A',chosen:10,
 hits:2,runs:1,rbi:2,homeruns:1,doubles:1,'2hr':1,putouts:1,bobbles:1,
 itemscore:10};
const pr={player:'Bowser',label:'A',chosen:10,strikeouts:1,inningspitched:1};
const preview={filename:'rio.xlsx',fingerprint:'sha',rows:[row],pitch:[pr]};
assert.equal(previewCustomGameScore(preview,row).gameScore,105,'import preview shows final calculated score');
const season={id:'s1',name:'Season 1',number:1,rosters:{a:[10],b:[1]},games:[]};
const game={id:'g1',away:'a',home:'b',phase:'regular',
  stage:'final',startsAt:'2026-11-01T17:00:00Z'};
const report=buildReport(preview,'A',season,game,[],null);
assert.equal(report.players[0].gameScore,105,'saved report score calculated from Rio stats');
assert.equal(report.players[0].baseGameScore,95);
assert.equal(report.players[0].itemScore,10);
assert.equal(report.players[0].stats.totalBases,6,'TB derived from hit types');
assert.equal(report.players[0].stats.pitchStrikeouts,1,'pitching strikeouts from Pitching sheet');
assert.equal(report.players[0].stats.bobbles,1);
assert.equal(report.players[0].stats.mvps,0);
const g={...game,result:{players:report.players}};
season.games=[g];
assert.equal(aggregate(season)[10].gameScore,105,'store total custom score separately from fantasy score');
assert.equal(aggregate(season)[10].itemScore,10);
assert.equal(aggregate(season)[10].gameScoreAvg,105);
const avg=playerCareer(10,[{id:'s1',playerStats:aggregate(season)}]);
assert.equal(avg.gameScore,105);
assert.equal(avg.averages.gameScore,105);
const below={...game,id:'g0',startsAt:'2026-10-31T17:00:00Z',
  result:{players:[{...report.players[0],gameScore:94}]}};
const hotSeason={...season,games:[below,g,{...game,id:'g2',stage:'scheduled',
 startsAt:'2026-11-02T17:00:00Z'}]};
const heat=heatingUpForSeason(hotSeason);
assert.equal(heat.players[10].heatingUpCount,1);
assert.deepEqual(heat.byGame.g2.a,[10]);
assert.deepEqual(heat.byGame.g1.a,[]);
const corrected={...hotSeason,games:[{...below,result:{players:[{...below.result.players[0],gameScore:95}]}},g,hotSeason.games[2]]};
assert.equal(heatingUpForSeason(corrected).players[10].heatingUpCount,2,
 'corrected report recomputes historical qualifications, not duplicate them');
console.log('PASS: custom 19-category Game Score, item bonus, 95+ Heating Up, Rio import, corrections, per-game and career totals');
