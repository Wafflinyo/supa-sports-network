import assert from 'node:assert/strict';
import {GM_ACHIEVEMENTS} from '../src/gm-achievements.js';
import {signatureMarks,flourishMarks,badgeArtSignature} from '../src/badge-art-design.js';

// These are pictograms inside the shield, not simply a changing number or
// badge color. The SVG signature combines a large icon-family drawing, an
// illustrated inset emblem, and a distinct full-width flourish.
assert.equal(GM_ACHIEVEMENTS.length,92);
assert.equal(signatureMarks.length,16);
assert.equal(flourishMarks.length,6);
assert.equal(new Set(signatureMarks).size,16);
assert.equal(new Set(flourishMarks).size,6);
const signatures=GM_ACHIEVEMENTS.map(badgeArtSignature);
assert.equal(new Set(signatures).size,92,'every achievement needs a distinct drawn symbol');
for (const badge of GM_ACHIEVEMENTS) {
  const index=(badge.serial-1)%signatureMarks.length;
  const flourish=Math.floor((badge.serial-1)/signatureMarks.length);
  assert.match(signatureMarks[index],/^M/,badge.name+' inset emblem');
  assert.match(flourishMarks[flourish],/^M/,badge.name+' relief flourish');
}
console.log('PASS: all 92 badge pictograms are visually unique, with valid engraved inset designs and crest flourishes');
