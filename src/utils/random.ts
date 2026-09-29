/**
 * Seeded pseudo-random utilities. All world generation and gameplay randomness
 * that must be reproducible flows through `Rng` rather than Math.random().
 */

/** 32-bit string hash (FNV-1a). Used to turn text seeds into numeric seeds. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stateless integer hash of up to three coordinates plus a seed. */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ (z | 0), 0x27d4eb2f);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Float in [0,1) derived from coordinates. */
export function hashFloat(x: number, y: number, z = 0, seed = 0): number {
  return hash3(x, y, z, seed) / 4294967296;
}

/** Mulberry32 PRNG — small, fast and good enough for games. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  static fromString(seed: string): Rng {
    return new Rng(hashString(seed));
  }

  /** Returns float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted choice. Weights need not sum to 1. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Derive an independent child generator (for isolated gen passes). */
  fork(salt: string): Rng {
    return new Rng(hash3(this.state, hashString(salt), 7));
  }

  getState(): number {
    return this.state;
  }
}

/** Non-deterministic helper for cosmetic effects (particles, sfx pitch). */
export const fx = {
  range(min: number, max: number): number {
    return min + Math.random() * (max - min);
  },
  int(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  },
  chance(p: number): boolean {
    return Math.random() < p;
  },
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  },
};

export function randomSeedString(): string {
  return String(Math.floor(Math.random() * 1_000_000_000));
}
