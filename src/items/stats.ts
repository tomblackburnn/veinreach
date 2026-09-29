import type { StatMods } from './types';

export type ResolvedStats = Required<StatMods>;

export function emptyStats(): ResolvedStats {
  return {
    defense: 0, maxLife: 0, maxMana: 0, lifeRegen: 0, manaRegen: 0, moveSpeed: 0, jumpBoost: 0, crit: 0,
    damage: 0, meleeDamage: 0, rangedDamage: 0, magicDamage: 0, summonDamage: 0, meleeSpeed: 0, miningSpeed: 0,
    manaCostReduce: 0, damageReduce: 0, thorns: 0, lightRadius: 0, minionSlots: 0,
    doubleJump: 0, dash: 0, fallImmune: 0, knockbackImmune: 0, lavaImmune: 0, fireImmune: 0, poisonImmune: 0,
    nightVision: 0, detectEnemies: 0, showDepth: 0, showTime: 0,
  };
}

/** Accumulate `src` into `target` (additive). */
export function addMods(target: ResolvedStats, src: StatMods | undefined): void {
  if (!src) return;
  for (const k of Object.keys(src) as (keyof StatMods)[]) {
    const v = src[k];
    if (typeof v === 'number') target[k] += v;
  }
}

/** Human-readable lines for tooltips. */
export function describeMods(m: StatMods): string[] {
  const out: string[] = [];
  const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (m.defense) out.push(`${m.defense > 0 ? '+' : ''}${m.defense} defense`);
  if (m.maxLife) out.push(`+${m.maxLife} max life`);
  if (m.maxMana) out.push(`+${m.maxMana} max mana`);
  if (m.lifeRegen) out.push(`${m.lifeRegen > 0 ? '+' : ''}${m.lifeRegen} life regen`);
  if (m.moveSpeed) out.push(`${pct(m.moveSpeed)} movement speed`);
  if (m.jumpBoost) out.push(`${pct(m.jumpBoost)} jump height`);
  if (m.crit) out.push(`+${m.crit}% critical chance`);
  if (m.damage) out.push(`${pct(m.damage)} damage`);
  if (m.meleeDamage) out.push(`${pct(m.meleeDamage)} melee damage`);
  if (m.rangedDamage) out.push(`${pct(m.rangedDamage)} ranged damage`);
  if (m.magicDamage) out.push(`${pct(m.magicDamage)} magic damage`);
  if (m.summonDamage) out.push(`${pct(m.summonDamage)} summon damage`);
  if (m.meleeSpeed) out.push(`${pct(m.meleeSpeed)} melee speed`);
  if (m.miningSpeed) out.push(`${pct(m.miningSpeed)} mining speed`);
  if (m.manaCostReduce) out.push(`-${Math.round(m.manaCostReduce * 100)}% mana cost`);
  if (m.minionSlots) out.push(`+${m.minionSlots} minion slot${m.minionSlots > 1 ? 's' : ''}`);
  if (m.damageReduce) out.push(`-${Math.round(m.damageReduce * 100)}% damage taken`);
  return out;
}
