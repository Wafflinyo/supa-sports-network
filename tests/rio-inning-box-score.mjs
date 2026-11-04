import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractRioInningScores,validateInningScores} from '../src/rio-inning-scores.js';
import {seasonBoxScore,preseasonBoxScore,previewPrivateGameBoxScore} from '../src/game-box-score-data.js';

const away='New Donk City Fuggetaboudits',home='Delfino Dolphins';
const season={id:'season',teams:[{id:'away',slot:9,name:away},{id:'home',slot:1,name:home}]};
const game={id:'test',week:1,stage:'final',phase:'regular',away:'away',home:'home'};
const rows=Array.from({length:26},()=>[]);
rows[21][12]='Scorecard';
for(let i=0;i<7;i++)rows[22][10+i]=i+1;
rows[22][17]='Final';
rows[23][9]='DK Wilds';
[3,2,0,0,1,0,2].forEach((runs,i)=>rows[23][10+i]=runs);
rows[23][17]=8;
rows[24][9]='Jr. Rookies';
[1,3,0,5,2,2,0].forEach((runs,i)=>rows[24][10+i]=runs);
rows[24][17]=13;
const expected={away:[3,2,0,0,1,0,2],home:[1,3,0,5,2,2,0]};
assert.deepEqual(extractRioInningScores(rows,season.teams,game),expected,
  'Real Project Rio Scorecard layout must preserve every inning including repeated zeros');
assert.deepEqual(validateInningScores(expected,8,13),expected);
assert.throws(()=>validateInningScores(expected,8,12),/do not match/);
const released=seasonBoxScore(season,{...game,result:{scores:{away:8,home:13},players:[],innings:expected}});
assert.deepEqual(released.innings,expected,'Official released box score carries inning lines');
const report={players:[{player:1,team:'away',stats:{runs:8,outs:0},gameScore:10,itemScore:0},
  {player:2,team:'home',stats:{runs:13,outs:0},gameScore:11,itemScore:0}],innings:expected};
const preview=previewPrivateGameBoxScore(season,game,report);
assert.deepEqual(preview.innings,expected,'Commissioner pre-upload preview shares inning data');
const ps=preseasonBoxScore({
 gameId:'ps',round:1,away,home,awayScore:8,homeScore:13,fields:[],players:[],innings:expected
});
assert.deepEqual(ps.innings,expected,'Released preseason compact box score shows innings');

const source=fs.readFileSync('src/GameBoxScore.jsx','utf8');
assert.match(source,/<InningLineScore game=\{game\}\/>[\s\S]*<div className="ssl-box-scoreboard">/,
  'Inning scorecard belongs directly under box score heading, above totals and stats');
assert.match(source,/SCORING BY INNING/);
const importer=fs.readFileSync('src/season-data.js','utf8');
assert.match(importer,/if\(!inningScores\)throw Error/,'Do not silently save missing inning breakdowns');
const compact=fs.readFileSync('src/preseason-rio-report.js','utf8');
assert.match(compact,/mvp:Number\(mvp\),fields,players:compactPlayers,innings:raw.innings/,
  'Released preseason compact report must not drop inning lines');
console.log('PASS: 7-inning Project Rio Scorecard, saved preview and released box scores, missing data guard');
