import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
// Guard the deployed SQL publication path, not only its frontend projection.
// A previously generated 132-game slate intentionally starts with no dates.
const migration=readFileSync(new URL('../supabase/migrations/20261029181000_ssl_publish_undated_fantasy_locks.sql',import.meta.url),'utf8');
assert(migration.includes("g->>'startsAt' is null"),'publishing must skip undated games in fantasy lock sync');
assert(migration.includes("if coalesce((st->>'schedulePublished')::boolean,false) then"),
  'subsequent dated matchups synchronize locks after public publication');
assert(migration.includes('execute replace(core_src,old_core,new_core)')&&
  migration.includes('execute replace(calendar_src,old_calendar,new_calendar)'),
  'migration should patch only existing calendar/lock functions');

console.log('PASS: public undated fixtures and DB fantasy locks skip TBD matchups; assigning dates activates locks');
