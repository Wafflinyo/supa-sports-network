import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractRioInningScores,validateInningScores,inningScoringDrama} from '../src/rio-inning-scores.js';
import {matchHeadline,homepageHeadlineSlides} from '../src/game-headlines.js';
const teams=[
 {id:'k',slot:7,name:'New Donk City Knights'},
 {id:'h',slot:4,name:'Moleville Haliban'},
];
const game={id:'w1-g1',phase:'regular',week:1,stage:'final',away:'k',home:'h'};
const scoreSheet=[
 ['Mario Fireballs','VS','Yoshi Eggs'],
 ['SCORING BY INNING','','','','','','','','',''],
 ['Team',1,2,3,4,5,6,7,'R','H'],
 ['Mario Fireballs',2,0,3,0,0,0,0,5,11],
 ['Yoshi Eggs',0,4,0,2,0,0,'X',6,8],
];
const innings=extractRioInningScores(scoreSheet,teams,game);
assert.deepEqual(innings,{away:[2,0,3,0,0,0,0],home:[0,4,0,2,0,0,null]});
assert.deepEqual(validateInningScores(innings,5,6),innings);
assert.throws(()=>validateInningScores(innings,6,5),/do not match Stats totals/);
const drama=inningScoringDrama(innings);
assert.equal(drama.leadChanges,3,'Half-inning leader flips from away to home to away to home');
assert.equal(drama.lateFinish,'none','Unplayed bottom seventh is NOT a walk-off');
const walkoff=extractRioInningScores([
 ['Mario Fireballs','VS','Yoshi Eggs'],
 ['Team','1','2','3','4','5','6','7','R'],
 ['Mario Fireballs',0,0,0,0,0,0,2,2],
 ['Yoshi Eggs',0,0,0,0,0,0,3,3],
],teams,game);
assert.equal(inningScoringDrama(walkoff).lateFinish,'walkoff');
const vertical=extractRioInningScores([
 ['Mario Fireballs','VS','Yoshi Eggs'],
 ['Inning','Mario Fireballs','Yoshi Eggs'],
 [1,0,0],[2,1,0],[3,0,1],[4,2,0],[5,0,2],[6,0,0],[7,0,1],
],teams,game);
assert.deepEqual(vertical,{away:[0,1,0,2,0,0,0],home:[0,0,1,0,2,0,1]});
assert.equal(extractRioInningScores([['Mario Fireballs','VS','Yoshi Eggs'],['team data',7,3]],teams,game),null,
 'Never guess inning scoring from unrelated Game Info numeric data');
assert.equal(inningScoringDrama(null),null);

// Automatic Game Info outcomes always override stale manual editor metadata.
const season={id:'season1',number:1,name:'Season 1',teams,games:[],schedulePublished:true};
const headlineGame={...game,story:{lateFinish:'walkoff',leadChanges:19},
 releasedAt:'2026-11-04T10:00:00Z',
 result:{scores:{k:5,h:6},innings,players:[]}};
const story=matchHeadline(season,headlineGame,[]);
assert.equal(story.leadChanges,3);
assert.equal(story.lateFinish,'none');
assert.equal(story.tier,'close','An ordinary score should not become a walkoff from stale manual input');
assert.match(story.summary,/3 confirmed lead changes/);
const trueWalkoff=matchHeadline(season,{...headlineGame,result:{...headlineGame.result,scores:{k:2,h:3},innings:walkoff}},[]);
assert.equal(trueWalkoff.tier,'walkoff');

// Week-based carousel: first previews, Week 1 match headlines then remaining
// champion in LAST position. From Week 2 the champion is gone regardless of
// how many results are available; Week 1 backfills unmatched slots.
const champion={seasonId:'season1',champion:teams[0],topPlayers:[]};
const games=[
 ...Array.from({length:6},(_,i)=>({...game,id:'w1-g'+i,week:1,stage:'scheduled',
   result:{scores:{k:5+i,h:2},players:[]}})),
 ...Array.from({length:6},(_,i)=>({...game,id:'w2-g'+i,week:2,stage:'scheduled',
   result:{scores:{k:4,h:1},players:[]}})),
];
const headlinesFor=games=>games.filter(g=>g.stage==='final').map(g=>matchHeadline(season,g,[]));
const slideFor=games=>homepageHeadlineSlides(champion,headlinesFor(games),'season1',5,{
 ...season,games,
});
let deck=slideFor(games);
assert.deepEqual(deck.map(d=>d.kind),['champion'],'Preseason alone is the only slide before Week 1');
const released=Array.from({length:6},(_,i)=>({...games[i],stage:'final',
 releasedAt:new Date(Date.parse('2026-11-04T10:00:00Z')+i*60000).toISOString()}));
const replaceWeeks=(count,week2Count=0)=>[
 ...released.slice(0,count),...games.slice(count,6),
 ...games.slice(6,6+week2Count).map((g,i)=>({...g,stage:'final',releasedAt:new Date(Date.parse('2026-11-05T10:00:00Z')+i*60000).toISOString()})),
 ...games.slice(6+week2Count),
];
deck=slideFor(replaceWeeks(2));
assert.deepEqual(deck.map(x=>x.kind),['match','match','champion']);
assert.equal(deck.at(-1).kind,'champion','Champion is last whenever Week 1 has fewer than 5 headlines');
deck=slideFor(replaceWeeks(5));
assert.equal(deck.length,5);assert(!deck.some(x=>x.kind==='champion'));
deck=slideFor(replaceWeeks(6));
assert.equal(deck.length,5);assert(!deck.some(x=>x.kind==='champion'),
 'Week 2 upcoming ends preseason champion headlines, even before any Week 2 finals');
deck=slideFor(replaceWeeks(6,1));
assert.equal(deck.length,5);assert(!deck.some(x=>x.kind==='champion'));
assert.equal(deck[0].story.week,2);
assert(deck.slice(1).every(x=>x.story.week===1),'Week 1 fills empty slots when Week 2 has only one result');

for(const path of ['../src/season-data.js','../src/GameBoxScore.jsx','../src/game-box-score-data.js',
 '../src/GameStoryEditor.jsx','../src/HomeDashboard.jsx']){
 const source=readFileSync(new URL(path,import.meta.url),'utf8');
 if(path.endsWith('season-data.js')){
  assert.match(source,/extractRioInningScores\(sheets\['Game Info'\]/);
  assert.match(source,/validateInningScores\(preview.inningScores/);
 }
 if(path.endsWith('GameBoxScore.jsx'))assert.match(source,/SCORING BY INNING/);
 if(path.endsWith('game-box-score-data.js'))assert.match(source,/innings:game.result.innings/);
 if(path.endsWith('GameStoryEditor.jsx'))assert.match(source,/const calculated=inningScoringDrama/);
 if(path.endsWith('HomeDashboard.jsx'))assert.match(source,/5,season\)/);
}
const migration=readFileSync(new URL('../supabase/migrations/20261104105000_ssl_rio_game_info_innings.sql',import.meta.url),'utf8');
assert.match(migration,/ssl_validate_game_innings/);
assert.match(migration,/'players'',arr,''scores'',ids,''innings''/);
console.log('PASS: Rio Game Info linescore, innings preview/persistence, accurate inning lead swaps and walkoffs; Week 1 champion last, Week 2 no champion and Week 1 backfills.');
