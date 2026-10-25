import assert from 'node:assert/strict';
import {fantasyGames} from '../src/season-data.js';
const season={id:'S1',schedulePublished:true,games:[
  {id:'week-1',phase:'regular',stage:'scheduled',startsAt:null},
  {id:'week-2',phase:'regular',stage:'scheduled',startsAt:'2026-11-08T19:00:00Z'},
  {id:'week-3',phase:'regular',stage:'scheduled'}
]};
const games=fantasyGames([season]);
assert.deepEqual(games.map(g=>g.id),['ssl:week-2'],'Fantasy fixtures must never expose undated games to a timestamp-backed roster');
season.games[0].startsAt='2026-11-01T19:00:00Z';
assert.deepEqual(fantasyGames([season]).map(g=>g.id),['ssl:week-1','ssl:week-2']);
console.log('PASS: public undated league fixtures do not create invalid fantasy dates; dates become active after update');
