import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {shuffleLotteryOrder,cryptoLotteryIndex} from '../src/lottery-random.js';

const ids=Array.from({length:12},(_,i)=>'team-'+(i+1));
const COUNT=12000;
const count=Object.fromEntries(ids.map(id=>[id,0]));
const sampleOrders=new Set();
for(let t=0;t<COUNT;t++){
  const order=shuffleLotteryOrder(ids,n=>randomInt(n));
  assert.equal(order.length,12);
  assert.deepEqual([...order].sort(),[...ids].sort(),'All franchises must be present once');
  count[order[0]]++;
  if(t<50)sampleOrders.add(order.join(','));
}
assert.ok(sampleOrders.size>=45,'Draw must not repeat a fixed sample order');
for(const n of Object.values(count)){
  assert.ok(n>800&&n<1200,'First ball distribution should be statistically close to 1/12 across 12,000 fair trials');
}
// Check secure browser RNG is unbiased under a source that deliberately
// emits rejected uint32 values before acceptable values.
let calls=0;
const chosen=cryptoLotteryIndex(12,{getRandomValues(buffer){buffer[0]=calls++===0?0xffffffff:23;return buffer;}});
assert.equal(chosen,23%12);
assert.equal(calls,2);
assert.throws(()=>shuffleLotteryOrder(['A','A'],n=>0),/appear exactly once/);
assert.throws(()=>shuffleLotteryOrder(ids,()=>99),/outside remaining/);
console.log('PASSED: 12,000 unique-ball uniform random shuffles; no replacement; unbiased secure browser selection.');
