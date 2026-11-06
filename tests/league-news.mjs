import assert from 'node:assert/strict';
import {leagueNews} from '../src/league-news.js';

const names = [{id: 1, name: 'Tropical Wiggler'}, {id: 2, name: 'Pink Noki'}];
const teams = [{id: 'sizzlers', name: 'Beachside Sizzlers'},
  {id: 'crushers', name: 'Color Clash Crushers'}];
const first = {
  player: 1, team: 'sizzlers', gameScore: 120,
  stats: {
    homeRuns: 2, oneHr: 1, twoHr: 0, threeHr: 1, grandSlams: 0,
    runs: 3, rbi: 3, putouts: 4, assists: 2, doublePlays: 2,
    triplePlays: 0, buddyJumpPutouts: 0, outs: 15,
    runsAllowed: 3, pitchStrikeouts: 0,
  },
};
const second = {
  player: 2, team: 'crushers', gameScore: 56,
  stats: {homeRuns: 0, runs: 1, rbi: 0, putouts: 0, assists: 1,
    doublePlays: 0, triplePlays: 0, pitchStrikeouts: 0},
};
const players = [first, second];
const season = {
  name: 'Season 1', teams,
  games: [
    {id: 'final-1', stage: 'final', away: 'sizzlers', home: 'crushers',
      startsAt: '2026-11-02T12:00:00Z', result: {players}},
    {id: 'recorded-2', stage: 'recorded', away: 'crushers', home: 'sizzlers',
      startsAt: '2026-11-03T12:00:00Z', result: {players}},
  ],
  transactions: [{id: 'trade-1', createdAt: '2026-11-01T12:00:00Z',
    body: {moves: [{kind: 'player', id: 1, from: 'sizzlers', to: 'crushers'}]}}],
};
const feed = leagueNews([season], names);
const byCategory = category => feed.filter(item => item.category === category);
const recognition = (list, category) => list
  .flatMap(item => item.recognitions || [item])
  .find(item => item.category === category);
assert.deepEqual(byCategory('heating').map(e => e.playerId), [1]);
assert.equal(byCategory('team-game').length, 1,
  'One player qualifying for HR, offense, defense and pitching gets ONE stats article');
assert.equal(byCategory('home-run').length, 0);
assert.equal(byCategory('offense').length, 0);
assert.equal(byCategory('defense').length, 0);
assert.equal(byCategory('pitching').length, 0);
assert.equal(byCategory('perfect-batting').length, 0);
assert.equal(byCategory('trade').length, 1);
assert.equal(feed.length, 3, 'one heating announcement, one combined stat post, one trade');
assert(byCategory('heating')[0].summary.includes('Color Clash Crushers'));
assert.equal(recognition(feed,'home-run').label, 'MULTI-HR PERFORMANCE');
assert(recognition(feed,'home-run').summary.length>20,
  'Grouped home-run recognition retains substantive prose even when reporter wording varies');
assert(byCategory('trade')[0].title.includes('Tropical Wiggler'));
assert(recognition(feed,'pitching').summary.includes('5.0 IP'));
assert.equal(recognition(feed,'offense').tier, 'good');
assert.equal(recognition(feed,'defense').tier, 'good');
assert(byCategory('team-game')[0].summary.includes('Home runs:') &&
  byCategory('team-game')[0].summary.includes('Offense:') &&
  byCategory('team-game')[0].summary.includes('Fielding:') &&
  byCategory('team-game')[0].summary.includes('Pitching:'));

const corrected = structuredClone(season);
corrected.games[0].result.players[0].stats.homeRuns = 1;
corrected.games[0].result.players[0].stats.oneHr = 1;
corrected.games[0].result.players[0].stats.threeHr = 0;
corrected.games[0].result.players[0].gameScore = 89;
const edited = leagueNews([corrected], names);
assert.equal(edited.filter(e => e.category === 'heating').length, 0);
assert.equal(recognition(edited,'home-run').tier, 'solo');
assert.equal(edited.filter(e => e.category === 'trade').length, 1);
assert.deepEqual(leagueNews([season], names), feed,
  'regeneration must not mutate data or randomize headlines');
const privateFeed = leagueNews([season], names, {includeRecorded: true});
assert.equal(privateFeed.filter(e => e.private).length, 2,
  'commissioner sees grouped private stat recognition and separate heating');
assert(privateFeed.filter(e => e.private).every(e =>
  ['heating','team-game'].includes(e.category)),
  'private grouping never leaks an embargoed article into the public feed');
assert.equal(feed.filter(e => e.private).length, 0,
  'public must never see recorded events');

function spot(stats, options = {}) {
  const row = {player: 1, team: 'sizzlers', stats, gameScore: 20};
  const oneGame = {name: 'Season 1', teams, games: [{
    id: options.id || 'tier-test', stage: options.stage || 'final',
    away: 'sizzlers', home: 'crushers', result: {players: [row]},
  }]};
  return leagueNews([oneGame], names, options).filter(x => x.category !== 'heating');
}
const find = (stats, category) => recognition(spot(stats),category);

// The 3HR category means ONE three-run homer, not three home runs.
const threeRun = find({homeRuns: 1, threeHr: 1}, 'home-run');
assert.equal(threeRun.tier, 'three-run');
assert(threeRun.summary.includes('1 home run'));
assert(threeRun.summary.includes('three-run home run'));
assert.equal(find({homeRuns: 1, grandSlams: 1}, 'home-run').tier, 'grand-slam');
assert.equal(find({homeRuns: 3, oneHr: 2, twoHr: 1}, 'home-run').tier, 'three-plus');
assert(find({homeRuns: 3, oneHr: 2, twoHr: 1}, 'home-run').summary.includes('3 home runs'));
assert.equal(find({homeRuns: 3, threeHr: 1}, 'home-run').tier, 'three-run',
  'Rio classified event count must not turn one three-run shot into three home runs');
assert.equal(find({homeRuns: 1, twoHr: 1}, 'home-run').tier, 'two-run');
assert.equal(find({homeRuns: 1}, 'home-run').tier, 'solo',
  'legacy reports without classified home run columns remain supported');
assert.equal(find({homeRuns: 0}, 'home-run'), undefined);

// Tiered offense uses runs scored + RBI (no double multiplication).
for (const [total, tier] of [[4, undefined], [5, 'good'], [7, 'good'],
  [8, 'outstanding'], [10, 'outstanding'], [11, 'elite']]) {
  assert.equal(find({runs: 2, rbi: total - 2}, 'offense')?.tier, tier);
}

// Defensive contributions include Buddy Jump putouts.
for (const [total, tier] of [[7, undefined], [8, 'good'], [10, 'good'],
  [11, 'outstanding'], [14, 'outstanding'], [15, 'elite']]) {
  assert.equal(find({putouts: total - 1, buddyJumpPutouts: 1}, 'defense')?.tier, tier);
}
assert.equal(find({putouts: 3, assists: 1, doublePlays: 1, triplePlays: 1,
  buddyJumpPutouts: 2}, 'defense').tier, 'good');

// Pitching: 5+ innings (15+ outs), at most 3 runs allowed, and zero Ks is fine.
assert.equal(find({outs: 15, runsAllowed: 3, pitchStrikeouts: 0}, 'pitching').tier, 'good');
assert.equal(find({outs: 15, runsAllowed: 2}, 'pitching').tier, 'good');
assert.equal(find({outs: 15, runsAllowed: 1}, 'pitching').tier, 'good');
assert.equal(find({outs: 16, runsAllowed: 0, pitchStrikeouts: 4}, 'pitching').tier, 'great');
assert(find({outs: 16, runsAllowed: 0, pitchStrikeouts: 4}, 'pitching').summary.includes('5.1 IP'));
assert.equal(find({outs: 14, runsAllowed: 0, pitchStrikeouts: 10}, 'pitching').tier, 'efficient');
assert.equal(find({outs: 21, runsAllowed: 4, pitchStrikeouts: 10}, 'pitching').tier, 'great');

// Perfect at the plate requires reaching base in every PA, not 100% batting average.
assert.equal(find({hits: 1, atBats: 1, batWalks: 1, hitByPitch: 1,
  plateAppearances: 3}, 'perfect-batting').tier, 'solid');
assert.equal(find({hits: 2, atBats: 2, batWalks: 1, hitByPitch: 1,
  plateAppearances: 4}, 'perfect-batting').tier, 'outstanding');
assert.equal(find({hits: 4, atBats: 4, batWalks: 2, plateAppearances: 6},
  'perfect-batting').tier, 'elite');
assert.equal(find({hits: 2, atBats: 2}, 'perfect-batting').tier, 'solid',
  'fallback PA denominator should work for old reports');
assert.equal(find({hits: 1, atBats: 1, plateAppearances: 1}, 'perfect-batting'), undefined,
  'a single plate appearance does not constitute a full-game highlight');
assert.equal(find({hits: 3, atBats: 4, plateAppearances: 4}, 'perfect-batting'), undefined);
assert.equal(find({hits: 2, atBats: 2, sacFlys: 1, plateAppearances: 3},
  'perfect-batting'), undefined);

console.log('PASS: tiered Rio news highlights, home run categories, perfect on-base, zero-K pitching, Buddy Jumps, embargo, trades, correction and stable copy');


// Approved seven-player swap: news must group incoming players by destination,
// regardless of the underlying transaction move order. No repeated arrows.
const newsTeams=[
  {id:'void',name:'Starborn Voidstriders'},
  {id:'knights',name:'New Donk City Knights'},
];
const swapPlayers=[
  {id:101,name:'Rosalina'}, {id:102,name:'Light Blue Yoshi'},
  {id:103,name:'Green Toad'}, {id:104,name:'Green Luma'},
  {id:105,name:'William'}, {id:106,name:'Purple Kritter'},
  {id:107,name:'Purple Toad'},
];
const swapMoves=[
  ...[101,102,103,104].map(id=>({kind:'player',id,from:'void',to:'knights'})),
  ...[105,106,107].map(id=>({kind:'player',id,from:'knights',to:'void'})),
];
const swapSeason={name:'Season 1',number:1,teams:newsTeams,games:[],
  transactions:[{id:'approved-swap',createdAt:'2026-11-03T14:00:00Z',
    body:{teams:['void','knights'],moves:swapMoves}}]};
const [swapNews]=leagueNews([swapSeason],swapPlayers);
assert.equal(swapNews.category,'trade');
assert.equal(swapNews.tradeGroups.length,2);
const incoming=new Map(swapNews.tradeGroups.map(g=>[g.teamName,g.assets.map(a=>a.label)]));
assert.deepEqual(incoming.get('Starborn Voidstriders'),['William','Purple Kritter','Purple Toad']);
assert.deepEqual(incoming.get('New Donk City Knights'),['Rosalina','Light Blue Yoshi','Green Toad','Green Luma']);
assert.match(swapNews.title,/complete a trade/i);
assert(!swapNews.summary.includes('→'),'notification copy should remain concise, without long arrows');
assert(swapNews.summary.includes('4 assets to New Donk City Knights'));

// Uneven / draft-pick trade should list the pick accurately with source franchise.
const pickSeason={...swapSeason,pickAssets:[{id:'next-pick',round:3,originalTeam:'knights'}],
  tradePickSeason:2,transactions:[{id:'approved-pick',createdAt:'2026-11-03T14:02:00Z',
    body:{teams:['void','knights'],moves:[
      {kind:'pick',id:'next-pick',from:'knights',to:'void'},
      {kind:'player',id:101,from:'void',to:'knights'},
    ]}}]};
const pickNews=leagueNews([pickSeason],swapPlayers)[0];
assert.equal(pickNews.tradeGroups.length,2);
assert(pickNews.tradeGroups.find(g=>g.teamId==='void').assets[0].label.includes('Season 2 · Round 3'));
assert(pickNews.tradeGroups.find(g=>g.teamId==='void').assets[0].label.includes('New Donk City Knights'));
assert.equal(pickNews.tradeGroups.find(g=>g.teamId==='knights').assets[0].label,'Rosalina');
assert.deepEqual(leagueNews([swapSeason],swapPlayers),[swapNews],'news trade formatting must be deterministic');
console.log('PASS: clear receiving-team trade breakdowns, large swaps and next-season draft picks');
