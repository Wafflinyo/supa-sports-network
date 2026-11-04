import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {upcomingLineupReminderGames,GAME_LINEUP_REMINDER_WINDOW_MS} from '../src/roster-lineups.js';
import {buildLeagueAlerts} from '../src/league-alerts.js';

// Regression for Diamond City Checkers: 14 players, saved default, 22 public
// regular-season matchups with TBD dates and some explicitly submitted lineups.
const now=Date.parse('2026-11-04T03:00:00Z');
const date=delta=>new Date(now+delta).toISOString();
const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const roster=Array.from({length:14},(_,i)=>i+1);
const valid={starters:roster.slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:roster.slice(9)};
const team={id:'checkers',name:'Diamond City Checkers'};
const games=Array.from({length:22},(_,i)=>({
  id:'g'+(i+1),phase:'regular',stage:'scheduled',away:'checkers',home:'other',
  startsAt:null,lineups:{},lineupSubmission:{},
}));
games[0].lineups.checkers=structuredClone(valid);
games[0].lineupSubmission.checkers={source:'default',by:'gm'};
games[1].lineups.checkers=structuredClone(valid);
const postdraft={
  id:'season-1',status:'postdraft',schedulePublished:true,
  teams:[team,{id:'other',name:'Opponent'}],
  rosters:{checkers:roster},defaults:{checkers:valid},
  games,needsDefault:['checkers'],picks:[],order:[],
};
const args={season:postdraft,myTeam:team,role:'gm',now};
const noGameAlert=season=>buildLeagueAlerts({...args,season}).filter(a=>a.id.includes(':game-lineup:'));
assert.deepEqual(upcomingLineupReminderGames(postdraft,team.id,now),[],
  'Published season with 22 TBD games must not show action banner');
assert.deepEqual(noGameAlert(postdraft),[],
  'TBD games must not raise lineup bell tasks');
const regular={...postdraft,status:'regular'};
assert.deepEqual(upcomingLineupReminderGames(regular,team.id,now),[],
  'The active season still cannot prompt for undated fixtures');
assert.deepEqual(noGameAlert(regular),[],'No reminders for active-season TBD games');
assert(!buildLeagueAlerts(args).some(a=>a.id.includes(':default-lineup')),
  'Valid saved default resolves postdraft default-lineup reminder despite stale needsDefault');

const imminent={...games[2],startsAt:date(2*24*60*60*1000)};
const withGame={...regular,games:[...games.slice(0,2),imminent,...games.slice(3)]};
assert.deepEqual(upcomingLineupReminderGames(withGame,team.id,now).map(g=>g.id),['g3'],
  'Only a dated, imminently upcoming, unsubmitted game is actionable');
assert.equal(noGameAlert(withGame).length,1);
const submitted={...withGame,games:withGame.games.map(g=>g.id==='g3'
  ?{...g,lineups:{checkers:valid},lineupSubmission:{checkers:{source:'custom',by:'gm'}}}
  :g)};
assert.deepEqual(upcomingLineupReminderGames(submitted,team.id,now),[],
  'Saving that game lineup removes the action banner');
assert.deepEqual(noGameAlert(submitted),[],
  'Saving that game lineup clears the reminder notification');

for(const [label,change] of [
  ['no date',{startsAt:null}],
  ['invalid date',{startsAt:'Not set'}],
  ['past game',{startsAt:date(-1000)}],
  ['beyond week',{startsAt:date(GAME_LINEUP_REMINDER_WINDOW_MS+1000)}],
  ['completed game',{stage:'final'}],
  ['locked game',{lockedAt:date(-3600000)}],
]){
  const changed={...withGame,games:withGame.games.map(g=>g.id==='g3'?{...g,...change}:g)};
  assert.deepEqual(upcomingLineupReminderGames(changed,team.id,now),[],label+' cannot make an ACTIONS NEEDED prompt');
}
assert.deepEqual(upcomingLineupReminderGames({...withGame,schedulePublished:false},team.id,now),[],
  'Unpublished schedules cannot trigger reminders');
assert.deepEqual(upcomingLineupReminderGames({...withGame,status:'postdraft'},team.id,now),[],
  'Postdraft phase has no editable regular season game lineups');
assert.deepEqual(upcomingLineupReminderGames(withGame,'another-team',now),[],
  'Do not show other teams personal lineup tasks');
const seasonUI=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
assert.match(seasonUI,/upcoming = upcomingLineupReminderGames\(s, t\.id, l\.now\)\[0\] \|\| null/,
  'ACTIONS NEEDED must use the filtered scheduled upcoming fixtures, not scan all TBD games');
const bellUI=readFileSync(new URL('../src/league-alerts.js',import.meta.url),'utf8');
assert.match(bellUI,/upcomingLineupReminderGames\(season,teamId,now\)/,
  'Bell and action banner must use the same exact eligibility rules');
console.log('PASS: 22 TBD games cannot trigger banners; saved/submitted lineups resolve tasks; only upcoming dated editable games within 7 days create reminders.');
