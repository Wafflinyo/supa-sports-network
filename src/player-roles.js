// SSL scouting labels. These are league planning aids, not Dolphin AI patches.
// The twelve original captains always outrank non-captain pitchers.
export const CAPTAIN_PLAYER_IDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 18, 20]);
const captainIds = new Set(CAPTAIN_PLAYER_IDS);

export const FIELDING_ABILITY_NAMES = Object.freeze({
  0: 'None',
  1: 'Super Dive',
  2: 'Super Jump',
  3: 'Tongue Catch',
  4: 'Suction Catch',
  5: 'Magical Catch',
  6: 'Piranha Catch',
  7: 'Hammer / Fire / Boomerang Throw',
  8: 'Keeper Catch',
  9: 'Clamber',
  10: 'Ball Dash',
  11: 'Laser Beam',
  12: 'Quick Throw',
});
export const BASERUNNING_ABILITY_NAMES = Object.freeze({
  0: 'None',
  1: 'Scatter Dive',
  2: 'Ink Dive',
  3: 'Wiggler Attack',
  4: 'Teleport',
  5: 'Spin Attack',
  6: 'Burrow',
  7: 'Enlarge',
});

export function abilityLabel(statKey, id) {
  const names = statKey === 'fielding ability' ? FIELDING_ABILITY_NAMES : BASERUNNING_ABILITY_NAMES;
  const num = Number(id);
  const name = names[num];
  return name === undefined ? 'Unknown ability (ID ' + String(id) + ')' : name + ' (ID ' + num + ')';
}

export function pitcherPriorityFor(player, record) {
  if (player && captainIds.has(Number(player.id))) {
    return { code: 'P1P', label: 'Priority 1 Pitcher', order: 1 };
  }
  if (Number(record?.stats?.['displayed pitching']) >= 7) {
    return { code: 'P2P', label: 'Priority 2 Pitcher', order: 2 };
  }
  return null;
}

export function pitcherPriorityText(player, record) {
  return pitcherPriorityFor(player, record)?.code || '—';
}
