import assert from 'node:assert/strict';
import {leagueNews} from '../src/league-news.js';
import {reporterParagraph} from '../src/reporter-copy.js';
import {pitchingNewsPerformance} from '../src/game-headlines.js';

const players=[
  {id:1,name:'Blue Kritter'},
  {id:2,name:'Red Yoshi'},
  {id:3,name:'King K. Rool'},
  {id:4,name:'Kritter'},
];
const home='Moleville Haliban',away='New Donk City Fuggetaboudits';
const makeSeason=(stage='recorded',awayScore=6,homeScore=5)=>({
  id:'test-season',name:'Season 1',status:'regular',
  teams:[{id:'away',name:away},{id:'home',name:home}],
  games:[{
    id:'week-1',stage,phase:'regular',week:1,away:'away',home:'home',
    result:{scores:{away:awayScore,home:homeScore},players:[
      {player:1,team:'away',stats:{runs:2,rbi:3,homeRuns:1,twoHr:1,putouts:3,assists:3,doublePlays:2}},
      {player:2,team:'away',stats:{putouts:7,assists:5,doublePlays:5,buddyJumpPutouts:0}},
      {player:3,team:'away',stats:{putouts:6,doublePlays:5,buddyJumpPutouts:0}},
      {player:4,team:'home',stats:{homeRuns:1,oneHr:1}},
    ]},
  }],
  transactions:[],
});
const groupOf=(items)=>items.find(item=>item.category==='team-game'&&item.teamId==='away');
const staged=leagueNews([makeSeason()],players,{includeRecorded:true});
const grouped=groupOf(staged);
assert(grouped,'Combined recognition should be present');
assert.equal(grouped.private,true,'Commissioner preview remains private');
const paragraphs=grouped.summary.split('\n');
assert.equal(paragraphs.length,3,'One distinct bullet paragraph per player');
assert(paragraphs.every(line=>line.startsWith('• ')),'Semantically separate player bullets');
assert.match(paragraphs[0],/two-run homer/);
assert.match(paragraphs[0],/2 runs scored/);
assert.match(paragraphs[0],/3 RBI/);
assert.match(paragraphs[0],/3 putouts/);
assert.match(paragraphs[0],/3 assists/);
assert.match(paragraphs[0],/2 double plays/);
assert.doesNotMatch(grouped.summary,/1 home run|featuring 1|home runs:|fielding:/i);
assert.doesNotMatch(grouped.summary,/Buddy Jump/i,'Zero-valued categories should not appear');
assert.match(grouped.summary,/(?:victory|win|prevailed|defeated).*Moleville Haliban/i);
assert.doesNotMatch(grouped.summary,/made (?:their|his|her) presence felt/i);
assert(!staged.some(item=>item.category==='team-game'&&!item.private),'No staged public news');
assert.equal(leagueNews([makeSeason()],players).filter(item=>item.gameId==='week-1').length,0,
  'Unreleased result must not leak to public feed');
const single=staged.find(item=>item.category==='home-run'&&item.teamId==='home');
assert(single,'Single-category recognitions must still publish as their own article');
assert.match(single.summary,/solo homer/);
assert.doesNotMatch(single.summary,/1 home run|featuring 1/i);
const defeat=groupOf(leagueNews([makeSeason('recorded',5,6)],players,{includeRecorded:true}));
assert.match(defeat.summary,/(?:despite|even as|fell short|result went|lost|loss to|scoreboard favored|losing effort|came up short|tough result)/i,'Celebrate accomplishments in losses without one repeated phrase');
assert.doesNotMatch(defeat.summary,/Week 1.s loss/i);
assert.doesNotMatch(defeat.summary,/close win/i);
const published=groupOf(leagueNews([makeSeason('final')],players));
assert.equal(published.private,false,'Only finalized posts become public');
assert.equal(published.summary,grouped.summary,'Private and published copy must match');
// Same-category writeups must rotate naturally instead of all saying
// "made their presence felt"; different games also get stable variation.
const repeated=(position,gameId)=>reporterParagraph('Red Yoshi',2,['defense'],{
 ...makeSeason().games[0],id:gameId
},'away',home,away,position);
const teammateStyles=Array.from({length:6},(_,i)=>repeated(i,'variation-test'));
assert(teammateStyles.every(Boolean));
assert(new Set(teammateStyles.map(v=>v.split('.')[0])).size>=5,
  'Same-game defensive standouts should have distinct opening sentences');
const acrossGames=Array.from({length:10},(_,i)=>repeated(0,'different-game-'+i));
assert(new Set(acrossGames.map(v=>v.split('.')[0])).size>=3,
  'Different games should rotate defensive headlines');
assert(teammateStyles.every(v=>!v.includes('made their presence felt')));
// News should show earned runs rather than duplicate runs-allowed counts.
const pitchingGame={
  id:'pitching-news-er',stage:'recorded',week:1,away:'away',home:'home',
  result:{scores:{away:6,home:5},players:[{
    player:1,team:'away',
    stats:{outs:17,strikes:24,pitches:50,runsAllowed:3,earnedRuns:1,pitchStrikeouts:2},
  }]},
};
const pitcher=pitchingGame.result.players[0];
const pitchingDetail=pitchingNewsPerformance(pitcher,pitchingGame);
assert(pitchingDetail,'A qualifying pitching performance must generate a news recognition');
assert.match(pitchingDetail.detail,/1 earned run/);
assert.doesNotMatch(pitchingDetail.detail,/runs? allowed/i);
const pitchingProse=reporterParagraph('Blue Kritter',1,['pitching'],pitchingGame,'away',home,away);
assert.match(pitchingProse,/1 earned run/);
assert.doesNotMatch(pitchingProse,/runs? allowed/i);
console.log('PASS: varied game news uses earned runs only; full pitching stats remain unchanged');
