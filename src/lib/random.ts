/**
 * Deterministic PRNG (mulberry32).
 *
 * Two unrelated parts of the app need randomness that never reshuffles.
 * Scenery must stay put between renders — a flower that jumps to a new block
 * when React re-renders reads as a bug. Maze generation must be reproducible
 * for a given URL, or a shared play link would hand the recipient a different
 * board from the one the sender solved.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash of a string, for turning a URL into a PRNG seed.
 *
 * Not a cryptographic hash and not trying to be: it only has to spread similar
 * URLs across the seed space so two links that differ by one character do not
 * produce visibly related mazes.
 */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Shuffle in place with a supplied PRNG (Fisher-Yates). */
export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
