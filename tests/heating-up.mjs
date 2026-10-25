import assert from 'node:assert/strict';
import {heatingUpForSeason,heatingUpCareer} from '../src/heating-up.js';
const start='2026-11-01T19:00:00Z';
const teams={a:[7,9],b:[8,10]};
const game=(id,day,score,stage='final')=>({
 id,away:'a',home:'b',startsAt:new Date(Date.parse(start)+day*86400000).toISOString(),
 phase:'regular',stage,frozenRosters:teams, ...(stage==='final'?
 {result:{players:[{player:7,team:'a',gameScore:score},{player:8,team:'b',gameScore:0}]}}:{})
});
const season={number:1,name:'Season 1',rosters:teams,games:[
 game('g1',1,90),game('g2',2,95),game('g3',3,89),game('g4',4,null,'scheduled'),game('g5',5,null,'scheduled')
]};
let r=heatingUpForSeason(season);
assert.equal(r.players[7].heatingUpCount,2);
assert.equal(r.players[7].hotStreaks,1);
assert.equal(r.players[7].longestHotStreak,2);
assert.equal(r.players[7].currentHotStreak,0);
assert.deepEqual(r.byGame.g1.a,[]);
assert.deepEqual(r.byGame.g2.a,[7]);
assert.deepEqual(r.byGame.g3.a,[7]);
assert.deepEqual(r.byGame.g4.a,[]);
const fixed=structuredClone(season);
fixed.games[2].result.players[0].gameScore=90;
r=heatingUpForSeason(fixed);
assert.equal(r.players[7].heatingUpCount,3);
assert.equal(r.players[7].longestHotStreak,3);
assert.equal(r.players[7].hotStreaks,1);
assert.deepEqual(r.byGame.g4.a,[7]);
assert.deepEqual(r.byGame.g5.a,[]);
assert.equal(r.events.length,3);
assert(r.events.every(x=>x.playerId===7));
const career=heatingUpCareer(7,[fixed]);
assert.equal(career.heatingUpCount,3);
assert.equal(career.longestHotStreak,3);
assert.equal(career.events.length,3);
assert.equal(heatingUpForSeason(season).players[7].heatingUpCount,2,'Original report must not be mutated');
const preview=structuredClone(fixed);
preview.games[3].stage='recorded';
preview.games[3].result={players:[{player:7,team:'a',gameScore:96}]};
assert.deepEqual(heatingUpForSeason(preview).byGame.g5.a,[],'Public streaks must not reveal recorded results');
assert.deepEqual(heatingUpForSeason(preview,{includeRecorded:true}).byGame.g5.a,[7],'Commissioner preview should show next-game star after upload');
console.log('PASS: 90+ qualification, automatic next-game star, 2+ streak, longest streak, corrections and no duplicate events');
