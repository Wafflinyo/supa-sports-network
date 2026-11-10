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



// Pitching can be more noteworthy than a good offensive game. It must lead
// the title, summary and visible stat chips without suppressing real HRs.
const pitcherSeason={
 id:'pitching-two-game-test',name:'Pitching Award',teams,
 rosters:{galaxy:[2]},games:[
  makeGame('p3',3,'galaxy','opposition',8,1,[
   ['galaxy',2,{outs:9,pitchStrikeouts:4,earnedRuns:0,homeRuns:1,hits:2,atBats:3}]]),
  makeGame('p4',4,'galaxy','opposition',7,2,[
   ['galaxy',2,{outs:9,pitchStrikeouts:3,earnedRuns:1,homeRuns:1,hits:2,atBats:3}]])
 ]
};
const ace=conferencePotwStory(pitcherSeason,galaxyAward);
assert.equal(ace.featuredCategory,'pitching');
assert.match(ace.title,/bat and arm/,'Both good hitting and pitching deserve the award title');
assert.match(ace.summary,/On the mound/);
assert.match(ace.summary,/6.0 innings/);
assert.match(ace.summary,/7 batters/);
assert.match(ace.detail,/2 home runs/,'Notable offense still appears for all-around winners');
assert(ace.standouts.some(s=>s.label==='Pitch K'&&s.value==='7'));
assert(ace.standouts.some(s=>s.label==='ER'&&s.value==='1'));
assert(!ace.detail.includes('9 batters'),'Statistics from other game reports must not leak');

// A truly exceptional fielding winner gets defensive headlines, not a
// batting-first write-up, even when they hit home runs in both games.
const fieldSeason={
 id:'defensive-two-game-test',name:'Defensive Award',teams,
 rosters:{opposition:[10]},games:[
  makeGame('f3',3,'opposition','galaxy',4,3,[
   ['opposition',10,{putouts:4,assists:3,buddyJumpPutouts:1,doublePlays:1,
    homeRuns:1,hits:2,atBats:4}]]),
  makeGame('f4',4,'opposition','galaxy',6,2,[
   ['opposition',10,{putouts:4,assists:3,buddyJumpPutouts:1,doublePlays:1,
    homeRuns:1,hits:2,atBats:4}]])
 ]
};
const fielder=conferencePotwStory(fieldSeason,{roundNo:2,player:10,team:'opposition',
 teamName:'Peach Gardens',awardTitle:'Supa Mario Player of the Week'});
assert.equal(fielder.featuredCategory,'defense');
assert.match(fielder.title,/bat and glove/,'Both good batting and defense deserve the award title');
assert.match(fielder.summary,/In the field/);
assert.match(fielder.summary,/8 putouts/);
assert.match(fielder.summary,/6 assists/);
assert.match(fielder.summary,/2 Buddy Jump putouts/);
assert.match(fielder.detail,/2 home runs/,'Impressive offense is retained in full story');
assert.equal(fielder.standouts[0].label,'PO');
assert(fielder.standouts.some(s=>s.label==='Buddy Jump'&&s.value==='2'));
assert(!fielder.summary.startsWith('At the plate'));
console.log('PASS: offense, pitching and defense compete on merit; standout metrics and category-first copy are grounded in exactly two games.');

// Fire Bro example: strong BOTH at bat and in the field, but a very poor
// pitching outing. The headline must highlight offense and defense together,
// with absolutely no pitching facts, PGP stat chips or pitching averages.
const fireBroSeason={
 id:'fire-bro-combined',name:'Fire Bro Both',teams,
 rosters:{haliban:[53]},games:[
  makeGame('fire3',3,'haliban','opposition',5,2,[['haliban',53,{
   homeRuns:1,rbi:3,runs:1,hits:3,atBats:4,
   putouts:5,assists:2,buddyJumpPutouts:1,
   outs:3,pitchStrikeouts:0,earnedRuns:6,hitsAllowed:8,hrAllowed:2
  }]]),
  makeGame('fire4',4,'haliban','opposition',7,4,[['haliban',53,{
   homeRuns:1,rbi:2,runs:2,hits:3,atBats:4,
   putouts:6,assists:3,buddyJumpPutouts:1,
   outs:3,pitchStrikeouts:0,earnedRuns:5,hitsAllowed:7,hrAllowed:3
  }]])
 ]
};
const fire=conferencePotwStory(fireBroSeason,{
 roundNo:2,player:53,team:'haliban',teamName:'Moleville Haliban',
 awardTitle:'Supa Mario Player of the Week'
});
assert.match(fire.title,/Fire Bro.*bat and glove/);
assert(fire.qualifyingCategories.includes('offense'));
assert(fire.qualifyingCategories.includes('defense'));
assert(!fire.qualifyingCategories.includes('pitching'));
assert.match(fire.summary,/At the plate, Fire Bro/);
assert.match(fire.summary,/In the field, Fire Bro/);
assert.match(fire.summary,/2 home runs/);
assert.match(fire.summary,/11 putouts/);
assert.match(fire.summary,/5 assists/);
assert(!fire.summary.includes('On the mound'));
assert(!fire.detail.includes('On the mound'));
assert(!fire.standouts.some(item=>['PGP','Pitch K','IP','ER','SHO'].includes(item.label)));
assert(fire.standouts.some(item=>item.label==='HR'&&item.value==='2'));
assert(fire.standouts.some(item=>item.label==='PO'&&item.value==='11'));
assert(fire.standouts.some(item=>item.label==='Buddy Jump'&&item.value==='2'));
console.log('PASS: Fire Bro highlights both outstanding offense and defense while poor pitching is omitted entirely.');
