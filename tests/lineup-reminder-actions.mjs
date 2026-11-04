import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homeWeekBoard} from '../src/home-dashboard-data.js';
import {currentWeekLineupMatchup} from '../src/roster-lineups.js';
import {buildLeagueAlerts} from '../src/league-alerts.js';
import {unseenLeagueAlertIds,acknowledgedLeagueAlertIds} from '../src/league-notification-state.js';

const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const roster=Array.from({length:14},(_,i)=>i+1);
const valid={starters:roster.slice(0,9).map((player,i)=>({player,position:positions[i]})),bench:roster.slice(9)};
const team={id:'checkers',name:'Diamond City Checkers'};
const opponents=Array.from({length:6},(_,i)=>({id:'o'+i,name:'Opponent '+i}));
const games=Array.from({length:22},(_,week)=>Array.from({length:6},(_,i)=>({
  id:'w'+(week+1)+'-'+i,phase:'regular',week:week+1,
  stage:'scheduled',away:i===0?'checkers':'o'+i,home:'o0',
  startsAt:null,lineups:{},lineupSubmission:{},
}))).flat();
const season={
  id:'season-1',status:'regular',schedulePublished:true,
  teams:[team,...opponents],rosters:{checkers:roster},
  defaults:{checkers:valid},games,needsDefault:[],
};
const args={season,myTeam:team,role:'gm',now:Date.now()};
const alerts=s=>buildLeagueAlerts({...args,season:s}).filter(a=>a.id.includes(':game-lineup-week:'));

assert.equal(homeWeekBoard(season).week,1);
assert.equal(currentWeekLineupMatchup(season,team.id).week,1);
const first=alerts(season);
assert.equal(first.length,1,'exactly one weekly bell alert, not one for each of the 22 scheduled dates');
assert.equal(first[0].id,'season-1:game-lineup-week:1:checkers');
assert.equal(first[0].canUseDefault,true,'GM can submit saved default from bell on an undated matchup');
assert(first[0].detail.includes('Week 1'));
assert(!first[0].detail.includes('TBD'),'no dates or TBD deadlines in bell');
const acknowledged=acknowledgedLeagueAlertIds([],first.map(a=>a.id));
assert.deepEqual(unseenLeagueAlertIds(first,acknowledged),[],'opening bell hides the weekly alert');

const saved={...season,games:season.games.map(g=>g.id==='w1-0'
  ?{...g,lineups:{checkers:valid},lineupSubmission:{checkers:{source:'default',by:'gm'}}}
  :g)};
assert.equal(alerts(saved)[0].id,first[0].id,'saving game lineup must not issue a second weekly notification');
assert.equal(alerts(saved)[0].type,'announcement');
assert.deepEqual(unseenLeagueAlertIds(alerts(saved),acknowledged),[]);
const partly={...season,games:season.games.map(g=>g.id==='w1-2'?{...g,stage:'recorded'}:g)};
assert.equal(homeWeekBoard(partly).week,1,'private upload cannot advance upcoming week');
assert.equal(alerts(partly)[0].id,first[0].id);
const ended={...season,games:season.games.map(g=>g.week===1?{...g,stage:'final'}:g)};
assert.equal(homeWeekBoard(ended).week,2,'all six released Week 1 finals automatically reveal Week 2');
const second=alerts(ended);
assert.equal(second.length,1);
assert.equal(second[0].id,'season-1:game-lineup-week:2:checkers');
assert.deepEqual(unseenLeagueAlertIds(second,acknowledged),[second[0].id],
  'new week creates a fresh notification after Week 1 was already viewed');
const afterW2={...ended,games:ended.games.map(g=>g.week===2?{...g,stage:'final'}:g)};
assert.equal(homeWeekBoard(afterW2).week,3);
assert.equal(alerts(afterW2)[0].id,'season-1:game-lineup-week:3:checkers');
const postseason={...season,status:'postseason'};
assert.equal(currentWeekLineupMatchup(postseason,team.id).week,1);
const beforeSchedule={...season,schedulePublished:false};
assert.equal(currentWeekLineupMatchup(beforeSchedule,team.id),null);
assert.equal(alerts(beforeSchedule).length,0);

const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert(!main.includes('<SeasonPrompts'),'No persistent ACTIONS NEEDED banner appears on website');
const bell=readFileSync(new URL('../src/LeagueNotifications.jsx',import.meta.url),'utf8');
assert.match(bell,/setVisibleIds\(unseen\);\s*markRead\(unseen\);\s*setOpen\(true\);/,
  'bell opening acknowledges new week immediately');
assert(!bell.includes('Date.parse(game.startsAt)'),'one-tap default ignores nonexistent dates');
const schedule=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
assert(!schedule.includes('DATE & TIME TBD'),'no date placeholders in the game schedule');
assert(!schedule.includes('GameDateEditor'),'there is no game-date editor');
assert.match(schedule,/PREVIEW PRIVATE GAME REPORT/);
console.log('PASS: undated Week 1 bell once, acknowledgment, unchanged submission, Week 2/3 turnover, no page banner or date requirement, commissioner private preview.');
