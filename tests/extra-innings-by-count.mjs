import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  extractRioInningScores,validateInningScores,inningScoringDrama
} from '../src/rio-inning-scores.js';
import {matchHeadline,gameOutcomeContext} from '../src/game-headlines.js';
import {leagueNews} from '../src/league-news.js';

const teams=[
  {id:'rookies',slot:1,name:'Delfino Dolphins'},
  {id:'monsters',slot:11,name:'Twilight Town Tanks'},
];
const game={id:'extras-test',week:2,stage:'final',phase:'regular',away:'rookies',home:'monsters'};
const rows=[
  ['Scorecard'],
  ['', '',1,2,3,4,5,6,7,8,'Final'],
  ['Jr. Rookies (Bottom)','',0,0,1,0,2,0,0,1,4],
  ['Bowser Monsters (Top)','',1,0,3,0,0,0,0,1,5],
];
const innings=extractRioInningScores(rows,teams,game);
assert.deepEqual(innings,{
  away:[0,0,1,0,2,0,0,1],
  home:[1,0,3,0,0,0,0,1],
  top:'home',
},'Game Info preserves an eighth inning with no red cell metadata');
assert.deepEqual(validateInningScores(innings,4,5),innings);
const facts=inningScoringDrama(innings);
assert.equal(facts.extraInnings,true,'Eight innings automatically means extras');
assert.equal(facts.inningCount,8);
assert.equal(facts.extraInningCount,1);
const season={id:'s1',name:'Season 1',teams,transactions:[],games:[]};
const played={...game,result:{innings,scores:{rookies:4,monsters:5},players:[]}};
season.games=[played];
const story=matchHeadline(season,played);
assert.equal(story.extraInnings,true);
assert.equal(story.inningCount,8);
assert.match(story.label,/EXTRA-INNINGS/);
assert.match(story.title,/8 innings/);
assert.match(story.summary,/8 innings/);
assert.match(gameOutcomeContext(season,played,'rookies'),/after 8 innings/);
const feed=leagueNews([season],[]);
assert.equal(feed.filter(x=>x.category==='match').length,1);
assert.equal(feed.find(x=>x.category==='match').extraInnings,true,
  'Extra-innings headline is included in the league news feed');

const privateGame={...played,stage:'recorded'};
assert(!matchHeadline(season,privateGame),'Unreleased extra inning match stays private');
assert(matchHeadline(season,privateGame,[],{includeRecorded:true}).private);
assert(!leagueNews([{...season,games:[privateGame]},[]],[]).some(x=>x.category==='match'));

const normal={...innings,away:innings.away.slice(0,7),home:innings.home.slice(0,7)};
assert.equal(inningScoringDrama(normal).extraInnings,false,
  'Exactly seven innings is regulation even when score is close');
assert(!matchHeadline(season,{...played,result:{...played.result,innings:normal}}).extraInnings);
const ninth={...innings,away:[...innings.away,0],home:[...innings.home,1]};
assert.equal(inningScoringDrama(ninth).extraInningCount,2,
  'Nine innings recognizes two extra innings');
const box=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
assert.match(box,/columns.length>7/);
assert.match(box,/EXTRA INNINGS/);
assert.match(box,/ssl-box-inning-extra/);
console.log('PASS: 8+ innings automatically trigger extra-inning box scores, headlines and news');
