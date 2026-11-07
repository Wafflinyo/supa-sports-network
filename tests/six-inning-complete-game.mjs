import assert from 'node:assert/strict';
import {
  earnedSixInningCompleteGame,completeGameForReportPitcher,
  previewCustomGameScore,buildReport,reportRowStats,
} from '../src/season-data.js';
import {customGameScore} from '../src/ssl-game-score.js';
import {gamePointsForReport} from '../src/game-points.js';

const pitcher={player:'Ronald',chosen:31,team:'Away',label:'Away',
  inningspitched:'6.0',completegames:0,earnedruns:3,pitches:36,strikes:18};
const batter={player:'Ronald',chosen:31,team:'Away',label:'Away',
  position:'P',atbats:2,hits:1,singles:1,runs:1,itemscore:0};
const homeBatter={player:'Home Player',chosen:32,label:'Home',team:'Home',
  position:'C',atbats:4,hits:2,singles:2,runs:3,itemscore:0};
const lines={away:[0,0,0,0,0,0,1],home:[0,0,2,1,0,0,null]};
const preview={labels:['Away','Home'],rows:[batter,homeBatter],
  pitch:[pitcher],inningScores:lines,filename:'ronald.ods',fingerprint:'sha'};
const season={rosters:{away:[31],home:[32]}};
const game={away:'away',home:'home'};
assert(earnedSixInningCompleteGame(preview,pitcher));
assert.equal(completeGameForReportPitcher(preview,pitcher),1);
const without=reportRowStats(batter,pitcher);
assert.equal(without.completeGames,0,'Raw Rio report did not mark the shortened complete game');
const baseline=customGameScore(without).gameScore;
assert.equal(previewCustomGameScore(preview,batter).gameScore,baseline+20,
  'Live preview includes CG +20 even when Rio complete-game field is zero');
const report=buildReport(preview,'Away',season,game,[],null);
const ronald=report.players.find(p=>p.player===31);
assert.equal(ronald.stats.outs,18);
assert.equal(ronald.stats.completeGames,1);
assert.equal(ronald.gameScore,baseline+20);
assert.equal(gamePointsForReport(ronald).pgp,
  gamePointsForReport({...ronald,stats:{...ronald.stats,completeGames:0}}).pgp+20);
assert.deepEqual(report.innings,lines);

const zeros={...preview,inningScores:{away:[...lines.away],home:[0,0,2,1,0,0,0]}};
assert(earnedSixInningCompleteGame(zeros,pitcher),
  'Rio may display unplayed bottom of seventh as zero, not X/blank');
assert.equal(buildReport(zeros,'Away',season,game,[],null).players[0].stats.completeGames,1);
const withReliever={...preview,pitch:[pitcher,{...pitcher,chosen:33,player:'Reliever',inningspitched:0}]};
assert(!earnedSixInningCompleteGame(withReliever,pitcher),'Any additional team pitcher prevents automatic CG');
assert(!earnedSixInningCompleteGame({...preview,labels:['Home','Away']},pitcher),
  'Six innings for the home-side pitcher are not enough in a seven-inning game');
assert(!earnedSixInningCompleteGame({...preview,inningScores:{away:[0,0,0,0,0,0,4],home:[0,0,2,1,0,0,null]}},pitcher),
  'No CG if home team did not lead after visiting seventh');
assert(!earnedSixInningCompleteGame({...preview,inningScores:{away:[...lines.away],home:[0,0,2,1,0,0,1]}},pitcher),
  'No CG if home team actually bats in the seventh');
assert(!earnedSixInningCompleteGame({...preview,inningScores:{away:[0,0,0,0,0,1],home:[0,0,2,1,0,0]}},pitcher),
  'Game Info must prove the top of seventh was played');
const shortPitcher={...pitcher,inningspitched:5.99};
assert(!earnedSixInningCompleteGame({...preview,pitch:[shortPitcher]},shortPitcher),
  'Pitcher must actually record eighteen outs');
assert.equal(completeGameForReportPitcher({...preview,pitch:[{...pitcher,completegames:1}]},
  {...pitcher,completegames:1}),1,'Explicit verified Rio CG remains valid');
console.log('PASS: six-inning sole visiting pitcher earns +20 CG if bottom seventh is unplayed; no false positives');
