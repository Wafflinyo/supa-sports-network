import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {leagueNews} from '../src/league-news.js';
import {
  matchHeadline,matchPerformanceHighlights,pitchingNewsPerformance,
  gameOutcomeContext,homepageHeadlineSlides
} from '../src/game-headlines.js';
const teams=[
 {id:'knights',name:'New Donk City Knights',logoPath:'knights.png'},
 {id:'checkers',name:'Diamond City Checkers',logoPath:'checkers.png'},
];
const players=[
 {id:1,name:'Wario'},{id:2,name:'Bowser'},{id:3,name:'Yoshi'},
 {id:4,name:'Luigi'},{id:5,name:'Diddy Kong'},
];
const row=(player,team,stats)=>({player,team,stats,gameScore:34});
const result=(gameId,awayScore,homeScore,rows,extras={})=>({
 id:gameId,week:1,phase:'regular',stage:'final',away:'knights',home:'checkers',
 releasedAt:'2026-11-04T08:00:00Z',result:{scores:{knights:awayScore,checkers:homeScore},players:rows},
 ...extras,
});
const season={id:'s1',number:1,name:'Season 1',teams,games:[],transactions:[]};

// Pitching tiers use official PGP, not total game score or a guessed number.
const pitching=(stats,scores={knights:6,checkers:4})=>
 pitchingNewsPerformance(row(3,'knights',stats),{away:'knights',home:'checkers',result:{scores}});
let p=pitching({outs:15,earnedRuns:2,strikes:6,runsAllowed:4});
assert.equal(p.pgp,20);assert.equal(p.tier,'good');
p=pitching({outs:15,earnedRuns:0,strikes:6,runsAllowed:4});
assert.equal(p.pgp,30);assert.equal(p.tier,'solid');
p=pitching({outs:15,earnedRuns:0,strikes:26,runsAllowed:4});
assert.equal(p.pgp,40);assert.equal(p.tier,'great');
assert(pitching({outs:14,earnedRuns:4,strikes:40,runsAllowed:5,pitchStrikeouts:3})===null,
 'Even enormous PGP does not qualify through the 20+ PGP rule before 5 full IP');
const four=pitching({outs:12,runsAllowed:2,earnedRuns:4,pitchStrikeouts:2});
assert(four,'Exactly 4 IP with 2 runs allowed qualifies');
assert(four.detail.includes('4.0 IP')&&four.detail.includes('2 strikeouts'));
assert(pitching({outs:12,runsAllowed:6,earnedRuns:2,pitchStrikeouts:1}),
 'At least 4 IP and <=2 ER qualifies even when runs allowed exceeds two');
assert.equal(pitching({outs:11,runsAllowed:0,earnedRuns:0}),null,'3.2 IP is below the four-inning exception');
assert.equal(pitching({outs:12,runsAllowed:3,earnedRuns:3}),null,'4 IP and 3 runs/ER does not qualify');
assert(!pitching({outs:0,earnedRuns:0,runsAllowed:0}, {knights:9,checkers:0}),
 'A player who did not pitch cannot claim shutout credit');
const shutout=pitching({outs:3,runsAllowed:0,earnedRuns:0,pitchStrikeouts:1},{knights:9,checkers:0});
assert(shutout?.shutout,'A participating reliever on a team shutout also qualifies');
assert(shutout.detail.includes('1 strikeout'),'Every qualifying pitcher should mention actual strikeouts');
const noK=pitching({outs:12,runsAllowed:2,earnedRuns:2,pitchStrikeouts:0});
assert(!noK.detail.includes('strikeout'),'Do not fabricate strikeouts when there are none');

// A single team/game post includes all teammates and all standout performances.
const dramatic=result('blowout',18,3,[
 row(1,'knights',{homeRuns:2,oneHr:2,rbi:5,runs:4}),
 row(2,'knights',{homeRuns:1,grandSlams:1,rbi:4}),
 row(3,'knights',{outs:15,pitchStrikeouts:3,earnedRuns:1,runsAllowed:1,putouts:9}),
 row(4,'knights',{outs:12,pitchStrikeouts:2,earnedRuns:2,runsAllowed:2}),
 row(5,'checkers',{hits:4,rbi:0}),
]);
season.games=[dramatic];
const news=leagueNews([season],players),match=news.find(e=>e.category==='match');
assert(match,'Every released result has a score-grounded game headline');
assert.equal(match.tier,'blowout');assert(match.title.includes('Wario')&&match.title.includes('2 home runs'));
const teamStory=news.filter(e=>e.category==='team-game'&&e.teamId==='knights');
assert.equal(teamStory.length,1,'All qualifying teammates appear in one combined news post');
for(const name of ['Wario','Bowser','Yoshi','Luigi'])
 assert(teamStory[0].summary.includes(name),name+' is included in a single news recap');
assert(teamStory[0].summary.includes("Week 1's win against the Diamond City Checkers."),
 'Expanded team story closes with week, win/loss and opponent');
assert(!news.some(e=>e.category==='pitching'&&e.teamId==='knights'),
 'There must not be separate per-pitcher stories in the same team-game');
assert(match.summary.includes('Yoshi')&&match.summary.includes('Luigi'),
 'Hero match summary must mention both qualifying pitchers');
assert(match.summary.includes('strikeouts'));

// Very close final scores are known; a walkoff or lead change requires
// separate verified commissioner scoring-sequence metadata.
const close=result('close',7,6,[]);
assert.equal(matchHeadline(season,close,players).tier,'close');
assert(!/walk.off|lead changes/i.test(matchHeadline(season,close,players).summary));
const walkoff={...close,story:{leadChanges:4,lateFinish:'walkoff'}};
assert.equal(matchHeadline(season,walkoff,players).tier,'walkoff');
assert(matchHeadline(season,walkoff,players).summary.includes('4 confirmed lead changes'));
const unconfirmed={...close,story:{leadChanges:0,lateFinish:'none'}};
assert.equal(matchHeadline(season,unconfirmed,players).tier,'close');
assert.equal(matchHeadline(season,result('shutout',10,0,[]),players).tier,'shutout');
assert.equal(matchHeadline(season,dramatic,players).tier,'blowout');
assert.equal(gameOutcomeContext(season,dramatic,'checkers'),
  "in Week 1's loss against the New Donk City Knights.");
assert.equal(matchPerformanceHighlights(dramatic,players).filter(e=>e.kind==='pitching').length,2,
  'Both qualifying pitchers must be retained, not deduped by stat type');

// Preseason champion always stays featured, other slides must be official
// distinct matches, never staged reports or repetitive individual stories.
const champion={seasonId:'s1',champion:teams[0]};
const stories=[match,matchHeadline(season,close,players),matchHeadline(season,result('shutout',10,0,[]),players)];
const pending={...dramatic,id:'private',stage:'recorded'};
assert(!matchHeadline(season,pending,players),'No public headline for private uploads');
const deck=homepageHeadlineSlides(champion,stories,'s1');
assert.equal(deck[0].kind,'champion');
assert.equal(deck.length,4);
assert.equal(new Set(deck.map(s=>s.id)).size,deck.length);
assert(homepageHeadlineSlides(champion,stories,'s1',2).length<=2);
assert(homepageHeadlineSlides(champion,[...stories,...stories,...stories], 's1').length<=5);

const source=readFileSync(new URL('../src/HomeHeadliners.jsx',import.meta.url),'utf8');
assert.match(source,/onTouchStart/);assert.match(source,/onTouchEnd/);
assert.match(source,/Previous headline/);assert.match(source,/Next headline/);
assert.match(source,/HeadlineReadMore/);
const feed=readFileSync(new URL('../src/HomeDashboard.jsx',import.meta.url),'utf8');
assert.match(feed,/HeadlineReadMore/);
const editor=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
assert.match(editor,/<GameStoryEditor key=\{g.id\}/);
const migration=readFileSync(new URL('../supabase/migrations/20261104072400_ssl_match_story_editor_and_private_headlines.sql',import.meta.url),'utf8');
assert.match(migration,/g:=g-''result''-''story''/);
console.log('PASS: exactly 20/30/40 PGP tiers, 4-IP low runs/ER, true shutouts, every Ks, grouped teammate reports, verified close finishes, five swipeable slides and private report embargo.');
