import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stadiumDraftState} from '../src/draft-stadium-state.js';
import {elapsed} from '../src/season-data.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const draft=read('src/DraftPlayers.jsx');
const room=read('src/SeasonLeague.jsx');
const migration=read('supabase/migrations/20261028033500_ssl_pause_timer_not_picks.sql');

const currentTeam='on-clock';
const season={
 status:'drafting',paused:true,
 nextPick:{team:currentTeam,round:4,supplemental:false,stageAlreadyChosen:false,mustStage:false},
 picks:[],retainedStadiums:{},pickElapsed:73,pickStartedAt:'2026-10-28T02:00:00.000Z',
};
assert.equal(elapsed(season,Date.parse('2026-10-28T12:00:00Z')),73,
  'paused timer must not accrue overnight hours in the Draft Room');
assert.equal(stadiumDraftState(season,currentTeam,true).eligible,true,
  'on-clock GM must still be able to choose a Stadium while timer is paused');
assert.equal(stadiumDraftState(season,'different-team',false).eligible,false,
  'timer pause never overrides the original owner of the current turn');
season.paused=false;
assert.equal(elapsed({...season,pickStartedAt:'2026-10-28T12:00:00Z'},Date.parse('2026-10-28T12:00:21Z')),94,
  'resumed timer continues accumulated active seconds');
assert.equal(stadiumDraftState(season,currentTeam,true).eligible,true);

assert(draft.includes("const canPick=s.status==='drafting'&&(l.access.role==='commissioner'||(l.access.role==='gm'&&l.myTeam?.id===owner));"),
  'draft availability must still respect on-clock GM and commissioner and no longer block paused timer');
assert(draft.includes("PICK TIMER PAUSED:")&&draft.includes("Recorded pick times do not increase"),
  'draft page must explain paused timer with picks open');
assert(draft.includes("l.act('pick',{player:selected.id})")&&draft.includes("l.act('pick_stage',{stage:selectedStadium})"),
  'player and Stadium picks still use the existing authenticated server actions');
assert(room.includes('"} TIMER')&&room.includes('onClick={() => l.act("pause")}'),
  'the commissioner button should toggle the existing pause action as a TIMER control');
assert(room.includes('"TIMER PAUSED · PICKS STILL OPEN"'), 'paused clock label cannot imply draft is closed');
assert(migration.includes("next_definition := replace(source_definition,old_guard,new_guard);"));
assert(migration.includes("next_definition := replace(next_definition,old_seconds,new_seconds);"));
assert(migration.includes("then 0 else greatest(0,extract(epoch from now()"),
  'server must exclude wall-clock time for paused picks');
assert(migration.includes("if st->>'status'<>'drafting' then raise exception 'Draft is not open';end if;"),
  'the server must continue checking active draft state without rejecting paused timing');
assert(!/\bupdate\s+league_private\.ssl_season_states|\bdelete\s+from\s+league_private\.ssl_season_states/i.test(migration),
  'migration must not update live draft records');
console.log('PASS: timer pause leaves Player/Stadium picks open; active seconds only; commissioner & GM pick ownership unchanged');
