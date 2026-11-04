import assert from 'node:assert/strict';
import {SSL_GAME_SCORE_WEIGHTS,customGameScore} from '../src/ssl-game-score.js';
import {GAME_POINT_KEYS,gamePointComponents,gamePointsForReport} from '../src/game-points.js';

assert.equal(SSL_GAME_SCORE_WEIGHTS.hitsAllowed,-0.25);
assert.equal(SSL_GAME_SCORE_WEIGHTS.pitchWalks,-2);
assert.equal(SSL_GAME_SCORE_WEIGHTS.beanBalls,-2);
assert.equal(SSL_GAME_SCORE_WEIGHTS.earnedRuns,-3,'Earned runs cost three PGP each');
assert.equal(SSL_GAME_SCORE_WEIGHTS.runsAllowed,undefined,'Runs allowed is tracked but never independently penalized');
assert(!GAME_POINT_KEYS.pgp.includes('runsAllowed'));
assert.equal(gamePointComponents({runsAllowed:5,earnedRuns:0}).pgp,0);
assert.equal(gamePointComponents({runsAllowed:5,earnedRuns:2}).pgp,-6);
assert.equal(customGameScore({runsAllowed:5,earnedRuns:2}).gameScore,-6);
for(const field of ['hitsAllowed','pitchWalks','beanBalls']){
  assert(GAME_POINT_KEYS.pgp.includes(field),field+' must be scored in PGP');
  assert(!GAME_POINT_KEYS.ogp.includes(field),field+' must not affect offense');
  assert(!GAME_POINT_KEYS.dgp.includes(field),field+' must not affect defense');
}
const stats={hitsAllowed:4,pitchWalks:3,beanBalls:1};
assert.deepEqual(gamePointComponents(stats),{ogp:0,dgp:0,pgp:-9});
assert.equal(customGameScore(stats,5).gameScore,-4);
assert.equal(customGameScore(stats,5).baseGameScore,-9);
assert.deepEqual(gamePointsForReport({stats,itemScore:5}),{ogp:0,dgp:0,pgp:-9,tgp:-4});
assert.equal(gamePointComponents({hitsAllowed:1}).pgp,-0.25);
assert.equal(gamePointComponents({pitchWalks:1}).pgp,-2);
assert.equal(gamePointComponents({beanBalls:1}).pgp,-2);
assert.equal(customGameScore({hitsAllowed:3}).gameScore,-0.75);
assert.equal(customGameScore({hitsAllowed:4,outs:3,strikes:5}).gameScore,
  3+2.5-1,'Penalties combine with earned pitching points');
console.log('PASS: PGP penalties −0.25 hits allowed, −2 pitching walks, −2 bean balls; TGP, item score and negative scores.');
