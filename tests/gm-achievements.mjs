import assert from 'node:assert/strict';
import {GM_ACHIEVEMENTS,earnedAchievements,achievementProgress} from '../src/gm-achievements.js';
const badges=GM_ACHIEVEMENTS;
assert.equal(badges.length,79);
assert.equal(new Set(badges.map(b=>b.id)).size,79);
assert.equal(badges.filter(b=>b.category==='Wins').length,7);
assert.equal(badges.filter(b=>b.category==='Offense').length,25);
assert.equal(badges.filter(b=>b.category==='Defense').length,34);
assert.equal(badges.filter(b=>b.category==='Pitching').length,7);
assert.equal(badges.filter(b=>b.category==='Playoffs').length,6);
assert.deepEqual(badges.filter(b=>b.group==='player-putouts').map(b=>b.threshold),[5,8,10,12,15,18,20]);
assert.deepEqual(badges.filter(b=>b.group==='player-assists').map(b=>b.threshold),[5,8,10,12,15,18,20]);

const season={
  id:'season-1', name:'Season 1',
  teams:[{id:'knights',slot:1,name:'New Donk City Knights'},
    {id:'dedennes',slot:2,name:'Decalburg Dedennes'}],
  games:[],
};
const add=(id,teamRows,homeScore=10,awayScore=0,stage='final',phase='regular')=>{
  const game={id,phase,stage,home:'knights',away:'dedennes',
    startsAt:`2026-11-${String(season.games.length+1).padStart(2,'0')}T18:00:00Z`,
    result:{scores:{knights:homeScore,dedennes:awayScore},players:teamRows}};
  season.games.push(game);
  return game;
};
const row=(id,team,stats)=>({player:id,team,stats});
const stats={homeRuns:1,threeHr:1,runs:6,rbi:6,putouts:12,assists:12,
  doublePlays:3,triplePlays:1,buddyJumpPutouts:3,bobbles:1,
  pitchStrikeouts:5,outs:21,pitches:48};
const first=add('game-1',[row(7,'knights',stats),
  row(8,'knights',{putouts:4,assists:4}),
  row(5,'dedennes',{outs:20,pitches:40})],10,0);
let results=earnedAchievements([season],1);
const has = id => results.find(x=>x.id===id);
assert(has('winning-opener').earned);
assert(has('winning-1').earned);
assert(!has('winning-5').earned);
assert(has('season-homer-1').earned);
assert(has('game-homer-1').earned);
assert(!has('game-homer-3').earned,'3HR means a single three-run homer');
assert(has('player-putouts-12').earned);
assert(!has('player-putouts-15').earned);
assert(has('player-assists-12').earned);
assert(!has('player-assists-15').earned);
assert(has('team-double-plays-3').earned);
assert(has('team-buddy-jumps-3').earned);
assert(has('defense-shutout').earned);
assert(has('team-bobbles-1').earned,'negative badges still unlock');
assert(has('pitching-iron-arm').earned);
assert(has('team-strikeouts-5').earned);
assert(!has('pitching-superstar-reliever').earned,'never guess relief timing');
assert(!has('winning-perfect').earned,'never award a 22-0 badge before season completion');
// Player-to-player putouts/assists must never be pooled.
const split=add('game-2',[row(7,'knights',{putouts:6,assists:6}),
  row(8,'knights',{putouts:6,assists:6})],8,7);
assert(!earnedAchievements([{...season,games:[split]}],1).find(x=>x.id==='player-putouts-10').earned);
assert(!earnedAchievements([{...season,games:[split]}],1).find(x=>x.id==='player-assists-10').earned);
// Commissioner can read per-team awards, without GM account identities.
assert(!earnedAchievements([season],2).find(b=>b.id==='winning-1').earned);
// Embargo protects unreleased games.
const recorded=structuredClone(first);
recorded.stage='recorded';
assert.equal(earnedAchievements([{...season,games:[recorded]}],1).filter(b=>b.earned).length,0);
// Correcting an official result recalculates immediately.
const corrected=structuredClone(first);
corrected.result.players[0].stats.putouts=4;
corrected.result.players[0].stats.assists=4;
assert(!earnedAchievements([{...season,games:[corrected]}],1).find(x=>x.id==='player-putouts-5').earned);
assert(!earnedAchievements([{...season,games:[corrected]}],1).find(x=>x.id==='player-assists-5').earned);
// A verified pitch-substitution event can unlock Superstar Reliever.
const verified=structuredClone(first);
verified.result.achievementEvidence={superstarReliever:{knights:{
  verified:true,isSubstitute:true,finishedGame:true,inningsRemainingAtEntry:5,
  playerId:7,runsAllowed:1,
}}};
verified.result.players[0].stats.runsAllowed=1;
assert(earnedAchievements([{...season,games:[verified]}],1).find(x=>x.id==='pitching-superstar-reliever').earned);
verified.result.achievementEvidence.superstarReliever.knights.inningsRemainingAtEntry=4;
assert(!earnedAchievements([{...season,games:[verified]}],1).find(x=>x.id==='pitching-superstar-reliever').earned);
// Season scoping keeps the career collection even when switching seasons.
const other={id:'season-2',name:'Season 2',teams:season.teams,games:[]};
assert(earnedAchievements([season,other],1).some(b=>b.earned));
assert.equal(earnedAchievements([season,other],1,{seasonId:'season-2'}).filter(b=>b.earned).length,0);
assert.equal(achievementProgress([season],3).get('winning-1').length,0);
// Fully complete the 22-game regular season: all 22 must be played and won.
const perfect=structuredClone(season);
perfect.games=[];
for(let i=0;i<22;i++){
  perfect.games.push({id:`perfect-${i}`,stage:'final',phase:'regular',
    startsAt:new Date(Date.UTC(2026,10,1+i)).toISOString(),home:'knights',away:'dedennes',
    result:{scores:{knights:1,dedennes:0},players:[row(7,'knights',{homeRuns:1})]}});
}
assert(earnedAchievements([perfect],1).find(x=>x.id==='winning-perfect').earned);
perfect.games[12].result.scores.knights=0;
perfect.games[12].result.scores.dedennes=1;
assert(!earnedAchievements([perfect],1).find(x=>x.id==='winning-perfect').earned);
// Playoff series uses official bracket membership, not regular-season standings guesses.
const bracket=structuredClone(season);
bracket.status='postseason';
bracket.playoffTeams=['knights','dedennes'];
bracket.playoffSeries=[
  {id:'q1',round:'quarterfinal',high:'knights',low:'dedennes',winner:'knights'},
  {id:'s1',round:'semifinal',high:'knights',low:'dedennes',winner:'knights'},
  {id:'f1',round:'final',high:'knights',low:'dedennes',winner:'knights'},
];
bracket.games=[
 {id:'playoff-one',stage:'final',phase:'playoffs',seriesId:'q1',
  home:'knights',away:'dedennes',startsAt:'2026-12-01T17:00:00Z',
  result:{scores:{knights:4,dedennes:2},players:[row(7,'knights',{pitchStrikeouts:2})]}},
 {id:'playoff-two',stage:'final',phase:'playoffs',seriesId:'s1',
  home:'knights',away:'dedennes',startsAt:'2026-12-05T17:00:00Z',
  result:{scores:{knights:2,dedennes:1},players:[row(7,'knights',{pitchStrikeouts:1})]}},
 {id:'playoff-three',stage:'final',phase:'playoffs',seriesId:'f1',
  home:'knights',away:'dedennes',startsAt:'2026-12-10T17:00:00Z',
  result:{scores:{knights:2,dedennes:1},players:[row(7,'knights',{pitchStrikeouts:1})]}},
];
const playoffBadges=earnedAchievements([bracket],1);
for(const id of ['playoffs-qualified','playoffs-first-win','playoffs-series',
  'playoffs-semifinals','playoffs-finals','playoffs-champion'])
  assert(playoffBadges.find(b=>b.id===id).earned, id+' must unlock');
assert.equal(playoffBadges.find(b=>b.id==='playoffs-series').count,3);
assert(earnedAchievements([bracket],2).find(b=>b.id==='playoffs-qualified').earned);
assert(!earnedAchievements([bracket],2).find(b=>b.id==='playoffs-champion').earned);
const incomplete=structuredClone(bracket);
incomplete.playoffSeries[2].winner=null;
assert(!earnedAchievements([incomplete],1).find(b=>b.id==='playoffs-champion').earned);
const noPostseason=structuredClone(bracket);
noPostseason.status='regular';
noPostseason.playoffSeries=[];
noPostseason.playoffTeams=[];
assert(!earnedAchievements([noPostseason],1).find(b=>b.id==='playoffs-qualified').earned);
assert(!earnedAchievements([{...bracket,games:bracket.games.map(g=>({...g,stage:'recorded'}))}],1)
  .find(b=>b.id==='playoffs-first-win').earned);
console.log('PASS: 79 GM achievements, single-player thresholds, season history, 22-0, playoff advancement and championship, embargo and corrections');
