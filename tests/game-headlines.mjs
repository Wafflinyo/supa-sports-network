import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gameOutcomeContext,matchHeadline,pitchingNewsPerformance,homepageHeadlineSlides,
  matchPerformanceHighlights} from '../src/game-headlines.js';
import {leagueNews} from '../src/league-news.js';

const rosters=[
  {id:1,name:'Wario'},{id:2,name:'Yoshi'},{id:3,name:'Blue Luma'},
  {id:4,name:'Vegeta'},{id:5,name:'Red Koopa'},{id:6,name:'Bowser'},
];
const season={id:'season-1',name:'Season 1',
 teams:[{id:'a',name:'Moleville Haliban',logoPath:'season1/haliban.png'},
   {id:'b',name:'Diamond City Checkers',logoPath:'season1/checkers.png'}],
 games:[]};
const results=(a,b,rows=[],extra={})=>({id:'g1',phase:'regular',week:1,
 stage:'final',away:'b',home:'a',releasedAt:'2026-11-04T12:10:00Z',
 result:{scores:{a,b},players:rows},...extra});
const pitcher=(player,stats,team='a',shutoutBonus=0)=>({
 player,team,stats,shutoutBonus,gameScore:60});
const check=(game,row)=>pitchingNewsPerformance(row,game);
let single=results(7,3);
assert.equal(check(single,pitcher(4,{outs:14,runsAllowed:3,earnedRuns:3})),null,
  '4.2 IP with 3 RA and 3 ER must not qualify without a shutout');
assert.equal(check(single,pitcher(4,{outs:11,runsAllowed:1,earnedRuns:1,pitchStrikeouts:3})),null,
  'Even a strong 3.2 IP outing cannot qualify without a shutout or 5 IP');
assert.equal(check(single,pitcher(4,{outs:12,runsAllowed:2,earnedRuns:3})).tier,'efficient',
  '4 IP with at most 2 runs allowed qualifies even with 3 earned runs recorded');
assert.equal(check(single,pitcher(4,{outs:12,runsAllowed:7,earnedRuns:2})).tier,'efficient',
  '4 IP with at most 2 earned runs qualifies even with more total runs allowed');
assert.equal(check(single,pitcher(4,{outs:12,runsAllowed:3,earnedRuns:3})),null,
  '4 IP with 3 total and 3 earned runs is not eligible');

const low=pitcher(4,{outs:15,pitches:32,runsAllowed:4,earnedRuns:3});
assert.equal(check(single,low).pgp,20);
assert.equal(check(single,low).tier,'good','5 IP and 20 PGP triggers good pitching');
const solid=pitcher(4,{outs:15,strikes:6,runsAllowed:4,earnedRuns:0});
assert.equal(check(single,solid).pgp,30);
assert.equal(check(single,solid).tier,'solid','5 IP and 30 PGP triggers solid pitching');
const great=pitcher(4,{outs:15,pitchStrikeouts:1,runsAllowed:4,earnedRuns:0});
assert.equal(check(single,great).pgp,42);
assert.equal(check(single,great).tier,'great','5 IP and 40+ PGP triggers great pitching');
assert.match(check(single,great).detail,/1 strikeout/);
const ks=pitcher(4,{outs:12,pitchStrikeouts:3,runsAllowed:2,earnedRuns:2});
assert.match(check(single,ks).detail,/3 strikeouts/);
assert.match(check(single,ks).detail,/PGP/);

const shutoutGame=results(7,0);
const combined=pitcher(4,{outs:6,pitchStrikeouts:1,runsAllowed:0,earnedRuns:0},'a',10);
assert.equal(check(shutoutGame,combined).shutout,true,
  'Any member of a winning shutout qualifies even with less than 4 IP');
assert.match(check(shutoutGame,combined).detail,/1 strikeout/);
assert.equal(check(single,combined),null,'0-run individual pitcher alone does not imply a full-game shutout');
assert.equal(check(results(0,7),pitcher(4,{outs:6,runsAllowed:0,earnedRuns:0},'a')),null,
  'Pitcher on losing team cannot claim a shutout');

const multi=results(15,3,[
  pitcher(1,{homeRuns:2,oneHr:2,hits:4,atBats:5,rbi:4}),
  pitcher(2,{hits:4,atBats:5,rbi:5}),
  pitcher(3,{putouts:8,assists:4}),
  pitcher(4,{outs:15,pitchStrikeouts:3,runsAllowed:2,earnedRuns:2}),
  pitcher(5,{outs:12,pitchStrikeouts:1,runsAllowed:2,earnedRuns:2}),
  pitcher(6,{outs:0,pitchStrikeouts:0},'b'),
 ]);
season.games=[multi];
const event=matchHeadline(season,multi,rosters);
assert(event);
assert.equal(event.tier,'blowout');
assert.equal(event.winner,'Moleville Haliban');
assert.match(event.title,/Wario.*2 home runs/);
for(const p of rosters.slice(0,5))assert(event.summary.includes(p.name),
  'Every qualifying teammate is included in the same match post: '+p.name);
assert(event.summary.includes('3 strikeouts'));
assert(event.summary.includes('1 strikeout'));
assert(event.summary.includes("Week 1's win against the Diamond City Checkers"));
assert.equal(gameOutcomeContext(season,multi,'b'),"in Week 1's loss against the Moleville Haliban.");
assert(matchPerformanceHighlights(multi,rosters).filter(x=>x.kind==='pitching').length===2,
  'Multiple pitchers appear in the same matchup rather than being discarded');
const posts=leagueNews([season],rosters);
const collective=posts.filter(x=>x.category==='team-game');
assert.equal(collective.length,1,'One grouped individual-performance post per team and game');
for(const p of rosters.slice(0,5))assert(collective[0].summary.includes(p.name));
assert(collective[0].summary.endsWith("Week 1's win against the Diamond City Checkers."));
assert.equal(posts.filter(x=>x.category==='pitching'&&x.teamId==='a').length,0,
  'Qualifying teammates are grouped, not repeated as separate pitching posts');

const shortShutout=results(5,0,[combined,{...combined,player:5,stats:{outs:4,pitchStrikeouts:2,runsAllowed:0,earnedRuns:0}}],{id:'g2'});
assert.equal(leagueNews([{...season,games:[shortShutout]}],rosters)
  .filter(x=>x.category==='match')[0].tier,'shutout');
assert.equal(leagueNews([{...season,games:[shortShutout]}],rosters)
  .filter(x=>x.category==='team-game').length,1);

const staged={...multi,stage:'recorded'};
assert(!leagueNews([{...season,games:[staged]}],rosters).some(x=>x.category==='match'),
  'An unreleased upload must never appear in the public headlines');
const acknowledged={...multi,story:{leadChanges:4,lateFinish:'walkoff',
  note:'The winning hit scored the runner from third.'}};
const close={...acknowledged,result:{...acknowledged.result,scores:{a:6,b:5}}};
const verified=matchHeadline(season,close,rosters);
assert.equal(verified.tier,'walkoff');
assert.match(verified.summary,/4 confirmed lead changes/);
assert.match(verified.summary,/winning hit scored/);
const unverified=matchHeadline(season,{...close,story:null},rosters);
assert.equal(unverified.tier,'close','Never infer a walk-off or lead changes from final score alone');
assert(!unverified.summary.includes('lead changes'));

const champion={seasonId:'season-1',champion:{name:'Moleville Haliban'}};
const six=Array.from({length:8},(_,i)=>({...event,id:'match:game'+i,
  gameId:'game'+i,at:new Date(Date.parse(event.at)-i*1000).toISOString()}));
const slides=homepageHeadlineSlides(champion,six,season.id);
assert.equal(slides.length,5,'Champion + four unique game features max');
assert.equal(slides[0].kind,'champion');
assert.deepEqual(slides.slice(1).map(x=>x.kind),['match','match','match','match']);
assert.equal(homepageHeadlineSlides(null,six,season.id).length,5);
assert.equal(homepageHeadlineSlides(null,[{...event,private:true}],season.id).length,0);
assert.equal(new Set(slides.map(x=>x.id)).size,5);

const slideComponent=readFileSync(new URL('../src/HomeHeadliners.jsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/HomeDashboard.jsx',import.meta.url),'utf8');
const editor=readFileSync(new URL('../src/GameStoryEditor.jsx',import.meta.url),'utf8');
const seasonComponent=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const more=readFileSync(new URL('../src/HeadlineReadMore.jsx',import.meta.url),'utf8');
assert.match(slideComponent,/onTouchStart/);
assert.match(slideComponent,/onTouchEnd/);
assert.match(slideComponent,/Previous headline/);
assert.match(slideComponent,/Next headline/);
assert.match(slideComponent,/Show headline/);
assert.match(slideComponent,/HeadlineReadMore/);
assert.match(home,/HeadlineReadMore/);
assert.match(more,/aria-expanded=\{expanded\}/);
assert.match(editor,/ssl_game_story_save/);
assert.match(seasonComponent,/<GameStoryEditor/);
assert(!slideComponent.includes('setInterval('),'No autoplay/animated rotation without reader action');
console.log('PASS: grouped team game highlights, 20/30/40 PGP pitching tiers, 4-IP low runs, all shutouts, each strikeout, week context, private embargo and five swipeable slides.');
