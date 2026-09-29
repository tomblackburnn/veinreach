/** Pure damage maths — unit tested. */

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

/**
 * Final damage = (base × (1 + bonus)) × (crit ? 2 : 1) − defense / 2, at least 1,
 * with a small ±variance. `rand` is injectable for deterministic tests.
 */
export function rollDamage(base: number, bonus: number, critChance: number, defense: number, rand: () => number = Math.random, variance = 0.08): DamageRoll {
  const crit = rand() * 100 < critChance;
  let dmg = base * (1 + bonus);
  dmg *= 1 + (rand() * 2 - 1) * variance;
  if (crit) dmg *= 2;
  dmg -= defense * 0.5;
  return { amount: Math.max(1, Math.round(dmg)), crit };
}

/** Apply percentage damage reduction (after defense). */
export function applyReduction(amount: number, reduce: number): number {
  return Math.max(1, Math.round(amount * (1 - Math.min(0.8, Math.max(0, reduce)))));
}

/** Knockback velocity after resistance (0 = full knockback, 1 = immune). */
export function knockbackVelocity(kb: number, resist: number): number {
  return kb * Math.max(0, 1 - resist);
}

/** Fall damage in HP for a fall of `tiles` tiles. */
export function fallDamage(tiles: number, safeTiles: number): number {
  if (tiles <= safeTiles) return 0;
  return Math.round((tiles - safeTiles) * 8);
}
