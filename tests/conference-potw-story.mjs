import assert from 'node:assert/strict';
import {potwLeaderboard,potwTeamGames} from '../src/player-of-the-week.js';
import {conferencePotwStory} from '../src/conference-potw-story.js';
const teams=[
 {id:'haliban',name:'Moleville Haliban',conference:'supa'},
 {id:'opposition',name:'Peach Gardens',conference:'supa'},
 {id:'galaxy',name:'Galaxy Knights',conference:'galaxy'}
];
function makeGame(id,week,home,away,hs,as,rows,stage='final'){
 return {id,phase:'regular',week,home,away,stage,releasedAt:'2026-11-'+String(week+1).padStart(2,'0')+'T10:00:00Z',
  result:{scores:{[home]:hs,[away]:as},players:rows.map(([team,player,stats])=>({
   team,player,stats,itemScore:0,shutoutBonus:0
  }))}};
}
const w=(hr,rbi,runs,hits,ab)=>['haliban',11,{homeRuns:hr,rbi,runs,hits,atBats:ab}];
const other=['opposition',10,{homeRuns:1,rbi:1,hits:2,atBats:5}];
const season={
 id:'test',number:1,name:'Season 1',teams,
 rosters:{haliban:[11],opposition:[10],galaxy:[2]},
 games:[
  // Older games are ineligible for Weeks 3/4, regardless of record size.
  makeGame('old1',1,'haliban','opposition',18,4,[w(10,30,12,10,11),other]),
  makeGame('old2',2,'haliban','opposition',13,4,[w(2,5,3,5,6),other]),
  makeGame('new1',3,'haliban','opposition',8,9,[w(2,5,2,4,4),other]),
  makeGame('new2',4,'haliban','opposition',8,10,[w(2,4,2,3,4),other]),
  makeGame('unreleased',4,'galaxy','opposition',10,1,[['galaxy',2,{homeRuns:50}]],'recorded'),
  makeGame('future',5,'haliban','opposition',30,0,[w(12,30,20,10,11),other]),
 ]
};
const rows=potwLeaderboard(season,2),row=rows.find(r=>r.id===11);
assert(row,'Wario is rostered for Supa Mario');
assert.equal(row.gamesPlayed,2);
assert.equal(row.stats.homeRuns,4,'Older and future home runs must be excluded');
assert.equal(row.stats.rbi,9);
assert.equal(row.stats.runs,4);
assert.equal(row.stats.hits,7);
assert.equal(row.stats.atBats,8);
assert.equal(potwTeamGames(season,2,'haliban').length,2);
const award={roundNo:2,player:11,team:'haliban',teamName:'Moleville Haliban',
 awardTitle:'Supa Mario Player of the Week'};
let story=conferencePotwStory(season,award);
assert.match(story.detail,/Moleville Haliban/);
assert.match(story.detail,/0–2/);
assert.match(story.detail,/4 home runs/);
assert.match(story.detail,/9 runs/);
assert.match(story.detail,/4 runs/);
assert.match(story.detail,/7-for-8/);
assert.match(story.detail,/16 total runs/);
assert.match(story.detail,/GM of Moleville Haliban/);
assert.match(story.detail,/led the entire SSL/);
assert(!story.detail.includes('30 runs'),'Old totals were leaked into story');
// A better player in the same two-game window removes Wario's league-lead claim.
const otherGames=season.games.filter(g=>g.week===3||g.week===4);
for(const g of otherGames.filter(g=>g.stage==='final')){
 const opp=g.result.players.find(p=>p.player===10);
 opp.stats.homeRuns=4;
}
story=conferencePotwStory(season,award);
assert(!story.detail.includes('led the entire SSL'),'Only proven league leads should be claimed');
assert(!story.detail.includes('tied for the SSL lead'),'Wario should not be called a league leader when another has 8');
console.log('PASS: only two eligible games per player and team, correct Wario line and team record, truthful league-lead copy, no earlier/future games.');

// A trophy and its editorial story stay with the award-winning team even
// if the winner moves to another roster later in the season.
season.rosters.haliban=[];
season.rosters.galaxy.push(11);
story=conferencePotwStory(season,award);
assert.match(story.detail,/Moleville Haliban/);
assert.match(story.detail,/4 home runs/);
assert.match(story.detail,/9 runs/);
assert.match(story.detail,/7-for-8/);
assert.match(story.detail,/16 total runs/);

// The other conference must receive its own story, not Wario's copy.
season.games.push(
 makeGame('galaxy3',3,'galaxy','opposition',4,2,[['galaxy',2,
   {outs:9,pitchStrikeouts:5,earnedRuns:1,assists:2}]]),
 makeGame('galaxy4',4,'galaxy','opposition',3,1,[['galaxy',2,
   {outs:9,pitchStrikeouts:4,earnedRuns:1,assists:2}]])
);
const galaxyAward={roundNo:2,player:2,team:'galaxy',teamName:'Galaxy Knights',
 awardTitle:'Mario Galaxy Player of the Week'};
const galaxyStory=conferencePotwStory(season,galaxyAward);
assert.match(galaxyStory.title,/strikeouts|pitching/i);
assert.match(galaxyStory.detail,/9 batters/);
assert.match(galaxyStory.detail,/Galaxy Knights/);
assert(!galaxyStory.detail.includes('Moleville Haliban'));
assert(!galaxyStory.detail.includes('7-for-8'));
console.log('PASS: archived stories survive trades and the second conference gets a distinct, stat-led story.');

