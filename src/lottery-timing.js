// Shared, server-time-based lottery presentation: joining, leaving and
// reopening never restarts a draw or changes the official server-picked order.
// The first ball gets a longer opening mix. Every following ball waits for
// the previous announcement to disappear before starting a new mix countdown.
export const LOTTERY_INTRO_MS = 10000;
export const LOTTERY_MIX_MS = 10000;
export const LOTTERY_ROLL_MS = 3200;
export const LOTTERY_ANNOUNCEMENT_MS = 8000;
// Kept as a compatibility export for older preview tooling.
export const LOTTERY_DRAW_INTERVAL_MS = LOTTERY_MIX_MS + LOTTERY_ROLL_MS + LOTTERY_ANNOUNCEMENT_MS;
export const lotteryDuration = total => {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  return count ? LOTTERY_INTRO_MS + count * (LOTTERY_ROLL_MS + LOTTERY_ANNOUNCEMENT_MS) + (count - 1) * LOTTERY_MIX_MS : 0;
};
export function lotteryProgress(total, beginsAt, now) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const started = Date.parse(beginsAt);
  if (!Number.isFinite(started))
    return {revealed:count,phase:'complete',secondsToNext:0,phaseElapsedMs:0,phaseDurationMs:0,ballNumber:count};
  if (!count)
    return {revealed:0,phase:'waiting',secondsToNext:0,phaseElapsedMs:0,phaseDurationMs:0,ballNumber:0};
  const elapsed = Math.max(0,Number(now)-started);
  if (elapsed < LOTTERY_INTRO_MS)
    return {revealed:0,phase:'intro',secondsToNext:Math.ceil((LOTTERY_INTRO_MS-elapsed)/1000),phaseElapsedMs:elapsed,phaseDurationMs:LOTTERY_INTRO_MS,ballNumber:1};
  let remaining = elapsed-LOTTERY_INTRO_MS;
  for(let index=0;index<count;index++) {
    if(index>0) {
      if(remaining < LOTTERY_MIX_MS)
        return {revealed:index,phase:'mixing',secondsToNext:Math.ceil((LOTTERY_MIX_MS-remaining)/1000),phaseElapsedMs:remaining,phaseDurationMs:LOTTERY_MIX_MS,ballNumber:index+1};
      remaining-=LOTTERY_MIX_MS;
    }
    if(remaining < LOTTERY_ROLL_MS)
      return {revealed:index+1,phase:'rolling',secondsToNext:0,phaseElapsedMs:remaining,phaseDurationMs:LOTTERY_ROLL_MS,ballNumber:index+1};
    remaining-=LOTTERY_ROLL_MS;
    if(remaining < LOTTERY_ANNOUNCEMENT_MS)
      return {revealed:index+1,phase:'announce',secondsToNext:0,phaseElapsedMs:remaining,phaseDurationMs:LOTTERY_ANNOUNCEMENT_MS,ballNumber:index+1};
    remaining-=LOTTERY_ANNOUNCEMENT_MS;
  }
  return {revealed:count,phase:'complete',secondsToNext:0,phaseElapsedMs:0,phaseDurationMs:0,ballNumber:count};
}
