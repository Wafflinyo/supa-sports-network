import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pitchingShutoutBonuses,pitcherShutoutStats} from '../src/pitching-shutout.js';
import {gamePointComponents,gamePointsForReport} from '../src/game-points.js';
import {customGameScore,SSL_HEATING_THRESHOLD} from '../src/ssl-game-score.js';
import {previewCustomGameScore,previewShutoutBonuses,buildReport,aggregate} from '../src/season-data.js';
import {preseasonGames,preseasonShutoutBonuses,preseasonPlayerStatsForGame,preseasonPlayerStats,preseasonTeamStats} from '../src/preseason-game-data.js';
import {preseasonBoxScore,seasonBoxScore} from '../src/game-box-score-data.js';

const allocate=(awayScore,homeScore,pitchers)=>pitchingShutoutBonuses({
  away:'away',home:'home',awayScore,homeScore,pitchers
});
const solo=allocate(4,0,[{player:1,team:'away',outs:21},{player:2,team:'home',outs:21}]);
assert.deepEqual([...solo.entries()],[['1',30]],'One pitcher receives the full 30');
assert.deepEqual(pitcherShutoutStats(30,1),{shutouts:1,combinedShutouts:0});
const two=allocate(1,0,[{player:1,team:'away',outs:15},{player:2,team:'away',outs:6}]);
assert.deepEqual([...two.entries()],[['1',21.43],['2',8.57]],'5 innings and 2 innings split the exact +30');
assert.deepEqual(pitcherShutoutStats(21.43,2),{shutouts:0,combinedShutouts:1});
const three=allocate(6,0,[{player:1,team:'away',outs:12},{player:2,team:'away',outs:6},{player:3,team:'away',outs:3}]);
assert.deepEqual([...three.entries()],[['1',17.14],['2',8.57],['3',4.29]],'3-way split allocates remainder to largest fractional share');
assert.equal([...three.values()].reduce((a,b)=>a+b,0),30);
assert.deepEqual([...allocate(0,3,[{player:4,team:'home',outs:21}])],[['4',30]],'Home pitching shutouts are recognized');
assert.equal(allocate(4,2,[{player:1,team:'away',outs:21}]).size,0);
assert.equal(allocate(0,0,[{player:1,team:'away',outs:21}]).size,0);
assert.equal(allocate(4,0,[{player:1,team:'away',outs:0}]).size,0);
const equal=allocate(2,0,[{player:10,team:'away',outs:7},{player:2,team:'away',outs:7},{player:3,team:'away',outs:7}]);
assert.deepEqual([...equal.values()],[10,10,10]);
assert.equal(customGameScore({pitchStrikeouts:2},0,30).gameScore,60);
assert.equal(gamePointComponents({pitchStrikeouts:2},30).pgp,60);
assert.deepEqual(gamePointsForReport({stats:{pitchStrikeouts:2},itemScore:0,shutoutBonus:30}),{ogp:0,dgp:0,pgp:60,tgp:60});
assert.equal(customGameScore({hits:22},0,30).heatingUp,false);
assert.equal(customGameScore({hits:23},0,30).heatingUp,true,'Shutout bonus can cross the 120 Heating Up threshold');
assert.equal(SSL_HEATING_THRESHOLD,120);
// A solo shutout awards +30 instead of +30 and an additional +20 CG.
assert.equal(customGameScore({outs:21,completeGames:1,earnedRuns:0},0,30).gameScore,63);
assert.equal(gamePointComponents({outs:21,completeGames:1,earnedRuns:0},30).pgp,63);
assert.equal(customGameScore({completeGames:1},0,30).gameScore,30);
assert.equal(gamePointComponents({completeGames:1},30).pgp,30);
assert.equal(customGameScore({completeGames:1}).gameScore,20,
  'A complete game without a shutout still earns the full +20');
assert.equal(customGameScore({completeGames:1},0,20).gameScore,40,
  'A combined partial shutout share never suppresses complete-game points');
assert.throws(()=>customGameScore({},0,30.001),/Shutout bonus/);
assert.throws(()=>customGameScore({},0,31),/Shutout bonus/);

const preview={
  labels:['A','B'],filename:'example.xlsx',fingerprint:'test',
  rows:[
    {player:'Alpha',chosen:1,label:'A',position:'P',runs:1,itemscore:0},
    {player:'Beta',chosen:2,label:'A',position:'2B',runs:0,itemscore:0},
    {player:'Gamma',chosen:3,label:'B',position:'P',runs:0,itemscore:0},
  ],
  pitch:[
    {player:'Alpha',chosen:1,label:'A',inningspitched:3,strikes:0,pitches:20},
    {player:'Beta',chosen:2,label:'A',inningspitched:6,strikes:0,pitches:30},
    {player:'Gamma',chosen:3,label:'B',inningspitched:9,strikes:0,pitches:40},
  ],
};
assert.deepEqual([...previewShutoutBonuses(preview)],[['1',10],['2',20]],'Preview must include pitcher ratios');
const season={rosters:{away:[1,2],home:[3]},games:[]};
const game={id:'example',away:'away',home:'home',phase:'regular',stage:'final'};
const report=buildReport(preview,'A',season,game,[],null);
assert.deepEqual(report.players.map(p=>p.shutoutBonus),[10,20,0]);
assert.deepEqual(report.players.map(p=>p.stats.outs),[9,18,27]);
for(const row of preview.rows){
  const saved=report.players.find(p=>p.player===row.chosen);
  assert.equal(previewCustomGameScore(preview,row).gameScore,saved.gameScore,'Preview and saved report must agree');
}
assert.equal(report.players[0].gameScore,42,'Alpha run + pitching innings + shutout share +12 outing tier');
assert.equal(report.players[1].gameScore,57.5,'Beta 6 innings + 26.67 shared shutout +12 outing tier');
assert.equal(gamePointsForReport(report.players[1]).pgp,57.5);
const populated={...season,games:[{...game,result:{players:report.players,scores:{away:1,home:0}}}]};
const aggregateRows=aggregate(populated);
assert.equal(aggregateRows[1].combinedShutouts,1);
assert.equal(aggregateRows[2].combinedShutouts,1);
assert.equal(aggregateRows[1].shutouts??0,0);
assert.equal(aggregateRows[1].shutoutBonus,10);
const ordinaryBox=seasonBoxScore({teams:[{id:'away',name:'Alpha Team'},{id:'home',name:'Gamma Team'}]},populated.games[0]);
assert.equal(ordinaryBox.teams[0].players[0].stats.combinedShutouts,1);
assert.equal(ordinaryBox.teams[0].players[1].stats.combinedShutouts,1);
assert.equal(ordinaryBox.teams[0].totalGamePoints,99.5);
const shutoutOnly={...preview,pitch:preview.pitch.filter(p=>p.chosen!==2)};
const oneReport=buildReport(shutoutOnly,'A',season,game,[],null);
assert.equal(oneReport.players[0].shutoutBonus,30);
assert.equal(oneReport.players[1].shutoutBonus,0);
const soloAggregate=aggregate({...season,games:[{...game,result:{players:oneReport.players,scores:{away:1,home:0}}}]});
assert.equal(soloAggregate[1].shutouts,1);
assert.equal(soloAggregate[1].combinedShutouts??0,0);

const ruffians=preseasonGames.find(g=>g.gameId==='PSR1 Ruffians @ Dedennes');
assert.ok(ruffians);
assert.deepEqual([...preseasonShutoutBonuses(ruffians)],[['4',30]]);
const ruffiansPlayers=preseasonPlayerStatsForGame(ruffians);
const diddy=ruffiansPlayers.find(p=>p.playerId===4);
assert.equal(diddy.stats.shutoutBonus,30);
assert.equal(diddy.stats.shutouts,1);
assert.equal(diddy.stats.completeGames,1,'Solo shutout pitcher retains complete game in statistical history');
assert.equal(diddy.stats.combinedShutouts,0);
assert.equal(diddy.stats.pgp,95.25);
assert.equal(diddy.stats.tgp,129.25);
assert.equal(ruffiansPlayers.find(p=>p.playerId===13).stats.tgp,-8,'Negative Game Points still allowed');
const away=preseasonTeamStats().find(t=>t.teamName==='Rogueport Ruffians');
assert.equal(away.stats.shutouts,1);
assert.equal(away.stats.combinedShutouts,0);
assert.equal(away.stats.shutoutBonus,30);
assert.equal(away.stats.tgp,476.25);
const seasonPlayer=preseasonPlayerStats().find(p=>p.playerId===4);
assert.equal(seasonPlayer.stats.shutouts,1);
assert.equal(seasonPlayer.stats.shutoutBonus,30);
const box=preseasonBoxScore(ruffians);
assert.equal(box.teams[0].players.find(p=>p.playerId===4).stats.shutouts,1);
assert.equal(box.teams[0].players.find(p=>p.playerId===4).points.tgp,129.25);
assert.equal(box.teams[0].totalGamePoints,476.25);
for(const game of preseasonGames){
  const pts=preseasonPlayerStatsForGame(game);
  const totalShutouts=pts.filter(p=>p.stats.shutoutBonus>0);
  assert.equal(totalShutouts.length?Number(totalShutouts.reduce((s,p)=>s+p.stats.shutoutBonus,0).toFixed(2)):0,
    game.awayScore>0&&game.homeScore===0||game.homeScore>0&&game.awayScore===0?30:0,
    'A qualifying shutout must grant exactly 30 points per game, never 30 per pitcher');
}
for(const path of ['src/PreseasonStats.jsx','src/main.jsx','src/temporary-stat-columns.json']){
  const contents=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(contents,/combinedShutouts/,'Pitching stats must show combined shutout appearances: '+path);
  assert.match(contents,/shutoutBonus/,'Pitching stats must show shutout points: '+path);
}
const viewer=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
assert.match(viewer,/columns\['Pitching Stats'\]/);
assert.match(viewer,/shutoutBonus/);
const migration=readFileSync(new URL('../supabase/migrations/20261103024000_ssl_pitching_shutout_points.sql',import.meta.url),'utf8');
assert.match(migration,/shutout_expected/);
assert.match(migration,/team_runs/);
assert.match(migration,/whole_cents/);
assert.match(migration,/score_row->>'shutoutBonus'/);
console.log('PASS: +30 pitching shutout, no extra solo CG +20, combined split, solo/team shutout counts, PGP/TGP and server validation');
