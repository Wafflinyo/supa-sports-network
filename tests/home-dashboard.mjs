import assert from 'node:assert/strict';
import {homeWeekBoard,homeRecentResults} from '../src/home-dashboard-data.js';

const now=Date.parse('2026-11-03T18:00:00Z');
const ancient=Date.parse('2026-01-01T12:00:00Z');
const scores={a:7,b:6};
const fixtures=(week)=>Array.from({length:6},(_,index)=>({
  id:`week${week}-${index}`,phase:'regular',week,away:'a',home:'b',
  startsAt:null,stage:'scheduled',
}));
const first=fixtures(1), second=fixtures(2), third=fixtures(3);
const season={schedulePublished:true,games:[...first,...second,...third]};
const release=(week,index,when=now)=>{
  const offset=(week-1)*6+index;
  season.games[offset]={...season.games[offset],stage:'final',
    releasedAt:new Date(when).toISOString(),result:{scores}};
};

let board=homeWeekBoard(season);
assert.equal(board.week,1);
assert.equal(board.total,6);
assert.equal(board.games.length,6);
assert.deepEqual(board.games.map(g=>g.id),first.map(g=>g.id),'Keep original matchup order with TBD dates');

season.games[0]={...first[0],stage:'recorded',result:{scores}};
assert.equal(homeWeekBoard(season).week,1,'Private upload must not advance schedule');
assert.equal(homeRecentResults(season).length,0,'Private upload must not leak into recent results');

release(1,0,ancient);
assert.equal(homeWeekBoard(season).week,1);
assert.equal(homeWeekBoard(season).games.length,5,'Released game leaves upcoming matchups');
assert.deepEqual(homeRecentResults(season).map(g=>g.id),['week1-0'],
  'Released scores persist even when older than 24 hours');

for(let i=1;i<6;i++)release(1,i,ancient+i*1000);
board=homeWeekBoard(season);
assert.equal(board.week,2,'Last Week 1 result must advance immediately to Week 2');
assert.equal(board.games.length,6);
assert.equal(homeRecentResults(season).length,6,'All six Week 1 finals remain visible');
assert(homeRecentResults(season).every(g=>g.week===1));

season.games[6]={...second[0],stage:'recorded',result:{scores}};
assert.equal(homeWeekBoard(season).week,2);
assert(homeRecentResults(season).every(g=>g.week===1),
  'Week 1 results remain until Week 2 results are PUBLICLY released');

release(2,0,now);
assert.equal(homeWeekBoard(season).week,2);
assert.equal(homeWeekBoard(season).games.length,5);
assert.deepEqual(homeRecentResults(season).map(g=>g.id),['week2-0'],
  'First Week 2 final replaces Week 1 in Recent Results');

for(let i=1;i<6;i++)release(2,i,now+i*1000);
assert.equal(homeWeekBoard(season).week,3,'Last Week 2 release must show Week 3 immediately');
assert.equal(homeWeekBoard(season).games.length,6);
assert.equal(homeRecentResults(season).length,6);
assert(homeRecentResults(season).every(g=>g.week===2));
assert.deepEqual(homeRecentResults(season,3).map(g=>g.id),
  ['week2-5','week2-4','week2-3'],'Optional smaller limit stays newest first');

// Ensure later rounds can also appear, without disappearing after 24 hours.
for(let i=0;i<6;i++)release(3,i,now+i*1000);
assert.equal(homeWeekBoard(season).games.length,0,'Completed season has no fake upcoming games');
assert.equal(homeRecentResults(season).length,6,'Final regular-season week remains in recent results');
assert(homeRecentResults(season).every(g=>g.week===3));
assert.equal(homeWeekBoard({...season,schedulePublished:false}).games.length,0);

// Playoffs should not be omitted from the recent results once they are released.
season.games.push({id:'postseason-1',phase:'postseason',stage:'final',
  away:'a',home:'b',releasedAt:new Date(now+100000).toISOString(),result:{scores}});
assert.deepEqual(homeRecentResults(season).map(g=>g.id),['postseason-1']);
console.log('PASS: immediate week rollover, six persistent latest-week results, private embargo and postseason results');
