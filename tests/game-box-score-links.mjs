import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preseasonGames} from '../src/preseason-game-data.js';
import {preseasonBoxScore,seasonBoxScore,reportForBracketMatch,unmatchedPreseasonReports,bracketScoreOnly} from '../src/game-box-score-data.js';

assert.ok(preseasonGames.length>=6,'All imported preseason games stay available');
for(const report of preseasonGames){
  const box=preseasonBoxScore(report);
  assert.equal(box.stage,'Preseason');
  assert.deepEqual(box.teams.map(t=>t.score),[report.awayScore,report.homeScore]);
  assert.equal(box.teams[0].name,report.away);
  assert.equal(box.teams[1].name,report.home);
  assert.equal(box.teams[0].players.length,9);
  assert.equal(box.teams[1].players.length,9);
  assert.equal(box.hasPlayerStats,true);
  for(const team of box.teams){
    const total=Math.round(team.players.reduce((sum,p)=>sum+p.points.tgp,0)*100)/100;
    assert.equal(team.totalGamePoints,total);
    for(const p of team.players){
      assert.ok(p.name&&!/^(red|blue|green|light blue) mii/i.test(p.name),'Players display SSL roster names');
      assert.ok(p.positions,'Box score must show player positions');
      assert.ok(Number.isFinite(Number(p.stats.hits||0)),'Box score keeps valid hit counts');
      assert.equal(typeof p.points.tgp,'number','Box score keeps game points');
    }
  }
}
const hopedogo=preseasonGames.find(g=>g.gameId==='PSR1 Hopedogo @ Voidstriders');
const hopedogoBox=preseasonBoxScore(hopedogo);
assert.equal(hopedogoBox.teams[0].totalGamePoints,648);
assert.equal(hopedogoBox.teams[1].totalGamePoints,409);
assert.equal(hopedogoBox.teams[0].players.find(p=>p.playerId===57).mvp,true);
const tanks=preseasonBoxScore(preseasonGames.find(g=>g.gameId==='PSR1 Fuggetaboudits @ Tanks'));
const waluigi=tanks.teams[1].players.find(p=>p.name==='Waluigi');
assert.deepEqual([waluigi.stats.plateAppearances,waluigi.stats.atBats,waluigi.stats.hits],[4,4,4]);

const pang=preseasonGames.find(g=>g.gameId==='PSR1 Checkers @ Pangolins');
const match={
  key:'R1-1',round:1,
  high:{id:'home',name:pang.home},
  low:{id:'away',name:pang.away},
  scoreA:pang.homeScore,scoreB:pang.awayScore,
  winner:{id:'away',name:pang.away},
};
assert.equal(reportForBracketMatch(match)?.gameId,pang.gameId,'Reverse seeded order should still resolve report');
assert.equal(reportForBracketMatch({...match,scoreA:999}),null,'Mismatch score must never attach wrong report');
assert.equal(reportForBracketMatch({...match,low:{id:'away',name:'Different Opponent'}}),null,'Mismatch opponent must never attach report');
assert.equal(reportForBracketMatch({...match,winner:null}),null,'Nonfinal matches must not open a box score');
assert.equal(unmatchedPreseasonReports({rounds:[{games:[match]}]}).length,preseasonGames.length-1,'Only matched reports disappear from unpaired bracket cards');
assert.equal(unmatchedPreseasonReports({rounds:[]}).length,preseasonGames.length,'Unseeded imported games stay on bracket as cards');
const scoreOnly=bracketScoreOnly(match);
assert.equal(scoreOnly.hasPlayerStats,false);
assert.deepEqual(scoreOnly.teams.map(t=>t.score),[pang.homeScore,pang.awayScore]);

const season={
  teams:[{id:'away',name:'Away Team'},{id:'home',name:'Home Team'}],
};
const game={
  id:'reg-1',phase:'regular',label:'Week 1',stage:'final',away:'away',home:'home',
  result:{
    scores:{away:3,home:5},
    players:[
      {player:6,team:'home',positions:['P','2B'],stats:{hits:2,runs:1,rbi:1,putouts:1,pitchStrikeouts:1,outs:3,strikes:10,mvps:1},itemScore:4},
      {player:12,team:'away',positions:['3B'],stats:{hits:1,runs:2,rbi:1,putouts:1},itemScore:0},
    ],
  },
};
const regular=seasonBoxScore(season,game);
assert.equal(regular.stage,'Regular Season');
assert.deepEqual(regular.teams.map(t=>t.score),[3,5]);
assert.equal(regular.hasPlayerStats,true);
assert.equal(regular.teams[1].players[0].name,'Daisy');
assert.equal(regular.teams[1].players[0].mvp,true);
assert.equal(regular.teams[1].players[0].points.ogp,22);
assert.equal(regular.teams[1].players[0].itemScore,4);
assert.equal(regular.teams[1].players[0].points.tgp,64);
assert.equal(seasonBoxScore(season,{...game,stage:'recorded'}),null,'Do not leak unreleased report statistics');
const finalWithoutReport=seasonBoxScore(season,{...game,result:{scores:{away:3,home:5}}});
assert.equal(finalWithoutReport.hasPlayerStats,false,'Final scores without player reports must be represented honestly');
assert.equal(finalWithoutReport.teams[0].score,3);

const bracketUI=readFileSync(new URL('../src/SeasonPreseason.jsx',import.meta.url),'utf8');
const scheduleUI=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const boxUI=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
assert.equal(bracketUI.includes('RECORDED PRESEASON RESULTS'),false);
assert.equal(bracketUI.includes('ImportedPreseasonResults'),false);
assert.match(bracketUI,/reportForBracketMatch\(game(?:,reports)?\)/);
assert.match(bracketUI,/onClick=\{\(\)=>onOpen\(report\?preseasonBoxScore\(report\):bracketScoreOnly\(game\)\)\}/);
assert.match(bracketUI,/UnlinkedReportCards/);
assert.match(scheduleUI,/g\.stage === "final" \? \(/);
assert.match(scheduleUI,/setBoxGameId\(g\.id\)/);
assert.match(scheduleUI,/currentBoxScore&&<GameBoxScore/);
for(const tab of ['Game Points','Batting','Fielding','Pitching']){
  assert.ok(boxUI.includes("'"+tab+"'"),tab+' box score tab must exist');
}
assert.match(boxUI,/role="dialog" aria-modal="true"/);
assert.match(boxUI,/event\.key==='Escape'/);
console.log('Interactive preseason bracket and finished schedule box scores: full stats, associations, MVP, fallbacks and no unreleased results verified.');
