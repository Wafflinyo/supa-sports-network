import assert from 'node:assert/strict';
import fs from 'node:fs';
import roster from '../src/players.json' with {type:'json'};
import {preseasonDraftRosters,makePreseasonReport} from '../src/preseason-rio-report.js';
import {allPreseasonGames,preseasonPlayerStats,preseasonTeamStats} from '../src/preseason-game-data.js';
import {preseasonBoxScore} from '../src/game-box-score-data.js';

const names=roster.slice(0,18).map(p=>p.id);
const season={id:'test-season',status:'postdraft',teams:[
  {id:'a',name:'High Team',slot:1},{id:'b',name:'Low Team',slot:2}],
  picks:names.map((id,index)=>({kind:'player',team:index<9?'a':'b',player:id})),
  rosters:{a:names.slice(9),b:names.slice(0,9)},games:[]};
const game={key:'R1-1',round:1,high:season.teams[0],low:season.teams[1]};
const rosters=preseasonDraftRosters(season,game);
assert.deepEqual(rosters.a,names.slice(0,9));
assert.deepEqual(rosters.b,names.slice(9),'Trades after draft must not change preseason identity');
// A complete Rio report, 18 unique player rows, with one winning-team MVP.
const rows=names.map((player,index)=>({
  chosen:player,player:'row-'+index,row:index+2,
  team:index<9?'High Team':'Low Team',label:index<9?'High Team':'Low Team',
  position:'C',hits:1,runs:index===0?2:0,rbi:index===0?2:0,
  singles:1,doubles:0,triples:0,homeruns:0,itemscore:10,
}));
const preview={labels:['High Team','Low Team'],rows,pitch:[],
  filename:'test.ods',fingerprint:'abc'};
const report=makePreseasonReport(preview,season,game,roster);
assert.equal(report.scoreA,2);
assert.equal(report.scoreB,0);
assert.equal(report.players.length,18);
assert.equal(report.compact.players.length,18);
assert.equal(report.players.filter(p=>p.stats.mvps===1).length,1);
assert(report.players.filter(p=>p.stats.mvps===1).every(p=>p.team==='a'));
assert(report.compact.fields.includes('itemScore'));
assert.equal(report.compact.players.find(p=>p[0]===names[0])[3][report.compact.fields.indexOf('itemScore')],10);
const normalized={...season,preseasonReports:[report.compact]};
const all=allPreseasonGames(normalized);
assert(all.some(g=>g.gameId===report.compact.gameId));
const box=preseasonBoxScore(report.compact);
assert(box.hasPlayerStats);
assert.equal(box.teams.length,2);
assert.equal(box.teams[0].score,2);
const playerRows=preseasonPlayerStats([report.compact]);
const teamRows=preseasonTeamStats([report.compact]);
assert.equal(playerRows.length,18);
assert.equal(teamRows.length,2);
assert.equal(playerRows.reduce((n,p)=>n+p.stats.gamesPlayed,0),18);
assert(teamRows.some(t=>t.teamName==='High Team'&&t.stats.runsScored===2));

const bracket=fs.readFileSync('src/SeasonPreseason.jsx','utf8');
const uploader=fs.readFileSync('src/PreseasonRioImport.jsx','utf8');
const hook=fs.readFileSync('src/SeasonLeague.jsx','utf8');
assert(!bracket.includes('function ScoreEntry('),'Manual high/low result form must be removed');
assert(!bracket.includes('RECORD FINAL'),'Manual score entry button must be removed');
assert(bracket.includes('isCommissioner&&!game.winner'),
  'Project Rio controls must be restricted to commissioner');
assert(uploader.includes('accept=".ods,.xlsx"'));
assert(uploader.includes('SAVE PRIVATE REPORT'));
assert(bracket.includes('RELEASE GAME · MAKE RESULTS PUBLIC'));
assert(hook.includes("ssl_preseason_published_reports"),'Public stats must come from published-only RPC');
assert(hook.includes("ssl_preseason_report_action"),'Private staging must use commissioner-only RPC');
console.log('PASS: preseason roster stability, custom scoring, public-only stat aggregation, commissioner-only Rio upload and private release workflow');
