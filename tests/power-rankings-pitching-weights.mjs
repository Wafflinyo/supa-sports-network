import assert from 'node:assert/strict';
import roster from '../src/players.json' with {type:'json'};
import gameData from '../src/player-data.json' with {type:'json'};
import {
  PITCHING_STAT_WEIGHTS,pitchingRating,rosterPowerComponents,
  POWER_WEIGHTS,POWER_PITCHER_COUNT,POWER_SUPPORT_PITCHER_COUNT,
  OFFENSE_SPEED_WEIGHT,DEFENSE_SPEED_WEIGHT,offenseRating,
  fieldingAbilityBonus
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

assert.deepEqual({...POWER_WEIGHTS},{offense:.65,pitching:.15,defense:.20},
  'Changing pitching skill weights must not alter the total power-ranking category weights');
assert.equal(OFFENSE_SPEED_WEIGHT,.05,'Offense speed contribution is unchanged');
assert.equal(DEFENSE_SPEED_WEIGHT,.08,'Defense speed contribution is unchanged');
assert.equal(offenseRating({
  'charge hit power':100,'hit trajectory':'High','slap hit power':100,
  'slap contact size':100,'charge contact size':100,
}),100,'Offense hitting attributes have not been changed');
assert.equal(fieldingAbilityBonus(9,'SS'),-12,'Fielding ability rules must be retained');
console.log('PASS: new 55/10/15/20 pitching weights applied to real league pitchers; four-pitcher averaging and offense/defense rules preserved');
