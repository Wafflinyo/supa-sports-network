import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const verifySql=readFileSync(new URL('../supabase/migrations/20261103235900_ssl_pgp_2026_reweight.sql',import.meta.url),'utf8');
for(const [name,term] of Object.entries({
 innings:"+ 1*coalesce((score_row->'stats'->>'outs')", 
 strikes:"+ 0.5*coalesce((score_row->'stats'->>'strikes')",
 earnedRuns:"- 3*coalesce((score_row->'stats'->>'earnedRuns')",
 completeGames:"+ 20*coalesce((score_row->'stats'->>'completeGames')", 
 hrAllowed:"- 8*coalesce((score_row->'stats'->>'hrAllowed')", 
 mvps:"+ 10*coalesce((score_row->'stats'->>'mvps')"
})){
 assert(verifySql.includes(term),'Backend must validate new scoring weight '+name);
}
assert(verifySql.includes("pg_get_functiondef('league_private.ssl_manage(text,uuid,jsonb)'"),
 'New scoring must preserve the live existing commissioner security wrapper');
assert(!/update league_private\.ssl_season_states/.test(verifySql),
 'Scoring migration must never mutate existing draft, lineups or saved game data');
import {customGameScore,SSL_GAME_SCORE_WEIGHTS,SSL_HEATING_THRESHOLD} from '../src/ssl-game-score.js';
import {gamePointComponents,gamePointsForReport} from '../src/game-points.js';
import {buildReport,automaticReportMvp,previewCustomGameScore,aggregate} from '../src/season-data.js';
import {heatingUpForSeason} from '../src/heating-up.js';
import {playerCareer} from '../src/player-career.js';
assert.equal(SSL_HEATING_THRESHOLD,120);
assert.deepEqual(SSL_GAME_SCORE_WEIGHTS,{
  hits:4,runs:6,rbi:8,homeRuns:15,doubles:4,triples:6,
  twoHr:8,threeHr:12,grandSlams:15,totalBases:4,
  putouts:5,assists:4,buddyJumpPutouts:15,doublePlays:8,triplePlays:18,
  pitchStrikeouts:15,outs:1,strikes:.5,earnedRuns:-3,
  completeGames:20,hrAllowed:-8,mvps:10,
  bobbles:-6,doublePlaysHitInto:-8,triplePlaysHitInto:-12
});
assert.equal(Object.keys(SSL_GAME_SCORE_WEIGHTS).length,25);
assert.equal(customGameScore({
 pitchStrikeouts:2,outs:18,strikes:24,earnedRuns:2,
 completeGames:1,hrAllowed:1,mvps:1
}).gameScore,76,
 'two strikeouts +30, 6 IP +18, 24 strikes +12, 2 ER −6, complete game +20, 1 HR −8 and MVP +10');
assert.equal(customGameScore({outs:18,strikes:0,earnedRuns:0,hrAllowed:0}).gameScore,18);
assert.equal(customGameScore({outs:19,strikes:45}).gameScore,41.5,
 'partial innings are prorated as 1 point per recorded out');
assert.equal(customGameScore({outs:1,strikes:1}).gameScore,1.5,
 'one-third inning earns 1 plus half a point for the strike');
assert.equal(customGameScore({scorelessInnings:6}).gameScore,0,
 'retired scoreless-innings field must never earn points');
assert.equal(customGameScore({outs:3,strikes:4,completeGames:1}).gameScore,25,
 'complete game earns +20 and innings and strikes still count');
assert.equal(customGameScore({earnedRuns:3,hrAllowed:2}).gameScore,-25,
 'pitching penalties can create negative final game scores');
assert.equal(customGameScore({mvps:1}).gameScore,10,
 'Match MVP bonus is 10, never 20');
const sample={
 hits:2,runs:1,rbi:2,homeRuns:1,doubles:1,twoHr:1,totalBases:6,
 putouts:1,pitchStrikeouts:1,bobbles:1
};
assert.deepEqual(Object.fromEntries(Object.entries(customGameScore(sample,10).detail).filter(([,v])=>v)),{
 hits:8,runs:6,rbi:16,homeRuns:15,doubles:4,twoHr:8,totalBases:24,
 putouts:5,pitchStrikeouts:15,bobbles:-6
});
assert.equal(customGameScore(sample).gameScore,95);
assert.equal(customGameScore(sample).heatingUp,false,'95 points no longer qualifies');
assert.equal(customGameScore({hits:25}).heatingUp,false,'100 no longer qualifies');
assert.equal(customGameScore({hits:30}).heatingUp,true,'120 qualifies exactly');
assert.equal(customGameScore({hits:29},3.99).heatingUp,false,'119.99 is below threshold');
assert.equal(customGameScore({hits:29},4).heatingUp,true,'120.00 is the inclusive cutoff');
assert.equal(customGameScore(sample,10).gameScore,105,'Item Score adds to custom raw stat score');
assert.throws(()=>customGameScore(sample,-1),/Item Score/);
assert.equal(customGameScore({bobbles:10}).gameScore,-60,'negative Game Points are not floored at zero');
assert.equal(customGameScore({hits:400}).gameScore,1600,'do not cap large legitimate Game Scores');
assert.equal(customGameScore({...sample,bobbles:2},0).gameScore,89);
assert.equal(customGameScore({...sample,bobbles:2},6).gameScore,95);
assert.equal(customGameScore({...sample,bobbles:2},6).heatingUp,false);
assert.equal(customGameScore({...sample,bobbles:2},11).gameScore,100);
assert.equal(customGameScore({...sample,bobbles:2},11).heatingUp,false);
assert.equal(customGameScore({...sample,bobbles:2},31).gameScore,120);
assert.equal(customGameScore({...sample,bobbles:2},31).heatingUp,true);
const row={player:'Bowser',position:'P',label:'A',chosen:10,
 hits:2,runs:1,rbi:2,homeruns:1,doubles:1,'2hr':1,putouts:1,bobbles:1,
 itemscore:10};
const pr={player:'Bowser',label:'A',chosen:10,strikeouts:1,strikes:4,inningspitched:1};
const preview={filename:'rio.xlsx',fingerprint:'sha',rows:[row],pitch:[pr]};
assert.equal(previewCustomGameScore(preview,row).gameScore,110,
 'one inning +3 and four strikes +2 in the report preview');
assert.equal(previewCustomGameScore(preview,row,10).gameScore,120,
 'selecting the MVP immediately includes the ten-point award in preview');
const otherPlayer={player:'Rival',position:'C',label:'B',chosen:1,hits:30,runs:0,itemscore:0};
const forMvp={...preview,labels:['A','B'],rows:[row,otherPlayer]};
assert.equal(automaticReportMvp(forMvp,'A'),10,
 'Only the highest scoring player on the winning team can be automatic MVP, even when an opponent scores more');
assert.equal(automaticReportMvp({...forMvp,rows:[{...row,runs:0},otherPlayer]},'A'),null,
 'Tied scores cannot produce an automatic MVP');
assert.equal(automaticReportMvp({...forMvp,rows:[{...row,chosen:0},otherPlayer]},'A'),null,
 'All players must be mapped before choosing MVP');

const season={id:'s1',name:'Season 1',number:1,rosters:{a:[10],b:[1]},games:[]};
const game={id:'g1',away:'a',home:'b',phase:'regular',
  stage:'final',startsAt:'2026-11-01T17:00:00Z'};
const report=buildReport(preview,'A',season,game,[],null);
assert.equal(report.players[0].gameScore,110,'saved report score calculated from Rio stats');
assert.equal(report.players[0].baseGameScore,100);
assert.equal(report.players[0].itemScore,10);
assert.deepEqual(gamePointComponents(report.players[0].stats),{ogp:81,dgp:-1,pgp:20});
assert.deepEqual(gamePointsForReport(report.players[0]),{ogp:81,dgp:-1,pgp:20,tgp:110});
assert.equal(gamePointsForReport({...report.players[0],gameScore:-8}).tgp,-8,'saved signed score remains authoritative');
assert.equal(report.players[0].stats.totalBases,6,'TB derived from hit types');
assert.equal(report.players[0].stats.pitchStrikeouts,1,'pitching strikeouts from Pitching sheet');
assert.equal(report.players[0].stats.outs,3);
assert.equal(report.players[0].stats.strikes,4,'pitching strikes from Pitching sheet');
assert.equal(report.players[0].stats.scorelessInnings,undefined,'no scoreless innings required');
assert.equal(report.players[0].stats.completeGames,0);
assert.equal(buildReport(preview,'A',season,game,[],10).players[0].gameScore,120,
 'commissioner MVP selection adds 10 in saved report');
const partial={...pr,inningspitched:'6.33',strikes:13,runsallowed:2,earnedruns:2,hrallowed:1,
 completegames:1};
const revised={...preview,pitch:[partial]};
assert.equal(previewCustomGameScore(revised,row).gameScore,136.5,
 '6⅓ IP earns +19, thirteen strikes +6.5, ER -6, HR -8, complete game +20');
assert.equal(previewCustomGameScore({...preview,pitch:[{...partial,scorelessinnings:999}]},row).gameScore,136.5,
 'retired scoreless-inning column cannot influence the result');
assert.equal(buildReport(revised,'A',season,game,[],null).players[0].stats.outs,19,
 'Project Rio 6.33 innings converts to 19 recorded outs');
assert.equal(buildReport(revised,'A',season,game,[],null).players[0].stats.completeGames,1);

assert.equal(report.players[0].stats.bobbles,1);
assert.equal(report.players[0].stats.mvps,0);
const g={...game,result:{players:report.players}};
season.games=[g];
assert.equal(aggregate(season)[10].gameScore,110,'store total custom score separately from fantasy score');
assert.equal(aggregate(season)[10].itemScore,10);
assert.equal(aggregate(season)[10].gameScoreAvg,110);
for(const [key,value] of Object.entries({ogp:81,dgp:-1,pgp:20,tgp:110,agp:110}))
 assert.equal(aggregate(season)[10][key],value,'season Game Points '+key);
const avg=playerCareer(10,[{id:'s1',playerStats:aggregate(season)}]);
assert.equal(avg.gameScore,110);
assert.equal(avg.averages.gameScore,110);
assert.deepEqual([avg.ogp,avg.dgp,avg.pgp,avg.tgp,avg.agp],[81,-1,20,110,110]);
assert.equal(avg.averages.agp,110);
const below={...game,id:'g0',startsAt:'2026-10-31T17:00:00Z',
  result:{players:[{...report.players[0],gameScore:119}]}};
const above={...g,result:{players:[{...report.players[0],gameScore:120}]}};
const hotSeason={...season,games:[below,above,{...game,id:'g2',stage:'scheduled',
 startsAt:'2026-11-02T17:00:00Z'}]};
const heat=heatingUpForSeason(hotSeason);
assert.equal(heat.players[10].heatingUpCount,1);
assert.deepEqual(heat.byGame.g2.a,[10]);
assert.deepEqual(heat.byGame.g1.a,[]);
const corrected={...hotSeason,games:[{...below,result:{players:[{...below.result.players[0],gameScore:120}]}},above,hotSeason.games[2]]};
assert.equal(heatingUpForSeason(corrected).players[10].heatingUpCount,2,
 'corrected report recomputes historical qualifications, not duplicate them');
console.log('PASS: custom 25-category Game Score, +3/IP +0.5/strike +20 CG -8/HR, +40 shutout, MVP +10 and career totals');
