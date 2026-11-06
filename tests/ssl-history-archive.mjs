import assert from 'node:assert/strict';
import fs from 'node:fs';
import {historySeasons,historyPublicGames,historySeasonGames,historyRegularStandings,
  historyTeamStats,historyPlayerStats,historyOverview,historyTradeGroups,historySchedule} from '../src/history-archive-data.js';
import {allPreseasonGames} from '../src/preseason-game-data.js';
import {preseasonBracket} from '../src/preseason.js';

const teams=Array.from({length:12},(_,i)=>({id:'t'+(i+1),name:'Franchise '+(i+1),
  slot:i+1,conference:i<6?'supa':'galaxy'}));
const order=teams.map(t=>t.id);
const s1={id:'one',name:'Season 1',number:1,status:'archived',teams,order,
  picks:teams.map((t,i)=>({number:i+1,round:1,team:t.id,kind:'player',player:i+1,seconds:i+1})),
  games:[],transactions:[],preseasonReports:[],preseasonResults:[],
  playoffSeries:[],champion:null,conferenceChampions:{}};
const s2={...s1,id:'two',name:'Season 2',number:2,status:'preseason',
  games:[],transactions:[],preseasonReports:[],preseasonResults:[]};
assert.deepEqual(historySeasons([s1,s2]).map(s=>s.name),['Season 2','Season 1']);
assert.deepEqual(historySeasons([s2,s1]).map(s=>s.name),['Season 2','Season 1']);
assert.equal(allPreseasonGames(s2).length,0,'Future season may not inherit Season 1 preseason reports');
assert.equal(preseasonBracket(s2).completedGames,0,'Future bracket starts clean');

const row={player:101,team:'t1',stats:{hits:2,runs:1,rbi:1,
  homeRuns:0,atBats:3,plateAppearances:3,putouts:3,strikes:0},itemScore:0,gameScore:44,positions:['C']};
const final={id:'r1',phase:'regular',week:1,stage:'final',away:'t1',home:'t2',
  result:{scores:{t1:6,t2:5},players:[row]}};
const privateGame={id:'r2',phase:'regular',week:1,stage:'recorded',away:'t1',home:'t2',
  result:{scores:{t1:17,t2:1},players:[{...row,stats:{hits:100},gameScore:9000}]}};
const playoff={id:'p1',phase:'playoffs',week:0,stage:'final',away:'t2',home:'t1',
  result:{scores:{t1:4,t2:3},players:[{...row,stats:{...row.stats,hits:3},gameScore:55}]}};
const other={...s1,games:[final,privateGame,playoff]};
assert.equal(historyPublicGames(other).length,2);
assert.deepEqual(historySeasonGames(other,'regular').map(g=>g.id),['r1']);
assert.deepEqual(historySeasonGames(other,'playoffs').map(g=>g.id),['p1']);
assert.equal(historyOverview(other).regular,1);
assert.equal(historyOverview(other).playoffs,1);
assert.equal(historyRegularStandings(other).find(t=>t.id==='t1').wins,1);
const rows=historyTeamStats(other,'regular');
assert.equal(rows.length,12,'Every team must appear in historical team stats even at 0-0');
assert.equal(rows[0].id,'t1','Best win-loss record must head archived team stats');
assert.equal(rows.at(-1).id,'t2','A losing team must follow every unbeaten or unplayed team');
assert.equal(rows.find(t=>t.id==='t1').totals.hits,2);
assert.equal(rows.find(t=>t.id==='t1').gp,1,'Never count unreleased or playoff matches in regular stats');
assert.equal(rows.find(t=>t.id==='t1').runsFor,6);
assert.equal(rows.find(t=>t.id==='t1').agp!==null,true);
assert.equal(historyTeamStats(other,'playoffs').find(t=>t.id==='t1').totals.hits,3);
assert.equal(historyPlayerStats(other,'regular')[101].hits,2);
assert.equal(historyPlayerStats(other,'playoffs')[101].hits,3);
assert.equal(historyPlayerStats(other,'all')[101].hits,5);
assert(!JSON.stringify(historySchedule(other).find(g=>g.id==='r2')).includes('9000'),
  'Staged player scores must not leak through history game pages');
assert.equal(historySchedule(other).find(g=>g.id==='r2').result,undefined);
assert.equal(historySchedule(other).find(g=>g.id==='r1').result.scores.t1,6);

const trade={id:'trade-1',createdAt:'2026-11-03T12:00:00Z',body:{moves:[
  {from:'t1',to:'t2',kind:'player',id:101},
  {from:'t2',to:'t1',kind:'pick',id:'pick-x'},
]}};
const traded={...s1,pickAssets:[{id:'pick-x',round:4,originalTeam:'t2'}],transactions:[trade]};
const groups=historyTradeGroups(traded,trade,[{id:101,name:'Archive Player'}]);
assert.equal(groups.length,2);
assert.equal(groups.find(g=>g.teamId==='t2').assets[0].label,'Archive Player');
assert.match(groups.find(g=>g.teamId==='t1').assets[0].label,/Round 4/);

const archive=fs.readFileSync('src/HistoryArchive.jsx','utf8');
const league=fs.readFileSync('src/SeasonLeague.jsx','utf8');
assert.match(archive,/SEASON ARCHIVES/);
for(const tab of ['Preseason','Standings','Team Stats','Player Stats','Schedule & Results','Playoffs','Trades','Draft','Awards & Records','League News']){
  assert(archive.includes(tab),'History must expose '+tab);
}
assert(archive.includes('historyRegularStandings('));
assert(archive.includes('preseasonBracket('));
assert(archive.includes('PreseasonStats'));
assert(archive.includes('seasonBoxScore('));
assert(archive.includes('historyTradeGroups('));
assert(archive.includes('preseasonBoxScore('));
assert(!archive.includes('releasePreseasonReport'),'Archive must never release results');
assert(!archive.includes('savePreseasonReport'),'Archive must never modify game reports');
assert(!archive.includes('league.act('),'Archive cannot mutate league state');
assert(league.includes('<HistoryArchive seasons={l.seasons} supabase={l.supabase}/>'));
assert.match(league,/const rankedTeams = standings\(s\);/,'Current Team Stats must derive from standings');
assert.match(league,/const teamRows=rankedTeams\.map\(team=>\{/,'Team Stats must calculate rows using the official standings');
assert.match(league,/const rows=sortTeamStatRows\(teamRows,sort,view\);/,'Both Team Stats views must apply the requested column sort');
assert(league.includes('CAREER LEAGUE RECORDS'),'Existing cross-season records tab remains');
console.log('PASS: season-aware, read-only SSL History covering draft/preseason/standings/teams/players/box scores/playoffs/trades/awards/news with no private reports');
