import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gameLineupSubmissionStatus} from '../src/roster-lineups.js';
import {customGameScore,SSL_HEATING_THRESHOLD} from '../src/ssl-game-score.js';
import {HEATING_UP_THRESHOLD} from '../src/heating-up.js';

const roster=Array.from({length:11},(_,i)=>i+1);
const positions=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const make=ids=>({
  starters:ids.slice(0,9).map((player,i)=>({player,position:positions[i]})),
  bench:ids.slice(9),
});
const defaultLineup=make(roster);
const custom=make([9,8,7,6,5,4,3,2,1,10,11]);
const season={rosters:{a:roster},defaults:{a:defaultLineup}};
const game={id:'g1',stage:'scheduled',away:'a',home:'b',lineups:{}};

let status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'fallback');
assert.match(status.label,/NOT SUBMITTED/);
assert.match(status.detail,/automatic fallback/);

game.lineups.a=structuredClone(defaultLineup);
game.lineupSubmission={a:{source:'default',by:'gm',at:'2026-11-03T02:00:00Z'}};
status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'default');
assert.match(status.label,/GM SUBMITTED DEFAULT LINEUP/);
assert.equal(status.at,'2026-11-03T02:00:00Z');

game.lineups.a=custom;
game.lineupSubmission.a={source:'custom',by:'gm'};
status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'custom');
assert.match(status.label,/GM SUBMITTED CUSTOM LINEUP/);
game.lineupSubmission.a={source:'default',by:'commissioner'};
status=gameLineupSubmissionStatus(season,'a',game);
assert.match(status.label,/COMMISSIONER SUBMITTED DEFAULT LINEUP/);

delete game.lineupSubmission;
status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'legacy-custom');
game.lineups.a=defaultLineup;
status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'legacy-default');
game.stage='live';
status=gameLineupSubmissionStatus(season,'a',game);
assert.equal(status.kind,'unknown','Automatic kickoff fallback must not be mistaken for GM submission');
assert.match(status.label,/UNKNOWN/);
game.stage='final';
assert.equal(gameLineupSubmissionStatus(season,'a',game).kind,'unknown');
game.stage='scheduled';
game.lineups={};
season.defaults={};
assert.equal(gameLineupSubmissionStatus(season,'a',game).kind,'missing');

assert.equal(SSL_HEATING_THRESHOLD,120);
assert.equal(HEATING_UP_THRESHOLD,120);
assert.equal(customGameScore({hits:30}).heatingUp,true,'120 inclusive');
assert.equal(customGameScore({hits:29},3.99).heatingUp,false,'119.99 not qualified');
assert.equal(customGameScore({hits:29},4).heatingUp,true,'120 qualifies');
assert.equal(customGameScore({hits:25}).heatingUp,false,'100 not qualified');

const league=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const badges=readFileSync(new URL('../src/HeatingUpBadge.jsx',import.meta.url),'utf8');
const rules=readFileSync(new URL('../src/LeagueRules.jsx',import.meta.url),'utf8');
const news=readFileSync(new URL('../src/league-news.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261103014000_ssl_lineup_submission_provenance.sql',import.meta.url),'utf8');
assert.match(league,/VIEW LINEUPS & SUBMISSION STATUS/);
assert.match(league,/gameLineupSubmissionStatus\(s,id,g\)/);
assert.match(league,/HEATING_UP_THRESHOLD/);
assert.match(badges,/HEATING_UP_THRESHOLD/);
assert.equal(badges.includes('95+'),false);
assert.match(rules,/HEATING_UP_THRESHOLD/);
assert.match(news,/HEATING_UP_THRESHOLD/);
assert.match(sql,/op='game_lineup'/);
assert.match(sql,/payload->>'useDefault'/);
assert.match(sql,/lineupSubmission/);
assert.match(sql,/league_private\.ssl_manage_before_stars/);
assert.match(sql,/a->>'role'/);
console.log('PASS: Explicit default/custom vs fallback vs kickoff-locked provenance, 120+ heating rule and UI labels');
