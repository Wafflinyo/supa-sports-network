// Server-clock-aligned lottery show. All users see the same act at the same
// instant; the official draw order is never generated or changed by the UI.
export const LOTTERY_PRE_SHOW_MS = 5*60*1000;
export const LOTTERY_CURTAIN_OPEN_MS = 2000;
export const LOTTERY_FINAL_COUNTDOWN_MS = 3000;
export const LOTTERY_INTRO_MS = 10000;
export const LOTTERY_MIX_MS = 10000;
export const LOTTERY_ROLL_MS = 3200;
export const LOTTERY_ANNOUNCEMENT_MS = 5000;
export const LOTTERY_DRAW_INTERVAL_MS = LOTTERY_MIX_MS+LOTTERY_ROLL_MS+LOTTERY_ANNOUNCEMENT_MS;
export const LOTTERY_CEREMONY_MS = LOTTERY_CURTAIN_OPEN_MS+LOTTERY_FINAL_COUNTDOWN_MS;
export const lotteryDuration = total => {
  const count = Math.max(0,Math.floor(Number(total)||0));
  return count ? LOTTERY_CEREMONY_MS + LOTTERY_INTRO_MS + count*(LOTTERY_ROLL_MS+LOTTERY_ANNOUNCEMENT_MS) + (count-1)*LOTTERY_MIX_MS : 0;
};
function status(phase,secondsToNext,phaseElapsedMs,phaseDurationMs,ballNumber=0,revealed=0) {
  return {revealed,phase,secondsToNext,phaseElapsedMs,phaseDurationMs,ballNumber};
}
export function lotteryProgress(total,beginsAt,now) {
  const count=Math.max(0,Math.floor(Number(total)||0));
  const scheduled=Date.parse(beginsAt);
  if(!Number.isFinite(scheduled))
    return count ? status('complete',0,0,0,count,count) : status('waiting',0,0,0);
  const relative=Number(now)-scheduled;
  if(relative < -LOTTERY_PRE_SHOW_MS)
    return status('waiting',Math.ceil((-relative-LOTTERY_PRE_SHOW_MS)/1000),0,0);
  if(relative<0)
    return status('countdown',Math.ceil(-relative/1000),
      Math.max(0,LOTTERY_PRE_SHOW_MS+relative),LOTTERY_PRE_SHOW_MS);
  if(relative<LOTTERY_CURTAIN_OPEN_MS)
    return status('curtain-opening',Math.ceil((LOTTERY_CURTAIN_OPEN_MS-relative)/1000),
      relative,LOTTERY_CURTAIN_OPEN_MS);
  if(relative<LOTTERY_CEREMONY_MS)
    return status('final-countdown',Math.ceil((LOTTERY_CEREMONY_MS-relative)/1000),
      relative-LOTTERY_CURTAIN_OPEN_MS,LOTTERY_FINAL_COUNTDOWN_MS);
  // The server draws the real order at the scheduled time. Polling may mean
  // the order is not in the browser until a couple seconds afterward; don't
  // reveal invented or empty results. Rejoin at the correct live position.
  if(!count)return status('awaiting-order',0,relative-LOTTERY_CEREMONY_MS,0);
  let remaining=relative-LOTTERY_CEREMONY_MS;
  if(remaining<LOTTERY_INTRO_MS)
    return status('intro',Math.ceil((LOTTERY_INTRO_MS-remaining)/1000),remaining,LOTTERY_INTRO_MS,1);
  remaining-=LOTTERY_INTRO_MS;
  for(let index=0;index<count;index++) {
    if(index>0) {
      if(remaining<LOTTERY_MIX_MS)
        return status('mixing',Math.ceil((LOTTERY_MIX_MS-remaining)/1000),
          remaining,LOTTERY_MIX_MS,index+1,index);
      remaining-=LOTTERY_MIX_MS;
    }
    if(remaining<LOTTERY_ROLL_MS)
      return status('rolling',0,remaining,LOTTERY_ROLL_MS,index+1,index+1);
    remaining-=LOTTERY_ROLL_MS;
    if(remaining<LOTTERY_ANNOUNCEMENT_MS)
      return status('announce',0,remaining,LOTTERY_ANNOUNCEMENT_MS,index+1,index+1);
    remaining-=LOTTERY_ANNOUNCEMENT_MS;
  }
  return status('complete',0,0,0,count,count);
}

/** Personal replay: replay the original saved order, with curtain and 3-2-1,
 * but skip the 5-minute wait. No server writes or new randomization. */
export function lotteryReplayProgress(total,elapsedMs) {
  const replayStart='2000-01-01T00:00:00.000Z';
  const ms=Math.max(0,Number(elapsedMs)||0);
  return lotteryProgress(total,replayStart,Date.parse(replayStart)+ms);
}

/** Clock-style display for the five-minute audience pre-show. */
export function lotteryCountdownClock(seconds){
  const value=Math.max(0,Math.ceil(Number(seconds)||0));
  return String(Math.floor(value/60)).padStart(2,'0')+':'+
    String(value%60).padStart(2,'0');
}
