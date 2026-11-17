import assert from 'node:assert/strict';
import {potwLeaderboard,potwPlayerGames} from '../src/player-of-the-week.js';
import {conferencePotwStory} from '../src/conference-potw-story.js';
import {gamePointsForReport} from '../src/game-points.js';

const teams=[
 {id:'haliban',name:'Moleville Haliban',conference:'supa'},
 {id:'knights',name:'New Donk City Knights',conference:'supa'},
 {id:'opposition',name:'Opposition',conference:'galaxy'}
];
function game(id,week,home,away,team,stats){
 return {id,week,phase:'regular',stage:'final',home,away,
   releasedAt:'2026-11-'+String(week+1).padStart(2,'0')+'T12:00:00Z',
   result:{scores:{[home]:5,[away]:2},players:[
     {team,player:59,stats,itemScore:0,shutoutBonus:0}
   ]}};
}
const week3=game('week3',3,'haliban','opposition','haliban',{
 homeRuns:1,rbi:2,runs:1,hits:2,atBats:4,putouts:2,assists:1
});
const week4=game('week4',4,'knights','opposition','knights',{
 homeRuns:2,rbi:3,runs:2,hits:3,atBats:4,putouts:1,assists:2
});
const older=game('old',2,'haliban','opposition','haliban',{
 homeRuns:12,rbi:15,runs:10,hits:10,atBats:11
});
const season={id:'kritter-trade',teams,rosters:{
 haliban:[],knights:[59],opposition:[10]
},games:[older,week3,week4]};
assert.deepEqual(potwPlayerGames(season,2,59).map(g=>g.id),['week3','week4'],
 'The two award games must follow Kritter across teams');
const kritter=potwLeaderboard(season,2).find(row=>row.id===59);
assert(kritter,'Current Knights roster must keep Kritter eligible');
assert.equal(kritter.team,'knights','Award attribution stays with the current team');
assert.equal(kritter.conference,'supa');
assert.equal(kritter.gamesPlayed,2);
assert.deepEqual(kritter.gameIds,['week3','week4']);
assert.equal(kritter.stats.homeRuns,3);
assert.equal(kritter.stats.rbi,5);
assert.equal(kritter.stats.runs,3);
assert.equal(kritter.stats.hits,5);
assert.equal(kritter.stats.atBats,8);
const expectedPoints=[week3,week4].reduce((n,g)=>
 n+gamePointsForReport(g.result.players[0]).tgp,0);
assert.equal(kritter.stats.tgp,Math.round(expectedPoints*100)/100);
const award={roundNo:2,player:59,team:'knights',
 teamName:'New Donk City Knights',awardTitle:'Supa Mario Player of the Week'};
const story=conferencePotwStory(season,award);
assert.equal(story.stats.gamesPlayed,2,'The award article must count both performances');
assert.equal(story.stats.totalGamePoints,kritter.stats.tgp);
assert.match(story.detail,/Moleville Haliban/);
assert.match(story.detail,/New Donk City Knights/);
assert.match(story.detail,/3 home runs/);
assert.match(story.detail,/5 runs/);
assert.doesNotMatch(story.detail,/Knights scored .* total .* over its last two games/,
 'Pre-trade stats must not be attributed exclusively to the new franchise');

// A rescheduled third game should not leak into the two-game award limit.
const extra=game('late-week4',4,'knights','opposition','knights',{
 homeRuns:1,rbi:1,runs:1,hits:1,atBats:4
});
extra.releasedAt='2026-11-07T12:00:00Z';
const rescheduled={...season,games:[older,week3,week4,extra]};
assert.deepEqual(potwPlayerGames(rescheduled,2,59).map(g=>g.id),
 ['week4','late-week4']);
assert.equal(potwLeaderboard(rescheduled,2).find(row=>row.id===59).stats.homeRuns,3);
console.log('PASS: POTW combines Kritter two games across trades, retains current-team trophy ownership, and keeps headline totals honest.');
