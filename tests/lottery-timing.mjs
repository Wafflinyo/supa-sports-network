import assert from 'node:assert/strict';
import {lotteryDuration,lotteryProgress,LOTTERY_INTRO_MS,LOTTERY_MIX_MS,LOTTERY_ROLL_MS,LOTTERY_ANNOUNCEMENT_MS} from '../src/lottery-timing.js';
const begin='2026-10-25T19:00:00.000Z';
const at=ms=>lotteryProgress(12,begin,Date.parse(begin)+ms);
assert.deepEqual([LOTTERY_INTRO_MS,LOTTERY_MIX_MS,LOTTERY_ROLL_MS,LOTTERY_ANNOUNCEMENT_MS],[10000,10000,3200,8000]);
assert.equal(at(0).phase,'intro');
assert.equal(at(9999).phase,'intro');
assert.equal(at(9999).secondsToNext,1);
assert.equal(at(10000).phase,'rolling');
assert.equal(at(10000).revealed,1);
assert.equal(at(13199).phase,'rolling');
assert.equal(at(13200).phase,'announce');
assert.equal(at(21199).phase,'announce');
assert.equal(at(21200).phase,'mixing');
assert.equal(at(21200).secondsToNext,10);
assert.equal(at(31199).phase,'mixing');
assert.equal(at(31200).phase,'rolling');
assert.equal(at(31200).revealed,2);
assert.equal(at(34400).phase,'announce');
assert.equal(at(42400).phase,'mixing');
assert.equal(at(42400).revealed,2);
// Reloads / late joiners compute the same phase from the scheduled time.
for(let ms=0;ms<lotteryDuration(12)+1000;ms+=1019) {
  assert.deepEqual(at(ms),at(ms),'Lottery state must be derived from time');
}
// Every drawn ball gets a complete announcement before the next mix starts.
let previousMix=-1,previousAnnounce=-1,previousRoll=-1;
for(let ms=0;ms<lotteryDuration(12);ms+=100) {
  const p=at(ms);
  assert(p.revealed>=0&&p.revealed<=12);
  if(p.phase==='mixing') {
    if(previousMix!==p.ballNumber) {
      assert.equal(p.revealed,p.ballNumber-1);
      previousMix=p.ballNumber;
    }
  }
  if(p.phase==='rolling') {
    if(previousRoll!==p.ballNumber) {
      previousRoll=p.ballNumber;
      assert.equal(p.revealed,p.ballNumber);
    }
  }
  if(p.phase==='announce')previousAnnounce=p.ballNumber;
}
assert.equal(previousRoll,12);
assert.equal(previousAnnounce,12);
assert.equal(at(lotteryDuration(12)-1).phase,'announce');
assert.equal(at(lotteryDuration(12)).phase,'complete');
assert.equal(at(lotteryDuration(12)).revealed,12);
assert.equal(lotteryProgress(12,null,Date.now()).phase,'complete');
assert.equal(lotteryProgress(0,begin,Date.now()).phase,'waiting');
console.log('SSL unhurried lottery timeline, rollouts and reentry synchronization passed.');
