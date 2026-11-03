import assert from 'node:assert/strict';
import {homeWeekBoard,homeRecentResults,HOME_RESULT_WINDOW_MS,newlyReleased} from '../src/home-dashboard-data.js';
const now=Date.parse('2026-11-03T18:00:00Z');
const scores={a:7,b:6};
const fixtures=Array.from({length:6},(_,i)=>({id:'week1-'+i,phase:'regular',week:1,
  away:'a',home:'b',startsAt:null,stage:'scheduled'}));
const next=Array.from({length:6},(_,i)=>({id:'week2-'+i,phase:'regular',week:2,
  away:'a',home:'b',startsAt:null,stage:'scheduled'}));
const season={schedulePublished:true,games:[...fixtures,...next]};
let board=homeWeekBoard(season,now);
assert.equal(board.week,1);
assert.equal(board.total,6);
assert.equal(board.games.length,6,'All six Week 1 fixtures must appear without dates');
assert.deepEqual(board.games.map(g=>g.id),fixtures.map(g=>g.id),'Respect original generated schedule order');
season.games[0]={...fixtures[0],stage:'recorded',result:{scores}};
board=homeWeekBoard(season,now);
assert.equal(board.week,1);
assert.equal(board.games[0].stage,'recorded','Uploading a private result cannot make the game final');
assert.equal(homeRecentResults(season).length,0,'Private results never leak into recent results');
season.games[0]={...fixtures[0],stage:'final',releasedAt:new Date(now-1000).toISOString(),result:{scores}};
assert(newlyReleased(season.games[0],now));
assert.equal(homeWeekBoard(season,now).games.length,6,'Released game remains in Week 1 panel');
assert.equal(homeRecentResults(season).length,1);
const older=now-HOME_RESULT_WINDOW_MS-1;
season.games[0].releasedAt=new Date(older).toISOString();
assert.equal(homeWeekBoard(season,now).games.length,5,'Older finals vanish while unfinished games remain');
for(let i=0;i<6;i++)season.games[i]={...fixtures[i],stage:'final',
  releasedAt:new Date(now-1000).toISOString(),result:{scores}};
board=homeWeekBoard(season,now);
assert.equal(board.week,1,'Completed week remains visible through grace period');
assert.equal(board.games.length,6);
board=homeWeekBoard(season,now+HOME_RESULT_WINDOW_MS);
assert.equal(board.week,2,'Next week automatically appears after 24h');
assert.equal(board.games.length,6);
for(let i=6;i<12;i++)season.games[i]={...next[i-6],stage:'final',
  releasedAt:new Date(now-HOME_RESULT_WINDOW_MS-5000).toISOString(),result:{scores}};
assert.equal(homeWeekBoard(season,now).week,1,'Recent Week 1 finals can still appear after all later games end');
assert.equal(homeWeekBoard(season,now+HOME_RESULT_WINDOW_MS).games.length,0,'Finished season has no phantom upcoming matches');
assert.equal(homeWeekBoard({...season,schedulePublished:false},now).games.length,0);
console.log('PASS: six live week fixtures, private upload privacy, 24-hour released-score window and automatic next-week rollover');
