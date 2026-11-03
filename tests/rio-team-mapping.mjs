import assert from 'node:assert/strict';
import {RIO_TEAM_MAPPINGS,resolveRioTeam,recognizeRioGameInfo,validateRioMatchup} from '../src/rio-team-mapping.js';
assert.equal(RIO_TEAM_MAPPINGS.length,12);
assert.equal(new Set(RIO_TEAM_MAPPINGS.map(t=>t.slot)).size,12);
const teams=RIO_TEAM_MAPPINGS.map(mapping=>({
  id:'ssl-'+mapping.slot,slot:mapping.slot,name:mapping.ssl,
})); // No captain or roster fields: identity must not depend on them.
for(const mapping of RIO_TEAM_MAPPINGS){
  assert.equal(resolveRioTeam(mapping.rio,teams)?.id,'ssl-'+mapping.slot);
  for(const alias of mapping.aliases)
    assert.equal(resolveRioTeam(alias,teams)?.id,'ssl-'+mapping.slot);
}
assert.equal(resolveRioTeam('Diddy Monkeys',teams)?.name,'Rogueport Ruffians');
assert.equal(resolveRioTeam('Jr. Rookies',teams)?.name,'Delfino Dolphins');
assert.equal(resolveRioTeam('Bowser Jr. Rookies',teams)?.id,'ssl-1');
assert.equal(resolveRioTeam('Waluigi Spitballs',teams)?.id,'ssl-6');
const game={away:'ssl-3',home:'ssl-2'};
const gameInfo=[[''],['Peach Monarchs','VS','Luigi Knights']];
assert.deepEqual(recognizeRioGameInfo(gameInfo,teams).map(x=>x.team.id),['ssl-3','ssl-2']);
assert.equal(validateRioMatchup(gameInfo,teams,game).length,2);
assert.throws(()=>validateRioMatchup(gameInfo,teams,{away:'ssl-3',home:'ssl-9'}),/choose the matching scheduled SSL game/);
assert.throws(()=>validateRioMatchup([['Unrecognized','VS','Luigi Knights']],teams,game),/exactly two recognized/);
const renamed=teams.map(t=>({...t,name:'Renamed SSL Team '+t.slot}));
assert.equal(resolveRioTeam('Peach Monarchs',renamed)?.name,'Renamed SSL Team 3');
console.log('PASS: all 12 exact Rio labels, short aliases, slot ID persistence, matchup validation, and captain independence.');
