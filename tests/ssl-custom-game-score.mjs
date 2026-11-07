import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pitchMigration=readFileSync(new URL('../supabase/migrations/20261104003000_ssl_pgp_quarter_point_per_pitch.sql',import.meta.url),'utf8');
assert.match(pitchMigration,/0\.25\*coalesce/,'SQL verifier must score every recorded pitch');
assert.match(pitchMigration,/pitches.*numeric/,'SQL verifier must validate reported pitch count');
const outingMigration=readFileSync(new URL('../supabase/migrations/20261104001500_ssl_pgp_3ip_earned_run_tiers.sql',import.meta.url),'utf8');
assert.match(outingMigration,/THEN 12-2\*coalesce/,'Server must verify nonstacking 12/10/8/6 tier');
assert.match(outingMigration,/>=9/,'Pitching performance bonus requires at least nine outs');
const verifySql=(
 readFileSync(new URL('../supabase/migrations/20261029234800_ssl_pitching_outs_strikes_rebalance.sql',import.meta.url),'utf8')+'\n'+
 readFileSync(new URL('../supabase/migrations/20261103235900_ssl_pgp_2026_reweight.sql',import.meta.url),'utf8')
).replaceAll("''","'");
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
import {customGameScore,SSL_GAME_SCORE_WEIGHTS,SSL_HEATING_THRESHOLD,pitchingOutingBonus} from '../src/ssl-game-score.js';
import {gamePointComponents,gamePointsForReport} from '../src/game-points.js';
import {buildReport,automaticReportMvp,previewCustomGameScore,aggregate} from '../src/season-data.js';
import {heatingUpForSeason} from '../src/heating-up.js';
import {playerCareer} from '../src/player-career.js';
assert.equal(SSL_HEATING_THRESHOLD,120);
assert.deepEqual(SSL_GAME_SCORE_WEIGHTS,{
  hits:4,runs:6,rbi:8,homeRuns:15,doubles:4,triples:6,
  twoHr:2,threeHr:4,grandSlams:6,totalBases:4,
  hitlessAtBats:-2,batStrikeouts:-10,
  putouts:5,assists:4,buddyJumpPutouts:15,doublePlays:8,triplePlays:18,
  pitchStrikeouts:15,outs:1,strikes:.5,pitches:.25,earnedRuns:-3,
  hitsAllowed:-.25,pitchWalks:-2,beanBalls:-2,
  completeGames:20,hrAllowed:-8,mvps:10,
  bobbles:-6,doublePlaysHitInto:-6,triplePlaysHitInto:-10
});
assert.equal(Object.keys(SSL_GAME_SCORE_WEIGHTS).length,31);
assert.equal(customGameScore({
 pitchStrikeouts:2,outs:18,strikes:24,earnedRuns:2,
 completeGames:1,hrAllowed:1,mvps:1
}).gameScore,84,
 'two strikeouts +30, 6 IP +18, 24 strikes +12, 2 ER −6, complete game +20, 1 HR −8, MVP +10 and two-ER outing +8');
assert.equal(customGameScore({outs:18,strikes:0,earnedRuns:0,hrAllowed:0}).gameScore,30);
assert.equal(customGameScore({outs:19,strikes:45}).gameScore,53.5,
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
 hits:8,runs:6,rbi:16,homeRuns:15,doubles:4,twoHr:2,totalBases:24,
 putouts:5,pitchStrikeouts:15,bobbles:-6
});
assert.equal(customGameScore(sample).gameScore,89);
assert.equal(customGameScore(sample).heatingUp,false,'89 points no longer qualifies');
assert.equal(customGameScore({hits:25}).heatingUp,false,'100 no longer qualifies');
assert.equal(customGameScore({hits:30}).heatingUp,true,'120 qualifies exactly');
assert.equal(customGameScore({hits:29},3.99).heatingUp,false,'119.99 is below threshold');
assert.equal(customGameScore({hits:29},4).heatingUp,true,'120.00 is the inclusive cutoff');
assert.equal(customGameScore(sample,10).gameScore,99,'Item Score adds to custom raw stat score');
assert.throws(()=>customGameScore(sample,-1),/Item Score/);
assert.equal(customGameScore({bobbles:10}).gameScore,-60,'negative Game Points are not floored at zero');
assert.equal(customGameScore({hits:400}).gameScore,1600,'do not cap large legitimate Game Scores');
assert.equal(customGameScore({...sample,bobbles:2},0).gameScore,83);
assert.equal(customGameScore({...sample,bobbles:2},6).gameScore,89);
assert.equal(customGameScore({...sample,bobbles:2},6).heatingUp,false);
assert.equal(customGameScore({...sample,bobbles:2},11).gameScore,94);
assert.equal(customGameScore({...sample,bobbles:2},11).heatingUp,false);
assert.equal(customGameScore({...sample,bobbles:2},37).gameScore,120);
assert.equal(customGameScore({...sample,bobbles:2},37).heatingUp,true);
const row={player:'Bowser',position:'P',label:'A',chosen:10,
 hits:2,runs:1,rbi:2,homeruns:1,doubles:1,'2hr':1,putouts:1,bobbles:1,
 itemscore:10};
const pr={player:'Bowser',label:'A',chosen:10,strikeouts:1,strikes:4,pitches:20,inningspitched:1};
const preview={filename:'rio.xlsx',fingerprint:'sha',rows:[row],pitch:[pr]};
assert.equal(previewCustomGameScore(preview,row).gameScore,109,
 'one inning +3, four strikes +2 and twenty pitches +5 in the report preview');
assert.equal(previewCustomGameScore(preview,row,10).gameScore,119,
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
assert.equal(report.players[0].gameScore,109,'saved report score calculated from Rio stats');
assert.equal(report.players[0].baseGameScore,99);
assert.equal(report.players[0].itemScore,10);
assert.deepEqual(gamePointComponents(report.players[0].stats),{ogp:75,dgp:-1,pgp:25});
assert.deepEqual(gamePointsForReport(report.players[0]),{ogp:75,dgp:-1,pgp:25,tgp:109});
assert.equal(gamePointsForReport({...report.players[0],gameScore:-8}).tgp,109,'official stat formula overrides an outdated saved score');
assert.equal(report.players[0].stats.totalBases,6,'TB derived from hit types');
assert.equal(report.players[0].stats.pitchStrikeouts,1,'pitching strikeouts from Pitching sheet');
assert.equal(report.players[0].stats.outs,3);
assert.equal(report.players[0].stats.strikes,4,'pitching strikes from Pitching sheet');
assert.equal(report.players[0].stats.scorelessInnings,undefined,'no scoreless innings required');
assert.equal(report.players[0].stats.completeGames,0);
assert.equal(buildReport(preview,'A',season,game,[],10).players[0].gameScore,119,
 'commissioner MVP selection adds 10 in saved report');
const partial={...pr,inningspitched:'6.33',strikes:13,runsallowed:2,earnedruns:2,hrallowed:1,
 completegames:1};
const revised={...preview,pitch:[partial]};
assert.equal(previewCustomGameScore(revised,row).gameScore,143.5,
 '6⅓ IP earns +19, thirteen strikes +6.5, ER -6, HR -8, complete game +20');
assert.equal(previewCustomGameScore({...preview,pitch:[{...partial,scorelessinnings:999}]},row).gameScore,143.5,
 'retired scoreless-inning column cannot influence the result');
assert.equal(buildReport(revised,'A',season,game,[],null).players[0].stats.outs,19,
 'Project Rio 6.33 innings converts to 19 recorded outs');
assert.equal(buildReport(revised,'A',season,game,[],null).players[0].stats.completeGames,1);

assert.equal(report.players[0].stats.bobbles,1);
assert.equal(report.players[0].stats.mvps,0);
const g={...game,result:{players:report.players}};
season.games=[g];
assert.equal(aggregate(season)[10].gameScore,109,'store total custom score separately from fantasy score');
assert.equal(aggregate(season)[10].itemScore,10);
assert.equal(aggregate(season)[10].gameScoreAvg,109);
for(const [key,value] of Object.entries({ogp:75,dgp:-1,pgp:25,tgp:109,agp:109}))
 assert.equal(aggregate(season)[10][key],value,'season Game Points '+key);
const avg=playerCareer(10,[{id:'s1',playerStats:aggregate(season)}]);
assert.equal(avg.gameScore,109);
assert.equal(avg.averages.gameScore,109);
assert.deepEqual([avg.ogp,avg.dgp,avg.pgp,avg.tgp,avg.agp],[75,-1,25,109,109]);
assert.equal(avg.averages.agp,109);
const below={...game,id:'g0',startsAt:'2026-10-31T17:00:00Z',
  result:{players:[{...report.players[0],stats:{hits:29,atBats:29},gameScore:119}]}};
const above={...g,result:{players:[{...report.players[0],stats:{hits:30,atBats:30},gameScore:120}]}};
const hotSeason={...season,games:[below,above,{...game,id:'g2',stage:'scheduled',
 startsAt:'2026-11-02T17:00:00Z'}]};
const heat=heatingUpForSeason(hotSeason);
assert.equal(heat.players[10].heatingUpCount,1);
assert.deepEqual(heat.byGame.g2.a,[10]);
assert.deepEqual(heat.byGame.g1.a,[]);
const corrected={...hotSeason,games:[{...below,result:{players:[{...below.result.players[0],stats:{hits:30,atBats:30},gameScore:120}]}},above,hotSeason.games[2]]};
assert.equal(heatingUpForSeason(corrected).players[10].heatingUpCount,2,
 'corrected report recomputes historical qualifications, not duplicate them');
for (const [er,bonus] of [[0,12],[1,10],[2,8],[3,6],[4,0]]) {
  assert.equal(pitchingOutingBonus({outs:9,earnedRuns:er}),bonus,
    'Each eligible pitching appearance earns exactly one earned-run tier');
  assert.equal(gamePointComponents({outs:9,earnedRuns:er}).pgp,
    9-3*er+bonus,'Outing tier must be counted exactly once in PGP');
  assert.equal(customGameScore({outs:9,earnedRuns:er}).gameScore,
    9-3*er+bonus,'The custom Game Score and PGP must agree');
}
for(const outs of [0,3,8]){
  assert.equal(pitchingOutingBonus({outs,earnedRuns:0}),0,
    'Fewer than three innings earn no outing tier');
}
assert.equal(pitchingOutingBonus({outs:10,earnedRuns:0}),12,'Relief and partial innings qualify after nine outs');
assert.equal(pitchingOutingBonus({outs:9,earnedRuns:1.5}),0,'Invalid fractional earned runs cannot qualify');
assert.equal(gamePointComponents({outs:9,earnedRuns:0},30).pgp,51,
  'The +12 earned-run outing bonus can coexist with a +30 shutout bonus');
assert.equal(customGameScore({outs:9,earnedRuns:0},0,30).gameScore,51);
assert.equal(SSL_GAME_SCORE_WEIGHTS.pitches,.25);
assert.equal(customGameScore({pitches:20,strikes:8}).gameScore,9,
  'Twenty total pitches are +5 and eight strikes are an additional +4');
assert.equal(gamePointComponents({pitches:20,strikes:8}).pgp,9,
  'Pitch and strike bonuses must both be included in PGP');
assert.equal(customGameScore({pitches:1}).gameScore,.25,
  'Even a single recorded pitch is worth 0.25');
assert.equal(gamePointComponents({pitches:1}).pgp,.25);
assert.equal(customGameScore({pitches:0}).gameScore,0);
assert.throws(()=>customGameScore({pitches:-1}),/Invalid Game Score count/);
assert.throws(()=>customGameScore({pitches:1.5}),/Invalid Game Score count/);
assert.equal(gamePointComponents({outs:9,earnedRuns:3,pitches:40}).pgp,
  9-9+6+10,'A three-ER outing earns the one applicable +6 tier and +0.25 per pitch');
const soloShutoutMigration=readFileSync(new URL('../supabase/migrations/20261104005500_ssl_shutout_30_no_solo_cg_bonus.sql',import.meta.url),'utf8');
assert.match(soloShutoutMigration,/3000\.0\*outs\/total_outs/);
assert.match(soloShutoutMigration,/CASE WHEN coalesce/);
assert.equal(customGameScore({completeGames:1,outs:21},0,30).gameScore,63,
  'Seven-inning solo shutout counts +30 shutout, +21 IP, +12 clean-outing and no +20 CG');
assert.equal(gamePointComponents({completeGames:1,outs:21},30).pgp,63);
assert.equal(customGameScore({completeGames:1,outs:21,earnedRuns:1}).gameScore,48,
  'A complete game that allows an earned run still receives +20 CG and the one-ER outing bonus');
console.log('PASS: +0.25 per pitch, no +20 CG on solo +30 shutouts, and 3+ IP outing tier');

// Batting penalties stack; HR bonus replaces only its classified *extra* bonus.
assert.deepEqual({twoHr:SSL_GAME_SCORE_WEIGHTS.twoHr,threeHr:SSL_GAME_SCORE_WEIGHTS.threeHr,
  grandSlams:SSL_GAME_SCORE_WEIGHTS.grandSlams,homeRuns:SSL_GAME_SCORE_WEIGHTS.homeRuns},
  {twoHr:2,threeHr:4,grandSlams:6,homeRuns:15});
assert.equal(customGameScore({atBats:4,hits:1,batStrikeouts:1,doublePlaysHitInto:1}).gameScore,
  4-6-10-6,'hitless at-bats and K/DP stack as specified');
assert.equal(customGameScore({atBats:1,hits:0,buddyJumpsHitInto:1}).gameScore,-2,
  'Buddy Jump incurs only the missed-hit penalty');
