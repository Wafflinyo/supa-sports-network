import assert from 'node:assert/strict';
import {matchupType,standings} from '../src/season-data.js';
const teams=[{id:'a',conference:'supa',name:'A'},{id:'b',conference:'supa',name:'B'},{id:'c',conference:'galaxy',name:'C'}];
const make=(id,away,home,awayRuns,homeRuns,phase='regular')=>({
 id,away,home,phase,stage:'final',result:{scores:{[away]:awayRuns,[home]:homeRuns},players:[]}
});
const season={teams,games:[
 make('w1','a','b',6,3),  // A wins away; B loses home
 make('w2','c','a',2,4),  // A wins home; C loses away
 make('w3','a','c',1,5),  // C wins home; A loses away
 make('playoff','b','a',0,9,'playoffs'),  // Does not affect regular home W-L
 {id:'not-released',away:'b',home:'c',phase:'regular',stage:'recorded',startsAt:null}
]};
assert.equal(matchupType(season,season.games[0]),'In Conference Matchup');
assert.equal(matchupType(season,season.games[1]),'Out of Conference Matchup');
assert.equal(matchupType({teams:[{id:'a'},{id:'b'}]},season.games[0]),'Conference Pending');
const rows=Object.fromEntries(standings(season).map(t=>[t.id,t]));
assert.deepEqual([rows.a.wins,rows.a.losses],[2,1]);
assert.deepEqual([rows.a.homeWins,rows.a.homeLosses],[1,0]);
assert.deepEqual([rows.a.awayWins,rows.a.awayLosses],[1,1]);
assert.deepEqual([rows.b.homeWins,rows.b.homeLosses],[0,1]);
assert.deepEqual([rows.c.homeWins,rows.c.homeLosses],[1,0]);
assert.deepEqual([rows.c.awayWins,rows.c.awayLosses],[0,1]);
assert.equal(rows.a.runsFor,11,'Playoff scoring must not count in regular-season standings');
assert.equal(rows.a.homeWins+rows.a.awayWins,rows.a.wins);
assert.equal(rows.a.homeLosses+rows.a.awayLosses,rows.a.losses);
console.log('PASS: conference labels, cumulative home/away W-L, unreleased & playoff exclusion');
