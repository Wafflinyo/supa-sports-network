import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  orderedDraftPickTeams,teamsInLotteryOrder,lotteryOrderReady,draftRoundQueue
} from '../src/draft-pick-stats-order.js';
import {lotteryDuration} from '../src/lottery-timing.js';

const begin='2026-10-27T15:30:00.000Z';
const when=ms=>Date.parse(begin)+ms;
const teams=Array.from({length:12},(_,i)=>({id:'team-'+(i+1),name:'Franchise '+(i+1)}));
// Deliberately scramble lottery order to catch registration-order regressions.
const order=[teams[6],teams[1],teams[9],teams[4],teams[11],teams[2],
  teams[8],teams[0],teams[5],teams[10],teams[3],teams[7]].map(t=>t.id);
const season={number:1,status:'scheduled',teams,order,lotteryAt:begin,
  picks:[],currentPickAssets:[],retainedStadiums:{}};
const before=orderedDraftPickTeams(season,when(-301000));
assert.deepEqual(before.map(x=>x.team.id),teams.map(t=>t.id),
  'before lottery show the existing registration list, never hidden results');
assert(before.every(x=>x.lotteryPosition===null));
assert.equal(lotteryOrderReady(season,when(0)),false,
  'the server has already saved the order but the curtain is still opening');
assert.equal(lotteryOrderReady(season,when(23200)),false,
  'cannot display whole order during ongoing ball announcements');
assert.deepEqual(teamsInLotteryOrder(season,when(23200)).map(t=>t.id),
  teams.map(t=>t.id),'no early spoiler in any team list');
const revealed=when(lotteryDuration(12));
assert.equal(lotteryOrderReady(season,revealed),true);
assert.equal(lotteryOrderReady(season,new Date(revealed).toISOString()),true,
  'the public read payload carries an ISO serverNow timestamp');
assert.deepEqual(orderedDraftPickTeams(season,revealed).map(x=>x.team.id),
  order,'pick-times chart shows exact actual lottery sequence');
assert.deepEqual(orderedDraftPickTeams(season,revealed).map(x=>x.lotteryPosition),
  Array.from({length:12},(_,i)=>i+1));
assert.deepEqual(teamsInLotteryOrder(season,revealed).map(t=>t.id),order);
assert.equal(draftRoundQueue(season,1,when(23200)).length,0,
  'do not reveal draft board before the last ball');
let queue=draftRoundQueue(season,1,revealed);
assert.deepEqual(queue.map(x=>x.pickingTeam.id),order);
assert.deepEqual(queue.map(x=>x.roundPosition),Array.from({length:12},(_,i)=>i+1));
assert.deepEqual(queue.map(x=>x.cursor),Array.from({length:12},(_,i)=>i));
assert(queue.every(x=>x.status==='upcoming'));
queue=draftRoundQueue(season,2,revealed);
assert.deepEqual(queue.map(x=>x.pickingTeam.id),[...order].reverse(),
  'Round 2 reverses the entire original lottery order');
assert.deepEqual(queue.map(x=>x.cursor),Array.from({length:12},(_,i)=>i+12));
assert.deepEqual(draftRoundQueue(season,3,revealed).map(x=>x.pickingTeam.id),order,
  'Round 3 restores lottery order');
assert.deepEqual(draftRoundQueue(season,4,revealed).map(x=>x.pickingTeam.id),[...order].reverse(),
  'Round 4 is reversed');

season.currentPickAssets=[
 {round:1,originalTeam:order[0],owner:order[8]},
 {round:2,originalTeam:order[11],owner:order[3]},
];
queue=draftRoundQueue(season,1,revealed);
assert.equal(queue[0].pickingTeam.id,order[8],
  'traded opening pick is attributed to CURRENT owner (not lottery original)');
assert.equal(queue[0].originalTeam.id,order[0]);
assert.equal(queue[0].transferred,true);
assert.equal(draftRoundQueue(season,2,revealed)[0].pickingTeam.id,order[3],
  'traded Round 2 pick ownership remains correct');
season.status='drafting';
season.nextPick={cursor:0,round:1,team:order[8],mustStage:false};
queue=draftRoundQueue(season,1,revealed);
assert.equal(queue[0].status,'on-clock');
assert.equal(queue[0].isCurrent,true);
season.picks=[{cursor:0,number:1,round:1,team:order[8],kind:'player',player:6}];
season.nextPick={cursor:1,round:1,team:order[1],mustStage:false};
queue=draftRoundQueue(season,1,revealed);
assert.equal(queue[0].status,'picked','picked slots are marked complete');
assert.equal(queue[1].status,'on-clock','the next team is visibly on the clock');
assert.equal(queue[1].pickingTeam.id,order[1]);
season.retainedStadiums={[order[11]]:['Luigi’s Mansion']};
queue=draftRoundQueue(season,12,revealed);
assert.equal(queue.length,11,'retained stadium entitlement is skipped in Round 12');
assert(!queue.some(q=>q.originalTeam.id===order[11]));
assert.equal(draftRoundQueue(season,13,revealed).length,0);
assert.equal(draftRoundQueue(season,0,revealed).length,0);
const bad={...season,order:[...order.slice(0,11),order[0]]};
assert.equal(lotteryOrderReady(bad,revealed),false,'do not show invalid saved lottery order');
assert.deepEqual(teamsInLotteryOrder(bad,revealed).map(t=>t.id),teams.map(t=>t.id));

const page=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/DraftOrderBoard.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/draft-order-board.css',import.meta.url),'utf8');
assert(page.includes('pickTimeTeams.map(({team:t,lotteryPosition})'),
  'pick-times and average pick times must follow saved lottery order');
assert(page.includes('<DraftOrderBoard league={l}/>'),'Draft Room must display full live order');
assert(page.includes('drawRevealed&&<DraftOrderBoard'),'never show actual order until completely revealed');
assert(page.includes('teamsInLotteryOrder(s,s?.serverNow)'),
  'other league team lists must match lottery sequence');
assert(view.includes('draftRoundQueue(season,activeRound,l.now)'));
assert(view.includes('ON THE CLOCK')&&view.includes('TRADED FROM'),
  'the visible round board must indicate current and transferred picks');
assert(view.includes('Round {i+1}'),'GM can inspect any round and its snake order');
assert(css.includes('.ssl-draft-queue-item.status-on-clock'));
assert(css.includes('@media(max-width:750px)'));
console.log('PASS: all team lists follow saved lottery after final reveal, on-clock and traded-pick snake queue matches server');
