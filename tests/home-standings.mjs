import assert from 'node:assert/strict';
import fs from 'node:fs';
import {standings} from '../src/season-data.js';

// Home must use the exact Overall standings engine, including all teams with
// no games, and must never condition the display on a completed game.
const season={
  teams:Array.from({length:12},(_,index)=>({
    id:'t'+index,name:'SSL Club '+index,conference:index<6?'supa':'galaxy',
  })),
  games:[],
};
const rows=standings(season);
assert.equal(rows.length,12,'All registered teams must appear before the season starts');
assert(rows.every(team=>team.wins===0&&team.losses===0&&team.pct===0));
assert(rows.every(team=>team.runsFor===0&&team.runsAgainst===0));
const read=fs.readFileSync('src/HomeDashboard.jsx','utf8');
assert.match(read,/table\.map\(\(team,index\)=>/,'Home standings must render every Overall row');
assert.match(read,/<ConferenceMark id=\{team\.conference\}/,'Home standings must carry conference logos');
assert.match(read,/\{team\.wins\}–\{team\.losses\}/,'W-L should be shown before games');
assert(!read.includes('hasFinal?'),'Standings must not disappear when no game is final');

// Imported/private game sheets do not change records; published finals do.
season.games.push({id:'private',stage:'recorded',phase:'regular',away:'t0',home:'t1',
  result:{scores:{t0:7,t1:6}}});
assert(standings(season).every(team=>team.wins===0&&team.losses===0));
season.games[0].stage='final';
const after=standings(season);
assert.equal(after.length,12);
assert.equal(after[0].id,'t0');
assert.equal(after[0].wins,1);
assert.equal(after.find(team=>team.id==='t1').losses,1);
console.log('PASS: all 12 Overall standings visible at 0-0, ordered like full standings and respecting private releases.');
