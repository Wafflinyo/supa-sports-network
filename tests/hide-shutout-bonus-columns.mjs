import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gamePointComponents,gamePointsForReport} from '../src/game-points.js';

const files=[
 ['regular-season Player Stats','src/main.jsx'],
 ['preseason Player Stats','src/PreseasonStats.jsx'],
 ['individual game box scores','src/GameBoxScore.jsx'],
 ['shared pitching and archived Player Stats','src/temporary-stat-columns.json'],
];
for(const [label,path] of files){
  const source=readFileSync(path,'utf8');
  assert(!source.includes("['shutoutBonus'"),label+' must not have a Shutout Bonus table heading');
  assert(!source.includes('"shutoutBonus"'),label+' must not have a Shutout Game Points column');
  assert(!source.includes("'shutoutBonus'"),label+' must not expose shutout bonus in any player stat table');
}
const season=readFileSync('src/main.jsx','utf8');
const preseason=readFileSync('src/PreseasonStats.jsx','utf8');
const box=readFileSync('src/GameBoxScore.jsx','utf8');
const shared=JSON.parse(readFileSync('src/temporary-stat-columns.json','utf8'));
for(const [name,data] of [['regular season',season],['preseason',preseason]]){
  assert(data.includes("['shutouts', 'Solo Shutouts']"),name+' must still show solo shutouts');
  assert(data.includes("['combinedShutouts','Combined Shutouts']"),name+' must still show combined shutouts');
  assert(data.includes("['pgp','PGP']"),name+' must still show Pitching Game Points');
}
assert(box.includes("['mvpBonus','MVP Bonus']"),'MVP bonuses stay visible in box scores');
assert(box.includes("['pgp','PGP']"),'Pitching Game Points stays visible in box scores');
assert(shared['Pitching Stats'].some(([key])=>key==='shutouts'),'Archived pitching keeps shutout count');
assert(shared['Pitching Stats'].some(([key])=>key==='combinedShutouts'),'Archived pitching keeps combined shutouts');
assert(!shared['Pitching Stats'].some(([key])=>key==='shutoutBonus'),'Archived pitching hides bonus column');
assert.equal(gamePointComponents({},30).pgp,30,'The thirty-point shutout reward must still count toward PGP');
const report=gamePointsForReport({stats:{},shutoutBonus:30});
assert.equal(report.pgp,30,'Imported report shutout bonuses must still affect pitching points');
assert.equal(report.tgp,30,'Imported report shutout bonuses must still affect total Game Points');
console.log('PASS: shutout bonus hidden across player stats views but still contributes to game scoring');
