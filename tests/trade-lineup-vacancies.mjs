import assert from 'node:assert/strict';
import {positions,validLineup} from '../src/season-data.js';
import {defaultLineupRosterView,effectiveGameLineup,gameLineupSubmissionStatus} from '../src/roster-lineups.js';

const previousRoster=Array.from({length:11},(_,i)=>i+1);
const original={
  starters:previousRoster.slice(0,9).map((player,i)=>({player,position:positions[i]})),
  bench:[10,11],
};
const knights='knights',moleville='moleville';
const before={
  status:'regular',schedulePublished:true,
  rosters:{[knights]:previousRoster,[moleville]:Array.from({length:11},(_,i)=>i+30)},
  defaults:{[knights]:original},games:[],
};
assert.equal(validLineup(before,knights,original),true);

// The trade sends starters 2 and 7 away and brings 12 and 13 in.
// Vacancies preserve batting order and defensive position, with no auto-filled additions.
const after={
  ...before,
  rosters:{...before.rosters,[knights]:[1,3,4,5,6,8,9,10,11,12,13]},
  defaults:{...before.defaults,[knights]:{
    starters:original.starters.map(slot=>[2,7].includes(slot.player)?{...slot,player:null}:slot),
    bench:[10,11],
  }},
};
const view=defaultLineupRosterView(after,knights);
assert.equal(view.valid,false,'Trade invalidates default until GM resubmits');
assert.deepEqual(view.starters.map(x=>x.position),positions,'Batting-order positions stay in place');
assert.equal(view.starters[1].player,null,'Traded starter 2 leaves an open 2nd batting slot');
assert.equal(view.starters[6].player,null,'Traded starter 7 leaves an open 7th batting slot');
assert.deepEqual(view.bench,[10,11],'Unchanged bench assignments remain');
assert.deepEqual(view.unassigned,[12,13],'New acquisitions are not automatically assigned');
assert.equal(effectiveGameLineup(after,knights,{stage:'scheduled',lineups:{}}),null,
  'Upcoming game cannot use incomplete default');
assert.equal(gameLineupSubmissionStatus(after,knights,{stage:'scheduled',lineups:{}}).kind,'missing');
assert.equal(effectiveGameLineup(after,knights,{stage:'final',lineups:{[knights]:original}}),original,
  'Historical game still displays its originally submitted lineup');

const repaired={
  starters:after.rosters[knights].slice(0,9).map((player,i)=>({player,position:positions[i]})),
  bench:after.rosters[knights].slice(9),
};
const corrected={...after,defaults:{...after.defaults,[knights]:repaired}};
assert.equal(validLineup(corrected,knights,repaired),true,'Valid resubmission restores default');
assert.equal(defaultLineupRosterView(corrected,knights).unassigned.length,0);
console.log('PASS: post-trade vacancies, no auto-assignment, invalidation, resubmission and historical lineups');
