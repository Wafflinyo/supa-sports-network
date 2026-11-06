// Controlled, all-or-nothing rollout of redesigned GM achievement artwork.
//
// Each approved design is staged outside the public website until the
// commissioner orders the entire collection released. During staging, this
// module always returns null and the original SVG badge is displayed.
// At publication: commit all 94 image assets and IDs first, verify the
// catalog, then change status to 'released' in the final release commit.
export const BADGE_ART_ROLLOUT = Object.freeze({
  status: 'legacy',
  collection: 'v1',
  expectedBadges: 94,
  publishedIds: Object.freeze([]),
});

export function badgeRedesignUrl(badgeId, baseUrl = '/') {
  const state = BADGE_ART_ROLLOUT;
  if (state.status !== 'released' ||
      state.publishedIds.length !== state.expectedBadges ||
      new Set(state.publishedIds).size !== state.expectedBadges ||
      !state.publishedIds.includes(badgeId)) return null;
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return base + 'achievement-badge-redesigns/' + state.collection + '/' +
    encodeURIComponent(badgeId) + '.png';
}
