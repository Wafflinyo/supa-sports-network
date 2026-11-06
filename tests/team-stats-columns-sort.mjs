import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortTeamStatRows,teamStatColumnValue} from '../src/team-stats-table-sort.js';

const rows=[
 {id:'a',name:'Atlas',gp:2,wins:2,losses:0,runsFor:9,runsAgainst:3,
  homeWins:2,homeLosses:0,awayWins:0,awayLosses:0,
  totals:{hits:10,ogp:4.002,shutouts:1},agp:3.5},
 {id:'b',name:'Bronze',gp:1,wins:1,losses:0,runsFor:6,runsAgainst:3,
  homeWins:0,homeLosses:0,awayWins:1,awayLosses:0,
  totals:{hits:8,ogp:2.003,shutouts:0},agp:8},
 {id:'c',name:'Copper',gp:1,wins:0,losses:1,runsFor:1,runsAgainst:3,
  homeWins:0,homeLosses:1,awayWins:0,awayLosses:0,
  totals:{hits:4,ogp:-2.5,shutouts:0},agp:-3},
 {id:'d',name:'Diamond',gp:0,wins:0,losses:0,runsFor:0,runsAgainst:0,
  homeWins:0,homeLosses:0,awayWins:0,awayLosses:0,
  totals:{hits:0,ogp:0,shutouts:0},agp:null},
];
const order=(key,direction='desc',view='Totals')=>sortTeamStatRows(rows,{key,direction},view).map(x=>x.id);
assert.deepEqual(order('record'),['a','b','d','c'],
 'Default follows winning percentage, then differential, then runs allowed');
assert.deepEqual(order('hits'),['a','b','c','d'],'Totals sort highest to lowest');
assert.deepEqual(order('hits','asc'),['d','c','b','a'],'Totals sort lowest to highest');
assert.deepEqual(order('hits','desc','Averages per Game'),['b','a','c','d'],
 'Averages sort by values divided by games played, not totals');
assert.deepEqual(order('hits','asc','Averages per Game'),['c','a','b','d'],
 'Unplayed teams with unavailable averages sort last in both directions');
assert.deepEqual(order('name','asc'),['a','b','c','d'],'Team names A–Z');
assert.deepEqual(order('name','desc'),['d','c','b','a'],'Team names Z–A');
assert.deepEqual(order('gp','desc'),['a','b','c','d'],'Games played sort numerically');
assert.equal(order('homeRecord')[0],'a','Home winning percentage sorts highest first');
assert.equal(order('awayRecord')[0],'b','Away winning percentage sorts highest first');
assert.equal(order('shutouts')[0],'a','Shutouts remain available as sortable stats');
assert.equal(order('runsAgainst','asc')[0],'d','Archived runs allowed sort lowest first');
assert.equal(order('agp')[0],'b','AGP sorts by existing per-game values');
assert.equal(teamStatColumnValue(rows[3],'hits','Averages per Game'),null);
assert.equal(teamStatColumnValue(rows[3],'agp','Averages per Game'),null);
assert.equal(teamStatColumnValue(rows[1],'hits','Averages per Game'),8);
assert.deepEqual(rows.map(row=>row.id),['a','b','c','d'],'Sorting must never mutate original data');
assert.equal((rows[0].totals.ogp/rows[0].gp).toFixed(2),(rows[1].totals.ogp/rows[1].gp).toFixed(2),
 'Fixture has different unrounded averages that both display as 2.00');
assert.equal(order('ogp','desc','Averages per Game')[0],'b',
 'Sort by the underlying decimal rather than rounded display text');

const league=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const history=readFileSync(new URL('../src/HistoryArchive.jsx',import.meta.url),'utf8');
const teamSource=league.split('function TeamStats({ league: l }) {')[1]?.split('function History({ league: l }) {')[0]||'';
assert(teamSource,'Current Team Stats view must exist');
assert(teamSource.includes("const keys=visibleGamePointFields(allKeys,view);"),
 'Live Team Stats shows TGP only in Totals and AGP only in Averages');
assert(teamSource.includes("tgp:'TGP',agp:'AGP'"),
 'TGP and AGP take the former Game Score position with proper labels');
assert(!teamSource.includes('"gameScore"')&&!teamSource.includes("'Game Score/G'"),
 'Remove redundant Game Score and Game Score/G Team Stats columns entirely');
assert(teamSource.includes("['ogp','dgp','pgp','tgp']"),
 'Game Points continue to derive from the existing scoring system');
assert(history.includes("['tgp','TGP']"),
 'Archived Team Stats must label total points TGP');
assert(history.includes("key==='tgp'&&view!=='Totals'?'AGP':label"),
 'Archived Team Stats must label per-game points AGP');
const historyTeamSource=history.split('function ArchiveTeams({season,supabase}){')[1]
  ?.split('const pointCols=')[0]||'';
assert(!historyTeamSource.includes("heading('agp','AGP')"),
 'Archived Team Stats must not show a second AGP/Game Score average column');
// Player tables also show TGP/AGP exclusively in their corresponding views.
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
assert(main.includes("['tgp','TGP']")&&main.includes("['agp','AGP']")&&
  main.includes("'Game Points': [")&&!main.includes("['gameScore','Game Score']"),
 'Player Stats must show TGP/AGP in place of Game Score, not as duplicates');

for(const removed of ['"earnedRuns"','"combinedShutouts"','"shutoutBonus"']){
 assert(!teamSource.includes(removed),'Do not display '+removed+' in Team Stats');
}
for(const kept of ['"shutouts"','"atBats"','"hits"','"ogp"','"dgp"','"pgp"','"tgp"','"agp"']){
 assert(teamSource.includes(kept),'Keep existing relevant Team Stats stat '+kept);
}
assert.match(teamSource,/const \[sort,setSort\] = useState\(\{key:'record',direction:'desc'\}\)/,
 'Team Stats must default to record ranking');
assert.match(teamSource,/const rows=sortTeamStatRows\(teamRows,sort,view\)/,
 'Team Stats must sort its computed numerical rows');
assert.match(teamSource,/\{columns\.map\(heading\)\}/,
 'Every visible column needs a working sort button');
assert.match(teamSource,/onClick=\{\(\)=>toggleSort\(key\)\}/,
 'Sort headings must alternate directions when clicked');
assert.match(teamSource,/aria-sort=\{sort\.key===key\?/,
 'Sort direction must be accessible to screen readers');
assert.match(teamSource,/teamStatColumnValue\(team,k,view\)\.toFixed\(2\)/,
 'Average presentation must use the same underlying values as average sorting');
assert.match(history,/const sorted=useMemo\(\(\)=>sortTeamStatRows\(rows,sort,/,
 'Archived Team Stats also allow per-column numeric sorting');
assert.match(history,/\{heading\('record','W–L'\)\}/,
 'Archived team records have a sort button');

const liveCss=readFileSync(new URL('../src/season.css',import.meta.url),'utf8');
const historyCss=readFileSync(new URL('../src/history-archive.css',import.meta.url),'utf8');
assert(liveCss.includes('.season-table .ssl-team-stats-table :is(th,td){')&&
  liveCss.includes('border-right:1px solid #cbd5e3'),
  'Live Team Stats must have visible vertical dividers across every column');
assert(liveCss.includes('.season-table .ssl-team-stats-table tbody tr:nth-child(even) td'),
  'Live Team Stats must use alternating row backgrounds');
assert(liveCss.includes('.season-table .ssl-team-stats-table th:first-child'),
  'Live Team Stats must retain a sticky team-name column');
assert(history.includes('className="ssl-history-team-stats-table"')&&
  historyCss.includes('.ssl-history-team-stats-table th,'),
  'Archived Team Stats must have the new bordered table styling');

console.log('PASS: team stat columns, accurate highest/lowest sorting, averages, splits, history and clean source data');
