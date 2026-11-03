import assert from 'node:assert/strict';
import roster from '../src/players.json' with {type:'json'};
import gameData from '../src/player-data.json' with {type:'json'};
import {
  PITCHING_STAT_WEIGHTS,pitchingRating,rosterPowerComponents,
  POWER_WEIGHTS,POWER_PITCHER_COUNT,POWER_SUPPORT_PITCHER_COUNT,
  OFFENSE_SPEED_WEIGHT,DEFENSE_SPEED_WEIGHT,DEFENSE_STAT_WEIGHTS,defenseRating,offenseRating,
  fieldingAbilityBonus,BASERUNNING_ABILITY_BONUS,
  gamePointCategoryBoost,GAME_POINT_BOOST_CONFIG,
  teamRegularGamePointAverages,powerRankings
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

assert.deepEqual({...GAME_POINT_BOOST_CONFIG.scales},{
  ogp:{center:250,spread:100},
  dgp:{center:208,spread:90},
  pgp:{center:20,spread:15}
},'Three independently calibrated production curves must remain available');
assert.equal(gamePointCategoryBoost(null,'ogp'),0,'Unreported scores should never award free game point bonuses');
for(const stat of ['ogp','dgp','pgp']){
  const low=gamePointCategoryBoost(-50,stat),
    mid=gamePointCategoryBoost(GAME_POINT_BOOST_CONFIG.scales[stat].center,stat),
    high=gamePointCategoryBoost(999,stat);
  assert(low>0&&low<mid&&mid<high&&high<10,
    stat+' boosts must always be positive and increase with per-game productivity');
  assert(Math.abs(mid-5.25)<1e-8,
    stat+' midpoint should have a +5.25 projected rating boost');
}
assert(gamePointCategoryBoost(-50,'pgp')<gamePointCategoryBoost(0,'pgp'));
assert(gamePointCategoryBoost(0,'pgp')<gamePointCategoryBoost(50,'pgp'));
assert(gamePointCategoryBoost(250,'ogp')>gamePointCategoryBoost(100,'ogp'));
assert(gamePointCategoryBoost(250,'dgp')>gamePointCategoryBoost(100,'dgp'));

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
const after=powerRankings({...synthetic,games:[regular]}).find(t=>t.id===testTeam);
assert(after.offense>before.offense,'OGP improves offensive category');
assert(after.defense>before.defense,'DGP improves defensive category');
assert(after.pitching>before.pitching,'PGP improves pitching category');
assert.equal(after.gamePointAverages.pgp,27);
assert(after.rosterScore>before.rosterScore,'Category boosts must flow into the overall roster component');
assert.equal(after.formWeight,7.5,'First regular game retains 7.5% team-form influence');
const adjusted=powerRankings({...synthetic,games:[fakePreseason,fakePlayoffs]})
  .find(t=>t.id===testTeam);
assert.deepEqual([adjusted.score,adjusted.offense,adjusted.defense,adjusted.pitching],
  [before.score,before.offense,before.defense,before.pitching],
  'Preseason and postseason results cannot change regular-season ranking categories');
const highDefense={...regular,result:{...regular.result,
  players:[{team:testTeam,player:eligible[0],stats:{
    hits:2,runs:1,putouts:20,pitchStrikeouts:2,earnedRuns:1
  }}]}};
const betterDefense=powerRankings({...synthetic,games:[highDefense]}).find(t=>t.id===testTeam);
assert(betterDefense.gamePointBoosts.dgp>after.gamePointBoosts.dgp);
assert(betterDefense.defense>=after.defense);
const lowPitching={...regular,result:{...regular.result,
  players:[{team:testTeam,player:eligible[0],stats:{
    hits:2,runs:1,putouts:3,earnedRuns:7
  }}]}};
const worsePitching=powerRankings({...synthetic,games:[lowPitching]}).find(t=>t.id===testTeam);
assert(worsePitching.gamePointBoosts.pgp>0,
  'Even negative PGP must contribute a small positive boost');
assert(worsePitching.gamePointBoosts.pgp<after.gamePointBoosts.pgp,
  'Worse PGP must yield a smaller pitching boost');

console.log('PASS: approved roster weights, plus independent positive OGP/DGP/PGP category boosts from published regular-season reports only');
