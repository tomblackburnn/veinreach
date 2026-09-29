import type { ItemDef, StatMods } from '../../items/types';

interface SetSpec {
  set: string;
  prefix: string;
  names: [string, string, string];
  defense: [number, number, number];
  color: string;
  trim: string;
  rarity: number;
  value: number;
  mods?: [StatMods?, StatMods?, StatMods?];
}

function armorSet(s: SetSpec): ItemDef[] {
  const slots = ['head', 'body', 'legs'] as const;
  const tpl = ['helmet', 'chestplate', 'greaves'];
  return slots.map((slot, i) => ({
    id: `${s.prefix}_${slot}`,
    name: s.names[i],
    category: 'armor' as const,
    rarity: s.rarity,
    maxStack: 1,
    value: s.value * (i === 1 ? 1.4 : 1),
    icon: { t: tpl[i], c: [s.color, s.trim] },
    armor: { slot, defense: s.defense[i], set: s.set, mods: s.mods?.[i], color: s.color, trim: s.trim },
  }));
}

export const ARMOR_ITEMS: ItemDef[] = [
  ...armorSet({ set: 'barkweave', prefix: 'barkweave', names: ['Barkweave Cap', 'Barkweave Vest', 'Barkweave Leggings'], defense: [1, 1, 1], color: '#8b5a2b', trim: '#5a3a1a', rarity: 0, value: 10 }),
  ...armorSet({ set: 'brasslite', prefix: 'brasslite', names: ['Brasslite Helm', 'Brasslite Cuirass', 'Brasslite Greaves'], defense: [2, 3, 2], color: '#e0923d', trim: '#8a5a20', rarity: 0, value: 40 }),
  ...armorSet({ set: 'ferrocite', prefix: 'ferrocite', names: ['Ferrocite Helm', 'Ferrocite Hauberk', 'Ferrocite Greaves'], defense: [3, 4, 3], color: '#a7b3c2', trim: '#5d6474', rarity: 0, value: 80 }),
  ...armorSet({ set: 'moonsilver', prefix: 'moonsilver', names: ['Moonsilver Circlet', 'Moonsilver Mail', 'Moonsilver Greaves'], defense: [4, 5, 4], color: '#cfe0ff', trim: '#3e4f8a', rarity: 1, value: 140 }),
  ...armorSet({ set: 'sungild', prefix: 'sungild', names: ['Sungild Crown', 'Sungild Breastplate', 'Sungild Greaves'], defense: [5, 6, 5], color: '#f5cf3c', trim: '#8e7020', rarity: 1, value: 200 }),
  ...armorSet({ set: 'chitin', prefix: 'chitin', names: ['Gravelmaw Visage', 'Gravelmaw Carapace', 'Gravelmaw Tassets'], defense: [5, 7, 5], color: '#9a7a52', trim: '#c0a070', rarity: 2, value: 300, mods: [{ miningSpeed: 0.1 }, { meleeDamage: 0.05 }, { moveSpeed: 0.05 }] }),
  ...armorSet({ set: 'glimmer', prefix: 'glimmer', names: ['Glimmer Hood', 'Glimmer Robe', 'Glimmer Slippers'], defense: [4, 6, 4], color: '#6fe0d0', trim: '#2a3558', rarity: 2, value: 350, mods: [{ maxMana: 20 }, { magicDamage: 0.07 }, { manaCostReduce: 0.06 }] }),
  ...armorSet({ set: 'thornbark', prefix: 'thornbark', names: ['Thornbark Mask', 'Thornbark Jerkin', 'Thornbark Boots'], defense: [6, 7, 6], color: '#6a8a3a', trim: '#3a2a1a', rarity: 3, value: 450, mods: [{ rangedDamage: 0.06 }, { summonDamage: 0.08, minionSlots: 1 }, { moveSpeed: 0.06 }] }),
  ...armorSet({ set: 'cinder', prefix: 'cinder', names: ['Cinder Helm', 'Cinder Plate', 'Cinder Greaves'], defense: [8, 10, 8], color: '#c0401a', trim: '#ffb040', rarity: 3, value: 600, mods: [{ crit: 4 }, { damage: 0.05 }, { moveSpeed: 0.05 }] }),
  ...armorSet({ set: 'umbral', prefix: 'umbral', names: ['Umbral Cowl', 'Umbral Shroud', 'Umbral Treads'], defense: [11, 14, 11], color: '#6a2ab0', trim: '#e0b0ff', rarity: 5, value: 1100, mods: [{ crit: 6 }, { damage: 0.08 }, { moveSpeed: 0.08 }] }),
  ...armorSet({ set: 'aether', prefix: 'aether', names: ['Aether Visor', 'Aether Aegis', 'Aether Striders'], defense: [14, 18, 14], color: '#9ff5ff', trim: '#3a6a88', rarity: 6, value: 1700, mods: [{ maxMana: 40, crit: 5 }, { damage: 0.1 }, { moveSpeed: 0.1, jumpBoost: 0.1 }] }),
  ...armorSet({ set: 'starforged', prefix: 'starforged', names: ['Starforged Crown', 'Starforged Raiment', 'Starforged Sabatons'], defense: [18, 24, 18], color: '#ffe8a0', trim: '#ff8ae6', rarity: 8, value: 3500, mods: [{ crit: 8, maxMana: 60 }, { damage: 0.14, lifeRegen: 2 }, { moveSpeed: 0.15, jumpBoost: 0.15 }] }),
];

/** Set bonuses applied when all three pieces of a set are worn. */
export const SET_BONUSES: Record<string, { description: string; mods: StatMods }> = {
  barkweave: { description: '+1 defense', mods: { defense: 1 } },
  brasslite: { description: '+2 defense', mods: { defense: 2 } },
  ferrocite: { description: '+3 defense, 5% damage reduction', mods: { defense: 3, damageReduce: 0.05 } },
  moonsilver: { description: '+12% movement speed', mods: { moveSpeed: 0.12 } },
  sungild: { description: '+8% critical chance', mods: { crit: 8 } },
  chitin: { description: '+12% melee damage, immune to knockback', mods: { meleeDamage: 0.12, knockbackImmune: 1 } },
  glimmer: { description: '+40 max mana, +12% magic damage', mods: { maxMana: 40, magicDamage: 0.12 } },
  thornbark: { description: 'Attackers take 40% of their damage back; +15% ranged damage', mods: { thorns: 0.4, rangedDamage: 0.15 } },
  cinder: { description: 'Immune to fire and magma; +10% damage', mods: { fireImmune: 1, lavaImmune: 1, damage: 0.1 } },
  umbral: { description: '+15% critical chance, dash', mods: { crit: 15, dash: 1 } },
  aether: { description: '+20% damage, double jump', mods: { damage: 0.2, doubleJump: 1 } },
  starforged: { description: '+25% damage, +2 minion slots, life regeneration', mods: { damage: 0.25, minionSlots: 2, lifeRegen: 3 } },
};
