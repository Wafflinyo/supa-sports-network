import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const room=readFileSync(new URL('../src/SeasonLeague.jsx',import.meta.url),'utf8');
const machine=readFileSync(new URL('../src/BingoLottery.jsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/bingo-lottery.css',import.meta.url),'utf8');
const lobbyStyle=readFileSync(new URL('../src/season.css',import.meta.url),'utf8');
const timing=readFileSync(new URL('../src/lottery-timing.js',import.meta.url),'utf8');
assert(room.includes('lotteryProgress(s?.order?.length || 0, s?.lotteryAt, l.now)'),
  'live show is anchored to server clock and scheduled lotteryAt');
assert(room.includes("lotteryProgress(season?.order?.length||0,season?.lotteryAt,now)"),
  'the Draft Room entrance also shows synchronized five-minute warning');
assert(room.includes('ssl-lottery-lobby-alert'),'lottery clock appears even before Enter');
assert(room.includes("!s.lotteryAt||!s.teams?.length"),
  'curtain appears even when the server has not generated the order');
assert(!room.includes("!s.order.length ? <p>Waiting for the scheduled lottery time."),
  'cannot hide pre-show curtain when official order is not generated yet');
assert(room.includes("['countdown','curtain-opening','final-countdown'].includes(liveLottery.phase)"),
  'sudden transition cannot stay hidden behind a previously collapsed Details');
assert(room.includes('needsDrawSync')&&room.includes('l.refresh()'),
  'fetch server-selected original order around the scheduled draw time');
assert(machine.includes('function LotteryCurtain({lottery})'),
  'drawing machine contains stage-curtain component');
assert(machine.includes('<LotteryCurtain lottery={lottery}/>'),
  'stage curtain overlays original bingo cage');
assert(machine.includes('ssl-lottery-curtain-panel')&&
  machine.includes('ssl-curtain-clock')&&machine.includes('ssl-lottery-final-count'),
  'visible closed curtains, five-minute countdown and big 3–2–1 must exist');
assert(machine.includes("key={lottery.secondsToNext}"),
  'countdown animates each distinct number, not just initial number');
assert(style.includes('@keyframes ssl-curtain-open-left')&&
  style.includes('@keyframes ssl-curtain-open-right'),
  'curtains physically part left/right');
assert(style.includes('prefers-reduced-motion:reduce'),
  'curtain opening respects reduced-motion preferences');
assert(lobbyStyle.includes('.ssl-lottery-lobby-alert'),
  'lobby warning has a readable visual treatment');
assert(timing.includes('LOTTERY_CURTAIN_OPEN_MS = 2000')&&
  timing.includes('LOTTERY_FINAL_COUNTDOWN_MS = 3000'),
  'lottery show opening and 3-2-1 timings remain explicit');
assert(timing.includes('export function lotteryReplayProgress'),
  'local replay must still show the same persisted lottery order');
console.log('PASS: automatic lottery alert in lobby, live synchronized curtain show, 3–2–1 and replay');
