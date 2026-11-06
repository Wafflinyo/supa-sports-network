import assert from 'node:assert/strict';
import roster from '../src/players.json' with {type:'json'};
import gameData from '../src/player-data.json' with {type:'json'};
import {
  PITCHING_STAT_WEIGHTS,pitchingRating,rosterPowerComponents,
  POWER_WEIGHTS,POWER_PITCHER_COUNT,POWER_SUPPORT_PITCHER_COUNT,
  OFFENSE_SPEED_WEIGHT,DEFENSE_SPEED_WEIGHT,DEFENSE_STAT_WEIGHTS,defenseRating,offenseRating,
  fieldingAbilityBonus,BASERUNNING_ABILITY_BONUS,
  gamePointPerformanceAdjustment,GAME_POINT_RELATIVE_CONFIG,
  GAME_POINT_BLEND_PER_REPORTED_GAME,GAME_POINT_BLEND_MAX,
  teamRegularGamePointAverages,leagueRegularGamePointAverages,powerRankings
} from '../src/power-rankings.js';

assert.deepEqual({...PITCHING_STAT_WEIGHTS},{
  stamina:.55,chargePitchSpeed:.10,curveballSpeed:.15,curve:.20,
},'The website must retain the commissioner-approved 55/10/15/20 pitching weights');
assert.equal(Object.values(PITCHING_STAT_WEIGHTS).reduce((sum,n)=>sum+n,0),1);
assert(Object.isFrozen(PITCHING_STAT_WEIGHTS),'Pitching weights must not be mutated at runtime');

const stats={
  'pitching stamina':80,'charge pitch speed':130,
  'curveball speed':122.5,'curve':40,
};
assert.equal(pitchingRating(stats),64.5,
  '55% of 80 plus 10% of normalized charge speed 50 plus 15% of curveball speed 50 plus 20% of curve 40');
assert.equal(pitchingRating({
  'pitching stamina':100,'charge pitch speed':170,'curveball speed':155,'curve':100,
}),100);
assert.equal(pitchingRating({
  'pitching stamina':0,'charge pitch speed':90,'curveball speed':90,'curve':0,
}),0);
assert.equal(pitchingRating({
  'pitching stamina':0,'charge pitch speed':190,'curveball speed':190,'curve':0,
}),25,'Pitch speed inputs are individually normalized and capped at 100');
assert.equal(pitchingRating({
  'pitching stamina':0,'charge pitch speed':80,'curveball speed':80,'curve':0,
}),0,'Pitch speeds below the normalized minimum contribute zero');

const eligible=roster.map(p=>p.id).filter(id=>gameData.players[id]?.stats).slice(0,9);
assert.equal(eligible.length,9,'Regression fixture must have nine actual SSL players');
const current=rosterPowerComponents(eligible,eligible[0],eligible.map((player,i)=>({
  player,position:['P','C','1B','2B','3B','SS','LF','CF','RF'][i],
})));
assert.equal(current.selectedPitchers.length,POWER_PITCHER_COUNT);
assert.equal(new Set(current.selectedPitchers.map(p=>p.id)).size,POWER_PITCHER_COUNT,
  'Starting pitcher is counted exactly once, with three distinct backups');
assert.equal(current.selectedPitchers[0].id,Number(eligible[0]));
assert.equal(POWER_SUPPORT_PITCHER_COUNT,3);
for(const pitcher of current.selectedPitchers){
  assert.equal(pitcher.pitching,Math.round(pitchingRating(gameData.players[pitcher.id].stats)*10)/10,
    'Each actual player must receive the new pitching formula');
}
const total=current.selectedPitchers.reduce((sum,p)=>sum+pitchingRating(gameData.players[p.id].stats),0);
assert.equal(current.pitching,Math.round((total/POWER_PITCHER_COUNT)*10)/10,
  'Team pitching rating must average the selected four pitchers equally');

assert.deepEqual({...POWER_WEIGHTS},{offense:.60,pitching:.20,defense:.20},
  'Commissioner-approved composite is 60% offense, 20% pitching, 20% defense');
assert.equal(OFFENSE_SPEED_WEIGHT,.05,'Offense speed contribution is unchanged');
assert.equal(BASERUNNING_ABILITY_BONUS,4,'Every hitter with a baserunning ability earns four offensive rating points');
const baseHitter={'charge hit power':0,'hit trajectory':'Low',
  'slap hit power':0,'slap contact size':0,'charge contact size':0};
const baseline=offenseRating(baseHitter);
assert.equal(baseline,5,'Low trajectory retains its 25%-weighted value of five');
for(const [stat,points] of [
  ['charge hit power',40],['slap hit power',25],
  ['slap contact size',5],['charge contact size',5],
]){
  assert.equal(offenseRating({...baseHitter,[stat]:100})-baseline,points,
    `${stat} must contribute exactly ${points} points at a 100 stat rating`);
}
assert.equal(offenseRating({...baseHitter,'hit trajectory':'High'})-baseline,20,
  'High trajectory must remain 20 points above Low at a 25% weight');
assert.equal(DEFENSE_SPEED_WEIGHT,.15,'Defense running speed contributes 15%');
assert.deepEqual({...DEFENSE_STAT_WEIGHTS},{fielding:.55,throwingSpeed:.30,runningSpeed:.15},
  'Approved defense is 55% fielding, 30% throwing, 15% speed');
assert.equal(defenseRating({'fielding':80,'outfield throwing speed':60,'speed':40}),68,
  'defense skill ratings must be directly weighted before chemistry and ability bonuses');
assert.equal(offenseRating({
  'charge hit power':100,'hit trajectory':'High','slap hit power':100,
  'slap contact size':100,'charge contact size':100,
}),100,'Approved offensive skill weights must total 100%');
assert.equal(fieldingAbilityBonus(9,'SS'),-12,'Fielding ability rules must be retained');

assert.deepEqual({...GAME_POINT_RELATIVE_CONFIG.scales},{ogp:100,dgp:90,pgp:15},
  'League-normalized Game Points retain separate OGP/DGP/PGP sensitivity scales');
assert.equal(GAME_POINT_RELATIVE_CONFIG.maxAdjustment,20,
  'An extreme performance cannot change a category by more than 20 times game weight');
assert.equal(GAME_POINT_BLEND_PER_REPORTED_GAME,.05);
assert.equal(GAME_POINT_BLEND_MAX,.60);
assert.equal(gamePointPerformanceAdjustment(null,30,'ogp'),0);
assert.equal(gamePointPerformanceAdjustment(30,null,'ogp'),0);
assert.equal(gamePointPerformanceAdjustment(30,30,'ogp'),0);
assert.equal(gamePointPerformanceAdjustment(0,0,'pgp'),0,
  'A league-average PGP including zero must be perfectly neutral');
assert.equal(gamePointPerformanceAdjustment(-5,-5,'pgp'),0,
  'Negative pitching points can still define a neutral league average');
assert.equal(gamePointPerformanceAdjustment(30,30,'missing'),0);
for(const key of ['ogp','dgp','pgp']){
  const spread=GAME_POINT_RELATIVE_CONFIG.scales[key];
  const positive=gamePointPerformanceAdjustment(100+spread,100,key);
  const negative=gamePointPerformanceAdjustment(100-spread,100,key);
  assert(positive>0&&positive<20, key+' above average must improve its category');
  assert(negative<0&&negative>-20,key+' below average must lower its category');
  assert(Math.abs(positive+negative)<1e-10,key+' positive and negative adjustments should balance');
  assert(gamePointPerformanceAdjustment(1e6,-1e6,key)<=20,
    'Extreme category values must be capped');
}
// Published team-box-score game points should affect only the right category,
// and only for regular-season games, never preseason or postseason.
const testTeam='test-franchise-a',second='test-franchise-b';
const regular={
  phase:'regular',stage:'final',home:testTeam,away:second,
  result:{scores:{[testTeam]:5,[second]:3},
    players:[
      {team:testTeam,player:eligible[0],stats:{
        hits:2,runs:1,putouts:3,pitchStrikeouts:2,earnedRuns:1
      }},
      {team:second,player:eligible[1],stats:{hits:1}}
    ]
  }
};
const fakePreseason={...regular,phase:'preseason',
  result:{...regular.result,players:[{team:testTeam,player:eligible[0],
    stats:{hits:900,putouts:900,pitchStrikeouts:900}}]}};
const fakePlayoffs={...fakePreseason,phase:'postseason'};
const gp=teamRegularGamePointAverages({games:[regular,fakePreseason,fakePlayoffs]},testTeam);
assert.equal(gp.games,1);
assert.equal(gp.gamesWithReports,1);
assert.equal(gp.ogp,14,'Two hits and one run earn 14 OGP');
assert.equal(gp.dgp,15,'Three putouts earn 15 DGP');
assert.equal(gp.pgp,27,'Two pitching Ks and one earned run allowed earn 27 PGP');
assert.deepEqual(teamRegularGamePointAverages({games:[fakePreseason,fakePlayoffs]},testTeam),{
  games:0,gamesWithReports:0,ogp:null,dgp:null,pgp:null
});
const originalBlank={...regular,result:{...regular.result,players:[]}};
assert.deepEqual(teamRegularGamePointAverages({games:[originalBlank]},testTeam),{
  games:1,gamesWithReports:0,ogp:null,dgp:null,pgp:null
},'Score-only games must not invent category production');
const orderedIds=roster.map(p=>p.id).filter(id=>gameData.players[id]?.stats).slice(0,11);
const lineup=orderedIds.slice(0,9).map((player,i)=>({
  player,position:['P','C','1B','2B','3B','SS','LF','CF','RF'][i],
}));
const teams=Array.from({length:12},(_,i)=>({
  id:i===0?testTeam:i===1?second:'team-'+i,name:'Team '+i
}));
const synthetic={
  status:'regular',teams,
  games:[],
  rosters:Object.fromEntries(teams.map(t=>[t.id,orderedIds])),
  defaults:Object.fromEntries(teams.map(t=>[t.id,{
    starters:lineup,bench:orderedIds.slice(9)
  }]))
};
const before=powerRankings(synthetic).find(t=>t.id===testTeam);
const afterSeason={...synthetic,games:[regular]};
const after=powerRankings(afterSeason).find(t=>t.id===testTeam);
const round1=n=>Math.round(n*10)/10;
const calc=(skill,adjustment,weight)=>round1(skill+weight*adjustment);
const league=leagueRegularGamePointAverages(afterSeason);
assert.equal(league.teamGamesWithReports,2,
  'Both teams\' reported player Game Points count toward league averages');
assert.deepEqual({ogp:league.ogp,dgp:league.dgp,pgp:league.pgp},
  {ogp:9,dgp:7.5,pgp:13.5},
  'League baseline comes from actual reported team-games, not fixed targets of 250/208/20');
assert.equal(after.performanceWeight,5,
  'One published regular-season game contributes exactly 5%');
assert.equal(after.gamePointAverages.pgp,27);
const delta={
  offense:gamePointPerformanceAdjustment(gp.ogp,league.ogp,'ogp'),
  defense:gamePointPerformanceAdjustment(gp.dgp,league.dgp,'dgp'),
  pitching:gamePointPerformanceAdjustment(gp.pgp,league.pgp,'pgp')
};
assert.equal(after.offense,calc(before.offense,delta.offense,.05),
  'Offense adjusts relative to actual league-average OGP only');
assert.equal(after.defense,calc(before.defense,delta.defense,.05),
  'Defense adjusts relative to actual league-average DGP only');
assert.equal(after.pitching,calc(before.pitching,delta.pitching,.05),
  'Pitching adjusts relative to actual league-average PGP only');
assert.equal(after.score,round1(before.rosterScore+.05*(
  .60*delta.offense+.20*delta.defense+.20*delta.pitching)),
  'Overall stays 60/20/20 with no win/loss or extra fixed-performance baseline');
assert.equal(after.rosterScore,before.rosterScore,
  'Lineup talent stays the original preseason score');
assert(!('gamePointBoosts' in after)&&!('formWeight' in after),
  'No old fixed bonuses or record-based performance modifier');
const adjusted=powerRankings({...synthetic,games:[fakePreseason,fakePlayoffs]})
  .find(t=>t.id===testTeam);
assert.deepEqual([adjusted.score,adjusted.offense,adjusted.defense,adjusted.pitching],
  [before.score,before.offense,before.defense,before.pitching],
  'Preseason/postseason cannot alter regular-season rankings');
const highDefense={...regular,result:{...regular.result,
  players:[{team:testTeam,player:eligible[0],stats:{
    hits:2,runs:1,putouts:20,pitchStrikeouts:2,earnedRuns:1
  }}]}};
const betterDefense=powerRankings({...synthetic,games:[highDefense]}).find(t=>t.id===testTeam);
assert(betterDefense.defense>after.defense,'Higher DGP increases defensive rating');
assert.equal(betterDefense.offense,after.offense,'Changing DGP must not change offense');
assert.equal(betterDefense.pitching,after.pitching,'Changing DGP must not change pitching');
const lowPitching={...regular,result:{...regular.result,
  players:[{team:testTeam,player:eligible[0],stats:{
    hits:2,runs:1,putouts:3,earnedRuns:7
  }}]}};
const worsePitching=powerRankings({...synthetic,games:[lowPitching]}).find(t=>t.id===testTeam);
assert(worsePitching.pitching<after.pitching,
  'Worse-than-league PGP can lower pitching below the original roster rating');
assert.equal(worsePitching.offense,after.offense);
assert.equal(worsePitching.defense,after.defense);

// A league-average team must stay at its own ORIGINAL baseline: no fixed
// 50-point performance rating and no assumption that 70 is league average.
const identicalReports={...regular,result:{...regular.result,
  players:[{team:testTeam,player:eligible[0],stats:{hits:3,putouts:7,earnedRuns:1}},
    {team:second,player:eligible[1],stats:{hits:3,putouts:7,earnedRuns:1}}]}};
const avgTeam=powerRankings({...synthetic,games:[identicalReports]}).find(t=>t.id===testTeam);
assert.equal(avgTeam.performanceWeight,5);
assert.equal(avgTeam.score,before.score);
assert.equal(avgTeam.offense,before.offense);
assert.equal(avgTeam.defense,before.defense);
assert.equal(avgTeam.pitching,before.pitching);
assert.deepEqual(avgTeam.gamePointAdjustments,{offense:0,defense:0,pitching:0});
assert.equal(avgTeam.leagueGamePointAverages.ogp,12);
assert.equal(avgTeam.leagueGamePointAverages.dgp,35);

// Win/loss score and run differential must not change the Power Rankings.
const reversedScore={...regular,result:{...regular.result,
  scores:{[testTeam]:0,[second]:20}}};
const reversed=powerRankings({...synthetic,games:[reversedScore]}).find(t=>t.id===testTeam);
assert.equal(reversed.score,after.score);
assert.equal(reversed.offense,after.offense);
assert.equal(reversed.defense,after.defense);
assert.equal(reversed.pitching,after.pitching);
assert.equal(reversed.losses,1);
const scoreOnly={...regular,result:{...regular.result,players:[]}};
const unreported=powerRankings({...synthetic,games:[scoreOnly]}).find(t=>t.id===testTeam);
assert.equal(unreported.performanceWeight,0,'Score-only games have no report-based influence');
assert.equal(unreported.score,before.score);
const oneReportedOneUnreported=powerRankings({...synthetic,
  games:[regular,{...scoreOnly,id:'score-only'}]}).find(t=>t.id===testTeam);
assert.equal(oneReportedOneUnreported.performanceWeight,5);
assert.equal(oneReportedOneUnreported.gamePointAverages.ogp,gp.ogp);
assert.equal(oneReportedOneUnreported.score,after.score);
const eight=powerRankings({...synthetic,
  games:Array.from({length:8},(_,i)=>({...regular,id:'reg-'+i}))})
  .find(t=>t.id===testTeam);
assert.equal(eight.performanceWeight,40,'Eight reports contribute 40%, not 60%');
assert.equal(eight.offense,calc(before.offense,delta.offense,.40));
const twelve=powerRankings({...synthetic,
  games:Array.from({length:12},(_,i)=>({...regular,id:'reg-'+i}))})
  .find(t=>t.id===testTeam);
assert.equal(twelve.performanceWeight,60,'Twelve reports reach the 60% cap');
assert.equal(twelve.offense,calc(before.offense,delta.offense,.60));
assert.equal(twelve.defense,calc(before.defense,delta.defense,.60));
assert.equal(twelve.pitching,calc(before.pitching,delta.pitching,.60));
const thirteen=powerRankings({...synthetic,
  games:Array.from({length:13},(_,i)=>({...regular,id:'reg-'+i}))})
  .find(t=>t.id===testTeam);
assert.equal(thirteen.performanceWeight,60);
assert.equal(thirteen.score,twelve.score,'A stable season average keeps the cap stable');

// Team-game weighting, rather than equal weighting of per-team averages.
const unequalGames={...synthetic,games:[
  regular,
  {...regular,id:'second',result:{...regular.result,
    players:[{team:testTeam,player:eligible[0],stats:{hits:5}},
      {team:second,player:eligible[1],stats:{hits:1}}]}}
]};
const unequalBaseline=leagueRegularGamePointAverages(unequalGames);
assert.equal(unequalBaseline.teamGamesWithReports,4);
assert.equal(unequalBaseline.ogp,(14+4+20+4)/4);
assert.equal(unequalBaseline.dgp,(15+0+0+0)/4);

console.log('PASS: league-relative OGP/DGP/PGP adjustments, five percent per reported game, 12-game 60 percent cap, no arbitrary average or duplicate win/loss form');
