import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {savedReportCountingStats} from '../src/season-data.js';
import {previewPrivateGameBoxScore,seasonBoxScore,gameBoxScoreRates} from '../src/game-box-score-data.js';
import {heatingUpForSeason,HEATING_UP_THRESHOLD} from '../src/heating-up.js';

assert.equal(HEATING_UP_THRESHOLD,120);
const raw={
  hits:3,runs:2,atBats:4,totalBases:5,outs:9,pitches:28,strikes:17,
  earnedRuns:1,completeGames:1,mvps:1,starBases:0,
  battingAverage:0.75,era7:2.333,era9:3,whip:1.5,inningsPitched:3,
  obAgainst:0.3,opsAgainst:0.6,positionsPlayed:['P','1B']
};
const safe=savedReportCountingStats(raw);
assert.deepEqual(safe,{
  hits:3,runs:2,atBats:4,totalBases:5,outs:9,pitches:28,strikes:17,
  earnedRuns:1,completeGames:1,mvps:1,starBases:0
},'Only integer report counting stats are accepted; derived rates cannot be sent to backend');
assert.equal(safe.era7,undefined);
assert.equal(safe.inningsPitched,undefined);
assert.equal(safe.positionsPlayed,undefined);
const recalc=gameBoxScoreRates(safe);
assert.equal(recalc.battingAverage,.75);
assert.equal(recalc.era7,21/9);
assert.equal(recalc.inningsPitched,3);

const season={
  teams:[{id:'away',name:'New Donk City Fuggetaboudits'},{id:'home',name:'Moleville Haliban'}],
  rosters:{away:[1],home:[6]},
};
const game={id:'g1',week:1,stage:'scheduled',phase:'regular',away:'away',home:'home',label:'Week 1'};
const report={fingerprint:'f'.repeat(64),filename:'Week 1.xlsx',players:[
  {player:1,team:'away',positions:['P'],stats:safe,itemScore:0,gameScore:125},
  {player:6,team:'home',positions:['SS'],stats:{hits:2,runs:1,atBats:4,totalBases:2},itemScore:0,gameScore:67},
]};
const beforeSave=previewPrivateGameBoxScore(season,game,report);
assert(beforeSave?.hasPlayerStats,'full box score available before private upload');
assert.equal(beforeSave.stage,'COMMISSIONER ONLY · NOT RELEASED');
assert.deepEqual(beforeSave.teams.map(t=>t.score),[2,1]);
assert.deepEqual(beforeSave.teams.map(t=>t.hits),[3,2]);
assert.equal(beforeSave.teams[0].players[0].stats.era7,21/9);
assert.equal(beforeSave.teams[0].players[0].stats.battingAverage,.75);
assert.equal(seasonBoxScore(season,{...game,stage:'recorded',result:report}),null,
  'Unreleased game files must not leak through public box score API');
assert(previewPrivateGameBoxScore(season,game,null)===null);

const hotGame=(week,stage,points)=>({
 id:'week-'+week,phase:'regular',week,away:'away',home:'home',stage,
 result:points==null?undefined:{players:[
   {player:1,team:'away',gameScore:points},
   {player:6,team:'home',gameScore:85},
 ]},
});
const games=[hotGame(3,'scheduled'),hotGame(1,'recorded',120),hotGame(2,'scheduled')];
const baseline={...season,games};
assert.deepEqual(heatingUpForSeason(baseline).byGame['week-2'].away,[],
  'Private staged results cannot activate Heating Up');
assert.equal(heatingUpForSeason(baseline).players[1],undefined,
  'Private results cannot change official hot games/career counts');
const publicSeason={...baseline,games:games.map(g=>g.week===1?{...g,stage:'final',releasedAt:'2026-11-04T05:00:00Z'}:g)};
const afterRelease=heatingUpForSeason(publicSeason);
assert.deepEqual(afterRelease.byGame['week-2'].away,[1],
  'Game Score exactly 120 earns flame for next upcoming scheduled week without a game date');
assert.deepEqual(afterRelease.byGame['week-3'].away,[],
  'One Heating Up reward must not extend automatically across all future matchups');
assert.equal(afterRelease.players[1].currentHotStreak,1);
assert.equal(afterRelease.events[0].at,'2026-11-04T05:00:00Z',
  'Heating Up event uses the public release timestamp');
const nextReported={...publicSeason,games:publicSeason.games.map(g=>g.week===2
  ?hotGame(2,'recorded',20):g)};
assert.equal(heatingUpForSeason(nextReported).players[1].currentHotStreak,1,
  'Privately uploaded next-week sheet must not extinguish active Heating Up');
const nextReleased={...publicSeason,games:publicSeason.games.map(g=>g.week===2
  ?hotGame(2,'final',20):g)};
assert.equal(heatingUpForSeason(nextReleased).players[1].currentHotStreak,0,
  'Released next game below threshold ends the active fire');

const schedule=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const box=readFileSync(new URL('../src/GameBoxScore.jsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const cards=readFileSync(new URL('../src/PlayerProfileLink.jsx',import.meta.url),'utf8');
const playerData=readFileSync(new URL('../src/PlayerData.jsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261104061000_ssl_allow_complete_game_counting_stat.sql',import.meta.url),'utf8');
assert.match(schedule,/previewPrivateGameBoxScore\(l\.season,game,report\)/);
assert.match(schedule,/<GameBoxScore game=\{review.box\} inline\/>/);
assert.match(schedule,/onError:message=>setError\(message\)/);
assert.match(schedule,/PREVIEW SAVED PRIVATE BOX SCORE/);
assert.match(schedule,/RELEASE RESULTS PUBLICLY/);
assert.match(schedule,/REPLACE PRIVATE REPORT/);
assert.match(schedule,/<HeatMark playerId=\{x.player\} inline\/>/,
  'Pitcher/batter lineup choices must show the icon beside selected player');
assert.match(box,/inline\?'Batting':'Game Points'/,
  'Private preview opens on Batting rather than Game Points');
assert.match(cards,/<HeatMark playerId=\{player.id\} inline\/>/,
  'Player profile links and cards include official Heating Up symbol');
assert.match(playerData,/<PlayerPortrait player=\{player\} size=\{68\}\/>/,
  'Player Data details retain one portrait-mounted Heating Up badge');
assert.doesNotMatch(playerData,/<h3>\{player.name\} <HeatMark/,
  'Player Data details must not show a second flame beside the name');
assert.match(main,/heatingUpForSeason\(seasonLeague.season\)/,
  'Global player cards cannot derive active Heating Up from private uploads');
assert(!main.includes('heatingUpForSeason(seasonLeague.season,{includeRecorded'),
  'Commissioner private upload must not appear as officially heated');
assert.match(migration,/completeGames/,'Database validator must accept counted complete games');
console.log('PASS: rate-free report uploads, both teams full pre-save box score, public embargo, one-week fire on release, lineup and global card badges.');
