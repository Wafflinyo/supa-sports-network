import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import columns from '../src/temporary-stat-columns.json' with {type:'json'};

const excluded=new Set(['gamesPlayed','mvps']);
const tabs={
  Batting:columns['Offensive Stats'].filter(([key])=>!excluded.has(key)),
  Fielding:columns['Defensive Stats'].filter(([key])=>!excluded.has(key)),
  Pitching:columns['Pitching Stats'].filter(([key])=>!excluded.has(key)),
};
for(const [tab,fields] of Object.entries(tabs)){
  const ids=fields.map(([key])=>key);
  assert.equal(new Set(ids).size,ids.length,tab+' cannot repeat a column identifier');
}
assert.equal(tabs.Batting.filter(([key])=>key==='homeRuns').length,1,
  'Batting should contain exactly one Home Runs column');
assert(!tabs.Fielding.some(([key])=>key==='homeRuns'||key==='hrAllowed'),
  'Fielding must not display offensive home runs or pitching HR Allowed');
assert(!tabs.Pitching.some(([key])=>key==='homeRuns'),
  'Pitching must not display offensive Home Runs');
assert(tabs.Pitching.some(([key,label])=>key==='hrAllowed'&&label==='HR Allowed'),
  'Pitching should display HR Allowed from pitchers, not their batting home runs');
assert.deepEqual(tabs.Fielding.slice(0,2).map(([key])=>key),['putouts','assists'],
  'Fielding begins with defensive columns');
assert.deepEqual(tabs.Pitching.slice(0,2).map(([key])=>key),['battersFaced','inningsPitched'],
  'Pitching begins with Batters Faced and IP, with no stale offensive HR column');
const jsx=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
assert(!jsx.includes(".flatMap(column=>column[0]==='rbi'"),
  'Do not inject a second homeRuns column after the RBI column');
assert.match(jsx,/\['Offensive Stats'\]\.filter\(\(\[k\]\)=>!\['gamesPlayed','mvps'\]\.includes\(k\)\)/);
assert.match(jsx,/<table key=\{tab\} className="ssl-box-table">/,
  'Tab switching must remount table DOM to clear any previously rendered columns');
assert.match(jsx,/\['Pitching Stats'\]/);
assert.match(jsx,/\['Defensive Stats'\]/);
console.log('PASS: unique Batting HR; no offensive HR in Pitching/Fielding; correct HR Allowed; category switching remounts entire table.');
