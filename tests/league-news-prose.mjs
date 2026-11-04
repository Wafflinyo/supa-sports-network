import assert from 'node:assert/strict';
import {leagueNews} from '../src/league-news.js';

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
console.log('PASS: natural home-run/fielding reporting, loss context, private previews and grouped paragraphs');
