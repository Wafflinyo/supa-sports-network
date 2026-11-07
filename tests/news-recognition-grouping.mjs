import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {leagueNews} from '../src/league-news.js';
import {gamePointsForReport} from '../src/game-points.js';

const people=[
  {id:1,name:'Wario'},{id:2,name:'Wendy'},
  {id:3,name:'Diddy Kong'},{id:4,name:'Bowser'},
];
const teams=[
  {id:'checkers',name:'Diamond City Checkers'},
  {id:'knights',name:'New Donk City Knights'},
];
const row=(player,team,gameScore,stats)=>({player,team,gameScore,stats});
const wario=row(1,'knights',180.5,{
  homeRuns:2,twoHr:2,runs:2,rbi:5,atBats:4,plateAppearances:4,hits:2,totalBases:8,
});
const wendy=row(2,'knights',123,{
  putouts:8,assists:1,buddyJumpPutouts:5,hits:3,atBats:3,plateAppearances:3,
});
const diddy=row(3,'knights',141.36,{
  outs:16,pitchStrikeouts:3,earnedRuns:0,runsAllowed:0,strikes:13,
  pitches:100,hits:2,atBats:2,totalBases:2,
});
const bowser=row(4,'checkers',53,{
  homeRuns:1,oneHr:1,runs:2,rbi:4,atBats:4,plateAppearances:4,hits:2,
});
function seasonFor(stage='final',rows=[wario,wendy,diddy,bowser]){
  return {id:'season-one',name:'Season 1',number:1,teams,
    games:[{id:'week-1-game',week:1,phase:'regular',stage,
      away:'knights',home:'checkers',releasedAt:stage==='final'?'2026-11-04T09:00:00Z':null,
      result:{scores:{knights:10,checkers:9},players:rows}}],
    transactions:[]};
}
const official=leagueNews([seasonFor()],people);
const teamStats=official.filter(item=>item.category==='team-game');
const teamHeat=official.filter(item=>item.category==='heating');
assert.equal(teamStats.filter(item=>item.teamId==='knights').length,1);
assert.equal(teamStats.filter(item=>item.teamId==='checkers').length,1,
  'Opponent recognition remains on its own team article');
assert.equal(teamHeat.length,1,'All three teammates Heating Up appear in ONE fire post');
assert.equal(teamHeat[0].teamId,'knights');
assert(teamHeat[0].id.startsWith('team-heating:'));
assert([wario,wendy,diddy].every(row=>teamHeat[0].summary.includes(String(gamePointsForReport(row).tgp))),
  'Heating Up news displays dynamically recomputed scores, never old imported totals');
assert(teamHeat[0].summary.includes('Wendy')&&teamHeat[0].summary.includes('Diddy Kong'));
assert(!teamHeat[0].summary.includes('Home runs:')&&!teamHeat[0].summary.includes('Fielding:'),
  'Heating Up news must not be merged with unrelated stat achievements');
const performance=teamStats.find(x=>x.teamId==='knights');
assert.deepEqual(new Set(performance.recognitions.map(x=>x.category)),
  new Set(['home-run','offense','defense','perfect-batting','pitching']));
assert.equal(performance.recognitions.filter(x=>x.playerId===1).length,2,
  'Wario earns 2 HR recognition and 7 combined runs+RBIs in ONE post');
assert.equal(performance.recognitions.filter(x=>x.playerId===2).length,2,
  'Wendy gets fielding and perfect on-base recognition in the same post');
for(const name of ['Wario','Wendy','Diddy Kong'])assert(performance.summary.includes(name));
assert.match(performance.summary,/Week 1.{0,4}win against the Diamond City Checkers/i,
  "Grouped recognition retains the accurate matchup result without relying on paragraph order");
assert(!official.some(x=>['home-run','offense','defense','pitching','perfect-batting'].includes(x.category)&&
  x.teamId==='knights'),'No separate recognition posts remain for team');
assert(performance.private===false&&teamHeat[0].private===false);

const onlyWario=leagueNews([seasonFor('final',[wario])],people);
const warioHeat=onlyWario.filter(x=>x.category==='heating');
const warioStats=onlyWario.filter(x=>x.category==='team-game');
assert.equal(warioHeat.length,1,'Single heated player keeps the original individual fire post');
assert.equal(warioHeat[0].playerId,1);
assert.match(warioHeat[0].title,/Wario is heating up/i);
assert.equal(warioStats.length,1,'Single player with two batting achievements still gets one article');
assert.equal(warioStats[0].collectivePlayers.length,1);
assert(!onlyWario.some(x=>x.category==='home-run'||x.category==='offense'));
const onlyOneStat=leagueNews([seasonFor('final',[row(1,'knights',20,{homeRuns:1,oneHr:1})])],people);
assert(onlyOneStat.some(x=>x.category==='home-run'),
  'A lone stat achievement preserves its descriptive original category');
assert(!onlyOneStat.some(x=>x.category==='team-game'),
  'Never turn a single simple recognition into a generic story unnecessarily');

const privateSeason=seasonFor('recorded');
const commissioner=leagueNews([privateSeason],people,{includeRecorded:true});
const recordedStats=commissioner.filter(x=>x.category==='team-game');
const recordedHeat=commissioner.filter(x=>x.category==='heating');
assert.equal(recordedHeat.length,1,'Commissioner private Heating Up previews are also grouped');
assert.equal(recordedStats.length,2,'Both teams get grouped private achievements');
assert(commissioner.every(x=>x.private===true),
  'Grouping must NEVER strip private marker from staged Project Rio stories');
assert(commissioner.every(x=>x.category!=='match'),
  'Unreleased result must not generate a public game headline');
const publicBeforeRelease=leagueNews([privateSeason],people,{includeRecorded:false});
assert.deepEqual(publicBeforeRelease,[],
  'GM and public news must not see private reports or their grouped achievements');
const released=leagueNews([seasonFor('final')],people,{includeRecorded:false});
assert(released.every(x=>x.private!==true));
assert(released.some(x=>x.category==='match'));

const home=readFileSync(new URL('../src/HomeDashboard.jsx',import.meta.url),'utf8');
assert.match(home,/item.category==='heating'&&item.gameId&&item.playerId==null/,
  'Grouped Heating Up articles navigate to the actual matchup, not transactions');
assert.match(home,/<HeadlineReadMore id=\{item.id\} text=\{item.summary\} limit=\{195\}/,
  'Long team news stories continue to expand with …more');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert.match(main,/includeRecorded:access.role==='commissioner'/,
  'Only commissioner account enables private preview mode');
const server=readFileSync(new URL('../supabase/migrations/20261104072400_ssl_match_story_editor_and_private_headlines.sql',import.meta.url),'utf8');
assert.match(server,/g:=g-''result''-''story''/,
  'Existing server strips embargoed result and story data from other roles');
console.log('PASS: one stat article per team/game including same player multiple achievements, separate single and combined Heating Up, private previews stay embargoed.');
