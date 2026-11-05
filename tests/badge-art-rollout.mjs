import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GM_ACHIEVEMENTS} from '../src/gm-achievements.js';
import {BADGE_ART_ROLLOUT,badgeRedesignUrl} from '../src/badge-art-rollout.js';

const ids=GM_ACHIEVEMENTS.map(b=>b.id);
assert.equal(ids.length,93);
assert.equal(BADGE_ART_ROLLOUT.expectedBadges,ids.length);
assert(['legacy','released'].includes(BADGE_ART_ROLLOUT.status));
if(BADGE_ART_ROLLOUT.status==='legacy'){
  assert.equal(BADGE_ART_ROLLOUT.publishedIds.length,0,
    'Private redesigns must never be embedded in the publicly deployed asset manifest');
  for(const badge of ids)assert.equal(badgeRedesignUrl(badge),null,
    'During private staging every badge must render its original artwork');
  console.log('PASS: redesigned badges remain private; original collection remains published');
}else{
  assert.deepEqual([...BADGE_ART_ROLLOUT.publishedIds].sort(),[...ids].sort(),
    'Publication requires a complete exact 93-badge artwork catalog');
  for(const badge of ids){
    const file='public/achievement-badge-redesigns/'+BADGE_ART_ROLLOUT.collection+'/'+badge+'.png';
    assert(fs.existsSync(file),'Missing published badge art '+file);
    assert.equal(badgeRedesignUrl(badge,'/ssl/'),
      '/ssl/achievement-badge-redesigns/'+BADGE_ART_ROLLOUT.collection+'/'+badge+'.png');
  }
  console.log('PASS: all 93 redesigned assets present, full batch safe to publish');
}
const badgeArt=fs.readFileSync('src/AchievementBadgeArt.jsx','utf8');
assert.match(badgeArt,/badgeRedesignUrl\(badge\.id,import\.meta\.env\.BASE_URL\)/);
assert.match(badgeArt,/if\(releasedArtwork\) return <img/);
