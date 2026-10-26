// Shared equal-chance shuffle for non-weighted SSL lottery simulations.
// Fisher–Yates gives each of n! permutations equal probability if chooseIndex
// returns a uniform integer in [0, bound). One ball is removed each draw.
export function shuffleLotteryOrder(ids, chooseIndex) {
  if (!Array.isArray(ids) || typeof chooseIndex !== 'function')
    throw new TypeError('Expected franchise IDs and a uniform integer source');
  if (new Set(ids).size !== ids.length)
    throw new Error('Every franchise must appear exactly once');
  const result = ids.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = chooseIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i)
      throw new Error('Random index outside remaining lottery pool');
    [result[i],result[j]] = [result[j],result[i]];
  }
  return result;
}

// Rejection sampling avoids the tiny modulus bias from arbitrary 32-bit
// values, so every remaining ball has the exact same selection probability.
export function cryptoLotteryIndex(bound, webCrypto = globalThis.crypto) {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000)
    throw new RangeError('Lottery pool size is outside the supported range');
  if (!webCrypto?.getRandomValues)throw new Error('Cryptographic randomness is required for practice lotteries');
  const total = 0x100000000;
  const limit = Math.floor(total / bound) * bound;
  const buffer = new Uint32Array(1);
  do { webCrypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % bound;
}
