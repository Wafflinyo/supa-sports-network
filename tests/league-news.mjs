import assert from 'node:assert/strict';
import {leagueNews} from '../src/league-news.js';
const names=[{id:1,name:'Tropical Wiggler'},{id:2,name:'Pink Noki'}];
const players=[
 {player:1,team:'sizzlers',gameScore:94,stats:{homeRuns:2,runs:3,rbi:3,putouts:4,assists:2,doublePlays:2,triplePlays:0,pitchStrikeouts:2}},
 {player:2,team:'crushers',gameScore:56,stats:{homeRuns:0,runs:1,rbi:0,putouts:0,assists:1,doublePlays:0,triplePlays:0,pitchStrikeouts:0}}
];
const season={name:'Season 1',teams:[{id:'sizzlers',name:'Beachside Sizzlers'},{id:'crushers',name:'Color Clash Crushers'}],
 games:[{id:'final-1',stage:'final',away:'sizzlers',home:'crushers',startsAt:'2026-11-02T12:00:00Z',result:{players}},
 {id:'recorded-2',stage:'recorded',away:'crushers',home:'sizzlers',startsAt:'2026-11-03T12:00:00Z',result:{players}}],
 transactions:[{id:'trade-1',createdAt:'2026-11-01T12:00:00Z',body:{moves:[{kind:'player',id:1,from:'sizzlers',to:'crushers'}]}}]};
const feed=leagueNews([season],names);
assert.deepEqual(feed.filter(e=>e.category==='heating').map(e=>e.playerId),[1]);
assert.equal(feed.filter(e=>e.category==='home-run').length,1);
assert.equal(feed.filter(e=>e.category==='offense').length,1);
assert.equal(feed.filter(e=>e.category==='defense').length,1);
assert.equal(feed.filter(e=>e.category==='pitching').length,1);
assert.equal(feed.filter(e=>e.category==='trade').length,1);
assert.equal(feed.length,6,'only released games and one approved trade can appear');
assert(feed.find(e=>e.category==='heating').summary.includes('Color Clash Crushers'));
assert(feed.find(e=>e.category==='home-run').title.includes('two home runs'));
assert(feed.find(e=>e.category==='trade').title.includes('Tropical Wiggler'));
const corrected=structuredClone(season);
corrected.games[0].result.players[0].stats.homeRuns=1;
corrected.games[0].result.players[0].gameScore=89;
const edited=leagueNews([corrected],names);
assert.equal(edited.filter(e=>e.category==='heating').length,0);
assert.equal(edited.filter(e=>e.category==='home-run').length,1);
assert.equal(edited.filter(e=>e.category==='trade').length,1);
assert.equal(leagueNews([season],names).length,6,'correcting a report must not mutate previous inputs');
const privateFeed=leagueNews([season],names,{includeRecorded:true});
assert.equal(privateFeed.filter(e=>e.private).length,5,'Commissioner preview includes recorded events');
assert.equal(leagueNews([season],names).filter(e=>e.private).length,0,'Public must never see recorded events');
console.log('PASS: news feed thresholds, team names, embargo, trades, corrections and deduplication');
