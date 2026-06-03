// Seedable RNG. ALL randomness in the game must route through an instance of
// this so simulations are reproducible. mulberry32 — small, fast, good enough
// for a slot game (this is not cryptographic).

export function createRng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;

  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** float in [0, 1) */
    next,
    /** integer in [0, max) */
    int(max) {
      return Math.floor(next() * max);
    },
    /** integer in [min, max] inclusive */
    range(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /**
     * Pick one entry from a list of { value, weight } using weighted random.
     * Returns the whole entry.
     */
    weighted(entries) {
      let total = 0;
      for (const e of entries) total += e.weight;
      let roll = next() * total;
      for (const e of entries) {
        roll -= e.weight;
        if (roll < 0) return e;
      }
      return entries[entries.length - 1];
    },
    /** reseed in place */
    seed(s) {
      a = s >>> 0;
    },
  };
}
