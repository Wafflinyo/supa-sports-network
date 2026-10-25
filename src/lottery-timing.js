// One shared reveal timeline for the SSL bingo lottery and video preview.
// The draw order is chosen by the server; this only controls its presentation.
export const LOTTERY_INTRO_MS = 10000;
export const LOTTERY_DRAW_INTERVAL_MS = 8000;
export const LOTTERY_ANNOUNCEMENT_MS = 4800;

export function lotteryProgress(total, beginsAt, now) {
  const count = Math.max(0, Number(total) || 0);
  const started = Date.parse(beginsAt);
  // Preserve older completed drafts whose recorded lottery time is unavailable.
  if (!Number.isFinite(started)) return { revealed: count, phase: "complete", secondsToNext: 0 };
  const elapsed = Math.max(0, now - started);
  if (!count) return { revealed: 0, phase: "waiting", secondsToNext: 0 };
  if (elapsed < LOTTERY_INTRO_MS)
    return { revealed: 0, phase: "intro", secondsToNext: Math.ceil((LOTTERY_INTRO_MS - elapsed) / 1000) };
  const afterIntro = elapsed - LOTTERY_INTRO_MS;
  const revealed = Math.min(count, Math.floor(afterIntro / LOTTERY_DRAW_INTERVAL_MS) + 1);
  if (revealed >= count) return { revealed, phase: "complete", secondsToNext: 0 };
  const withinStep = afterIntro % LOTTERY_DRAW_INTERVAL_MS;
  const phase = withinStep < LOTTERY_ANNOUNCEMENT_MS ? "announce" : "mixing";
  return { revealed, phase, secondsToNext: Math.ceil((LOTTERY_DRAW_INTERVAL_MS - withinStep) / 1000) };
}
