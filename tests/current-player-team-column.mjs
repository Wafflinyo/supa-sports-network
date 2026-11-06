import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerCurrentTeamName} from '../src/player-current-team.js';

// Current team must be derived from the SELECTED season's live rosters,
// not the last reported match, original draft team, or stale metadata.
const teams=[
  {id:'dolphins',name:'Delfino Dolphins'},
  {id:'knights',name:'New Donk City Knights'}
];
const season={status:'regular',teams,rosters:{dolphins:[55,'39'],knights:[71]}};
assert.equal(playerCurrentTeamName(season,55),'Delfino Dolphins');
assert.equal(playerCurrentTeamName(season,'39'),'Delfino Dolphins',
  'Player IDs may come through the season store as strings');
assert.equal(playerCurrentTeamName(season,71),'New Donk City Knights');
assert.equal(playerCurrentTeamName(season,100),'Free Agent');
assert.equal(playerCurrentTeamName({...season,status:'drafting'},100),'Undrafted');
assert.equal(playerCurrentTeamName(null,55),'Unassigned');

// A trade or roster release changes the displayed team immediately.
const afterTrade={...season,rosters:{dolphins:['39'],knights:[71,55]}};
assert.equal(playerCurrentTeamName(afterTrade,55),'New Donk City Knights');
assert.equal(playerCurrentTeamName(season,55),'Delfino Dolphins');
assert.equal(playerCurrentTeamName({...afterTrade,rosters:{dolphins:['39'],knights:[71]}},55),
  'Free Agent');
assert.equal(playerCurrentTeamName({...season,teams:[...teams].reverse()},55),'Delfino Dolphins',
  'Franchise order does not change assignments');

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const archive=readFileSync(new URL('../src/HistoryArchive.jsx',import.meta.url),'utf8');
const preseason=readFileSync(new URL('../src/PreseasonStats.jsx',import.meta.url),'utf8');
assert(main.includes('team:playerCurrentTeamName(seasonLeague.season,p.id)'),
  'Regular Player Stats must use the selected season roster');
assert(main.includes("['name','PLAYER'],['team','CURRENT TEAM'],['class','CLASS']"),
  'CURRENT TEAM must be beside PLAYER before CLASS in each stat category');
assert(main.includes('<td className="player-team-cell">{p.team}</td>'),
  'Regular Player Stats body must display the live current team');
assert(main.includes('${p.name} ${p.class} ${p.team}'),
  'Searching Player Stats by club name must be supported');
assert(main.includes("!['id','class','team'].includes(key)"),
  'Current Team header must not be formatted as a numeric stat');
assert(main.includes('<col style={{width:230}}/><col style={{width:270}}/><col style={{width:120}}/>'),
  'Team names must have a readable dedicated table column');
assert(archive.includes('Season Team')&&archive.includes('playerCurrentTeamName(season,id)'),
  'Archived Player Stats must label historical roster teams, not live current teams');
assert(preseason.includes('row.teamName'),
  'Preseason player statistics must retain their existing game-report team column');
console.log('PASS: live and archived Player Stats show sortable roster team columns with trade/release updates');
