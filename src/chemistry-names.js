// Names shown in chemistry chips: colored costume variations share one name.
// Only the presentation is condensed. Underlying per-variant chemistry IDs stay intact.
// Miis must retain their individual identity: chemistry for each Mii is explicit.
const COLOR_VARIANT_FAMILIES = new Set([
  'Yoshi', 'Toad', 'Koopa', 'Paratroopa', 'Dry Bones', 'Shy Guy',
  'Magikoopa', 'Kritter', 'Pianta', 'Noki', 'Luma',
]);
const COLOR_PREFIX = /^(?:(?:Light|Dark)\s+)?(?:Red|Blue|Green|Yellow|Purple|Pink|White|Black|Gray|Grey|Brown|Orange|Maroon|Gold|Silver)\s+/i;

export function chemistryDisplayName(player) {
  if (!player) return null;
  if (player.kind === 'mii') return player.name;
  if (player.name === 'Dark Bones') return 'Dry Bones';
  const withoutColor = player.name.replace(COLOR_PREFIX, '');
  return COLOR_VARIANT_FAMILIES.has(withoutColor) ? withoutColor : player.name;
}

export function chemistryDisplayNames(ids, byId) {
  const seen = new Set();
  const names = [];
  for (const id of ids || []) {
    const value = chemistryDisplayName(byId.get(Number(id)));
    if (value && !seen.has(value)) {
      seen.add(value);
      names.push(value);
    }
  }
  return names;
}
