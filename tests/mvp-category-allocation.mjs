import assert from 'node:assert/strict';
import {gamePointComponents,gamePointsForReport,pitchedInGame,splitMvpGamePoints} from '../src/game-points.js';
import {customGameScore} from '../src/ssl-game-score.js';
import {preseasonGames,preseasonPlayerStatsForGame,preseasonTeamStats} from '../src/preseason-game-data.js';

const cents=n=>Math.round(n*100);
const sums=pts=>cents(pts.ogp)+cents(pts.dgp)+cents(pts.pgp);
const asCents=(a,b)=>assert.equal(sums(a),cents(b),'OGP + DGP + PGP must equal official TGP');

// Item Score is an OGP credit, including on raw compact prehistoric datasets.
assert.deepEqual(gamePointsForReport({stats:{hits:1,atBats:1,itemScore:6},itemScore:6}),
  {ogp:10,dgp:0,pgp:0,tgp:10},'Item Score is counted only once in OGP');
assert.deepEqual(gamePointComponents({hits:1,atBats:1,itemScore:6}),
  {ogp:10,dgp:0,pgp:0});
assert.deepEqual(gamePointsForReport({stats:{hits:1},itemScore:6,gameScore:-99}),
  {ogp:10,dgp:0,pgp:0,tgp:10},'Saved Game Score snapshots cannot double-count item points');

// Non-pitching MVP: +10 split between offense and defense, higher category wins.
const nonpitch={hits:1,atBats:1,putouts:1,mvps:1};
assert.equal(pitchedInGame(nonpitch),false);
const nonpitchPoints=gamePointComponents(nonpitch,0,6);
assert.deepEqual(nonpitchPoints,{ogp:16.66,dgp:8.34,pgp:0});
asCents(nonpitchPoints,customGameScore(nonpitch,6).gameScore);
const nonpitchDefense=gamePointComponents({hits:1,atBats:1,putouts:10,mvps:1});
assert(nonpitchDefense.dgp-50>nonpitchDefense.ogp-4,
  'Defensive MVP category takes the most points when defense is stronger');

// Pitching MVP: +10 distributed among all three categories in proportion to
// offensive, defensive and pitching points before the MVP award.
const pitching={hits:2,atBats:2,putouts:1,outs:3,mvps:1};
assert(pitchedInGame(pitching));
const pitchedPoints=gamePointComponents(pitching);
assert.deepEqual(pitchedPoints,{ogp:12.99,dgp:8.13,pgp:4.88});
asCents(pitchedPoints,customGameScore(pitching).gameScore);
const pitchingShare=splitMvpGamePoints({ogp:8,dgp:5,pgp:3},pitching);
assert.deepEqual(pitchingShare,{ogp:4.99,dgp:3.13,pgp:1.88});
assert(pitchingShare.ogp>pitchingShare.dgp&&pitchingShare.dgp>pitchingShare.pgp);

// Negative categories still receive a minimal 1-cent MVP share, so all
// categories qualify without dividing by negative or zero performance.
const negativePitching={hits:2,atBats:2,putouts:1,outs:1,earnedRuns:5,mvps:1};
const negative=gamePointComponents(negativePitching);
assert(negative.pgp>-14&&negative.pgp<-13);
asCents(negative,customGameScore(negativePitching).gameScore);
assert(negative.ogp>8&&negative.dgp>5);
assert.deepEqual(splitMvpGamePoints({ogp:-10,dgp:-6,pgp:0},{mvps:1}),
  {ogp:0.01,dgp:9.99,pgp:0},'Strongest negative-scoring category still gets the most');

// Zero and tied categories split deterministically without losing a cent.
const tied=splitMvpGamePoints({ogp:0,dgp:0,pgp:0},{pitches:1,mvps:1});
assert.equal(cents(tied.ogp+tied.dgp+tied.pgp),1000);
assert(tied.ogp>=tied.dgp&&tied.dgp>=tied.pgp);
const close=splitMvpGamePoints({ogp:1000,dgp:999,pgp:0},{mvps:1});
assert(close.ogp>close.dgp,'Highest category gets more even when rounding would tie');
assert.equal(cents(close.ogp+close.dgp),1000);

// All six saved Round 1 preseason fixtures are recalculated from current
// source values; no player, team or archived score may lose or gain TGP.
for(const game of preseasonGames){
  for(const row of preseasonPlayerStatsForGame(game)){
    const pts=row.stats;
    asCents(pts,pts.tgp);
  }
}
for(const team of preseasonTeamStats()){
  asCents(team.stats,team.stats.tgp);
}
console.log('PASS: Item Score in OGP, weighted MVP share favoring strongest eligible category, exact sums and unchanged TGP across preseason and historic Game Points');
