// Shared SSL Star Coin tiers. Keep this in sync with league_private.ssl_star_tiers().
const TIER_THREE = new Set(['Bowser','Donkey Kong','Petey Piranha','King K Rool','King Boo','Funky Kong','Boom Boom','King Bob-omb','Wario']);
const TIER_TWO = new Set(['Mario','Morton','Roy','Flower Fields Monty']);
export function starTier(player) {
  const name = typeof player === 'string' ? player : player?.name;
  if (!name) return 1;
  if (TIER_THREE.has(name) || /(?:^| )Kritter$/i.test(name) || /(?:^| )Bro$/i.test(name)) return 3;
  if (TIER_TWO.has(name) || /(?:^| )Pianta$/i.test(name) || /Dry Bones$/i.test(name)) return 2;
  return 1;
}
export const rechargeGames = player => starTier(player) - 1;
export const starPrice = (player, remaining = 0) => starTier(player) + 2 * Math.max(0, Number(remaining) || 0);
