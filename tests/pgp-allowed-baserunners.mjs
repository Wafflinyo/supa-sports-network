import assert from 'node:assert/strict';
import {SSL_GAME_SCORE_WEIGHTS,customGameScore} from '../src/ssl-game-score.js';
import {GAME_POINT_KEYS,gamePointComponents,gamePointsForReport} from '../src/game-points.js';

assert.equal(SSL_GAME_SCORE_WEIGHTS.hitsAllowed,-0.5);
assert.equal(SSL_GAME_SCORE_WEIGHTS.pitchWalks,-2);
assert.equal(SSL_GAME_SCORE_WEIGHTS.beanBalls,-2);
for(const field of ['hitsAllowed','pitchWalks','beanBalls']){
  assert(GAME_POINT_KEYS.pgp.includes(field),field+' must be scored in PGP');
  assert(!GAME_POINT_KEYS.ogp.includes(field),field+' must not affect offense');
  assert(!GAME_POINT_KEYS.dgp.includes(field),field+' must not affect defense');
}
const stats={hitsAllowed:4,pitchWalks:3,beanBalls:1};
assert.deepEqual(gamePointComponents(stats),{ogp:0,dgp:0,pgp:-10});
assert.equal(customGameScore(stats,5).gameScore,-5);
assert.equal(customGameScore(stats,5).baseGameScore,-10);
assert.deepEqual(gamePointsForReport({stats,itemScore:5}),{ogp:0,dgp:0,pgp:-10,tgp:-5});
assert.equal(gamePointComponents({hitsAllowed:1}).pgp,-0.5);
assert.equal(gamePointComponents({pitchWalks:1}).pgp,-2);
assert.equal(gamePointComponents({beanBalls:1}).pgp,-2);
assert.equal(customGameScore({hitsAllowed:3}).gameScore,-1.5);
assert.equal(customGameScore({hitsAllowed:4,outs:3,strikes:5}).gameScore,
  3+2.5-2,'Penalties combine with earned pitching points');
console.log('PASS: PGP penalties −0.5 hits allowed, −2 pitching walks, −2 bean balls; TGP, item score and negative scores.');
