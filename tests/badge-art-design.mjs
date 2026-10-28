import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GM_ACHIEVEMENTS} from '../src/gm-achievements.js';
import {badgeScenes,badgeSceneIds} from '../src/achievement-badge-scenes.js';

const liveIds=GM_ACHIEVEMENTS.map(b=>b.id);
assert.equal(liveIds.length,93);
assert.equal(badgeSceneIds.length,93);
assert.deepEqual([...badgeSceneIds].sort(),[...liveIds].sort(),
  'every art design must correspond to an existing achievement—no invented awards');
assert.equal(new Set(badgeSceneIds).size,93);
assert.equal(new Set(Object.values(badgeScenes).map(s=>
  [s.hero,s.detail,s.layout,s.engraving].join(':'))).size,93,
  'each real award needs a unique meaningful baseball illustration');
assert.equal(new Set(Object.values(badgeScenes).map(s=>
  [s.hero,s.detail,s.layout].join(':'))).size,93,
  'unique badge art cannot depend on a different number alone');

const available=readFileSync(new URL('../src/AchievementBadgeArt.jsx',import.meta.url),'utf8');
const gloveDigitTags=[...available.matchAll(/<path data-glove-digit="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(gloveDigitTags,['thumb','index','middle','ring','pinky'],
  'baseball glove artwork must have EXACTLY FIVE glove fingers including thumb');
assert.match(available,/GLOVE_FINGER_COUNT = 5/);
assert.match(available,/data-finger-count=\{GLOVE_FINGER_COUNT\}/);
assert.match(available,/data-sport-object="real-baseball-bat"/);
assert.match(available,/BAT_PROFILE/);
assert.match(available,/slim wrapped handle/);
assert.match(available,/rect x="-6" y="25" width="12" height="5"/,
  'baseball bat must include a proper knob and grip—not a corn-dog shape');
assert(!available.includes('signatureMarks') && !available.includes('flourishMarks'),
  'no arbitrary recycled inset symbols');
for(const b of GM_ACHIEVEMENTS) {
  const scene=badgeScenes[b.id];
  assert(scene && scene.hero && scene.detail && scene.layout,b.name);
  if(b.group==='player-putouts')assert.equal(scene.hero,'glove',
    'every putout badge uses authentic five-finger glove artwork');
  if(b.group==='season-homer'||b.group==='game-homer')assert(
    ['bat','ball','crossed-bats','fire','stadium','crown'].includes(scene.hero),
    'every home-run scene must convey real baseball imagery');
}
console.log('PASS: 93 existing awards only; 93 distinct sports scenes; exact five-finger gloves; properly tapered baseball bat');
