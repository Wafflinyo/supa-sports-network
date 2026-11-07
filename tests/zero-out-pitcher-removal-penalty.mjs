import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zeroOutRemovalForReportPitcher,previewCustomGameScore,
  reportRowStats,buildReport} from '../src/season-data.js';
import {customGameScore,SSL_GAME_SCORE_WEIGHTS} from '../src/ssl-game-score.js';
import {gamePointComponents,gamePointsForReport} from '../src/game-points.js';

const boo={player:'Boo',chosen:31,label:'Checkers',position:'3B',itemscore:0};
const iggy={player:'Iggy',chosen:32,label:'Checkers',position:'P',itemscore:0};
const luma={player:'Luma',chosen:33,label:'Voidstriders',position:'P',itemscore:0};
const booPitch={player:'Boo',chosen:31,label:'Checkers',inningspitched:0,
  battersfaced:5,pitches:10,strikes:2,hitsallowed:5,earnedruns:5,hrallowed:1};
const iggyPitch={player:'Iggy',chosen:32,label:'Checkers',inningspitched:2,
  battersfaced:10,pitches:20,strikes:5};
const lumaPitch={player:'Luma',chosen:33,label:'Voidstriders',inningspitched:2,
  battersfaced:8,pitches:14,strikes:7};
const preview={
  labels:['Checkers','Voidstriders'],
  rows:[boo,iggy,luma],
  pitch:[booPitch,iggyPitch,lumaPitch],
  inningScores:{away:[0,0,0,0,0,0,0],home:[0,0,0,0,0,0,0]},
  filename:'Week 2 Checkers at Voidstriders.xlsx',fingerprint:'sha',
};
assert.equal(SSL_GAME_SCORE_WEIGHTS.zeroOutRemoval,-10);
assert.equal(zeroOutRemovalForReportPitcher(preview,booPitch),1,
  'Boo faces five batters, retires none, then is replaced by Iggy on same team');
assert.equal(zeroOutRemovalForReportPitcher(preview,iggyPitch),0,
  'Pitchers recording outs get no zero-out removal penalty');
let score=previewCustomGameScore(preview,boo);
const baseline=reportRowStats(boo,booPitch);
assert.equal(baseline.outs,0);
assert.equal(baseline.inningsPitched,0);
assert.equal(customGameScore(baseline).gameScore,-20.75);
assert.equal(score.gameScore,-30.75,'Boo penalty stacks on ordinary PGP deductions');
const corrected={...baseline,zeroOutRemoval:1};
assert.equal(gamePointComponents(corrected).pgp,-30.75);
assert.equal(gamePointComponents(corrected).ogp,0);
assert.equal(gamePointComponents(corrected).dgp,0);
assert.equal(customGameScore(corrected).gameScore,-30.75);
const season={rosters:{away:[31,32],home:[33]}};
const game={away:'away',home:'home',phase:'regular',stage:'recorded'};
const report=buildReport(preview,'Checkers',season,game,[],null);
const saved=report.players.find(p=>p.player===31);
assert.equal(saved.stats.zeroOutRemoval,1,'Report persists official +1 penalty event');
assert.equal(saved.stats.outs,0,'Recorded 0.00 innings remains unchanged');
assert.equal(saved.gameScore,score.gameScore,'Preview and saved TGP agree');
assert.equal(gamePointsForReport(saved).pgp,-30.75);
assert.equal(gamePointsForReport(saved).tgp,saved.gameScore);
assert.equal(report.players.find(p=>p.player===32).stats.zeroOutRemoval,0);

const noRuns={...booPitch,earnedruns:0,runsallowed:0,hitsallowed:0,hrallowed:0};
const zeroRunsPreview={...preview,pitch:[noRuns,iggyPitch,lumaPitch]};
assert.equal(zeroOutRemovalForReportPitcher(zeroRunsPreview,noRuns),1,
  'The penalty does NOT depend on how many runs were allowed');
const noAppearance={...booPitch,battersfaced:0,pitches:0,strikes:0,
  hitsallowed:0,earnedruns:0,hrallowed:0};
assert.equal(zeroOutRemovalForReportPitcher({...preview,pitch:[noAppearance,iggyPitch,lumaPitch]},noAppearance),0,
  'Unused pitcher placeholders do not incur a penalty');
const lastPitcher={...booPitch};
assert.equal(zeroOutRemovalForReportPitcher({...preview,pitch:[iggyPitch,lastPitcher,lumaPitch]},lastPitcher),0,
  'Do not penalize a zero-out appearance without a subsequent same-team pitcher');
const otherTeamOnly={...preview,pitch:[lastPitcher,lumaPitch]};
assert.equal(zeroOutRemovalForReportPitcher(otherTeamOnly,lastPitcher),0,
  'A later opponent pitcher is not the same as being relieved');
const quarter={...booPitch,inningspitched:1/3};
assert.equal(zeroOutRemovalForReportPitcher({...preview,pitch:[quarter,iggyPitch,lumaPitch]},quarter),0,
  'Even one retired batter prevents this penalty');
const zeroBfWithPitches={...booPitch,battersfaced:0,pitches:2};
assert.equal(zeroOutRemovalForReportPitcher(
  {...preview,pitch:[zeroBfWithPitches,iggyPitch,lumaPitch]},zeroBfWithPitches),1,
  'Pitcher who actually threw pitches before being replaced still qualifies');
// Workbook records 1 HR allowed; if there were 2 HR, normal HR allowed costs
// a further eight PGP, independently of zero-out removal.
assert.equal(gamePointComponents({...corrected,hrAllowed:2}).pgp,-38.75);
const migration=readFileSync(
  new URL('../supabase/migrations/20261107124000_ssl_zero_out_pitcher_removal_penalty.sql',import.meta.url),'utf8');
assert.match(migration,/zeroOutRemoval/);
assert.match(migration,/- 10\*coalesce/);
console.log('PASS: actual zero-out relief exit costs -10 PGP regardless of runs, preserving 0.00 IP and matching saved box scores');
