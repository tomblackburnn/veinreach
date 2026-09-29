import type { ItemDef, WeaponStats } from '../../items/types';

type W = Omit<WeaponStats, 'kind'>;
const melee = (id: string, name: string, icon: ItemDef['icon'], useTime: number, w: W, rarity: number, value: number, description?: string, style: ItemDef['useStyle'] = 'swing'): ItemDef => ({
  id, name, description, category: 'melee', rarity, maxStack: 1, value, icon, useTime, useStyle: style, autoReuse: rarity >= 2, weapon: { ...w, kind: 'melee' },
});
const ranged = (id: string, name: string, icon: ItemDef['icon'], useTime: number, w: W, rarity: number, value: number, description?: string): ItemDef => ({
  id, name, description, category: 'ranged', rarity, maxStack: 1, value, icon, useTime, useStyle: 'shoot', autoReuse: true, weapon: { ...w, kind: 'ranged' },
});
const magic = (id: string, name: string, icon: ItemDef['icon'], useTime: number, w: W, rarity: number, value: number, description?: string): ItemDef => ({
  id, name, description, category: 'magic', rarity, maxStack: 1, value, icon, useTime, useStyle: 'shoot', autoReuse: true, weapon: { ...w, kind: 'magic' },
});
const summon = (id: string, name: string, icon: ItemDef['icon'], w: W, rarity: number, value: number, description: string): ItemDef => ({
  id, name, description, category: 'summon', rarity, maxStack: 1, value, icon, useTime: 30, useStyle: 'shoot', weapon: { ...w, kind: 'summon', minionCost: 1 },
});

export const WEAPON_ITEMS: ItemDef[] = [
  // --- Melee ---
  melee('timber_sword', 'Timber Sword', { t: 'sword', c: ['#a4713f', '#6a4220'] }, 22, { damage: 7, knockback: 4, reach: 30 }, 0, 20),
  melee('spineblade', 'Spineblade', { t: 'sword', c: ['#3f8a4a', '#2a5a30'] }, 22, { damage: 9, knockback: 4, reach: 32 }, 0, 40, 'Prickly. Mind the grip.'),
  melee('brasslite_blade', 'Brasslite Blade', { t: 'sword', c: ['#e0923d', '#6a4220'] }, 20, { damage: 10, knockback: 5, reach: 34 }, 0, 80),
  melee('ferrocite_broadsword', 'Ferrocite Broadsword', { t: 'broadsword', c: ['#a7b3c2', '#5a3a20'] }, 21, { damage: 13, knockback: 5.5, reach: 38 }, 0, 160),
  melee('moonsilver_saber', 'Moonsilver Saber', { t: 'sword', c: ['#cfe0ff', '#3e4f8a'] }, 16, { damage: 16, knockback: 4, crit: 8, reach: 38 }, 1, 260, 'Light and quick.'),
  melee('sungild_greatsword', 'Sungild Greatsword', { t: 'greatsword', c: ['#f5cf3c', '#8e7020'] }, 26, { damage: 23, knockback: 7, reach: 48 }, 1, 380),
  melee('glimmerbrand', 'Glimmerbrand', { t: 'broadsword', c: ['#6fe0d0', '#2a3558'] }, 20, { damage: 26, knockback: 5, reach: 42, swingProjectile: 'glimmer_bolt', shootSpeed: 9 }, 2, 600, 'Sheds crystal slivers with each swing.'),
  melee('gravelcrusher', 'Gravelcrusher', { t: 'greatsword', c: ['#9a8f86', '#c0a070'] }, 28, { damage: 30, knockback: 10, reach: 52 }, 2, 700, 'A mandible sharpened into a blade.'),
  melee('thornlash', 'Thornlash', { t: 'broadsword', c: ['#6ab04a', '#3a2a1a'] }, 18, { damage: 28, knockback: 4, reach: 42, swingProjectile: 'thorn_bolt', shootSpeed: 10, onHit: { buff: 'poisoned', seconds: 4, chance: 0.4 } }, 3, 900),
  melee('riftrang', 'Riftrang', { t: 'boomerang', c: ['#6fe0d0', '#2a6a80'] }, 18, { damage: 20, knockback: 6, projectile: 'riftrang', shootSpeed: 11 }, 2, 500, 'Always comes back.', 'shoot'),
  melee('emberlance', 'Emberlance', { t: 'spear', c: ['#ff7a2a', '#5a2a2a'] }, 24, { damage: 36, knockback: 6, projectile: 'emberlance', shootSpeed: 4, onHit: { buff: 'burning', seconds: 4, chance: 0.5 } }, 3, 1100, undefined, 'thrust'),
  melee('umbral_reaver', 'Umbral Reaver', { t: 'greatsword', c: ['#8a3cd6', '#1a0a2a'] }, 22, { damage: 50, knockback: 7, reach: 54, swingProjectile: 'umbral_wave', shootSpeed: 8 }, 5, 2400, 'Cuts through the space between things.'),
  melee('serpentfang_glaive', 'Serpentfang Glaive', { t: 'spear', c: ['#ffb040', '#5a1a10'] }, 20, { damage: 62, knockback: 7, projectile: 'serpent_glaive', shootSpeed: 5, onHit: { buff: 'burning', seconds: 6, chance: 0.7 } }, 6, 3400, undefined, 'thrust'),
  melee('starfall_edge', 'Starfall Edge', { t: 'greatsword', c: ['#fff0a0', '#ff8ae6'] }, 16, { damage: 88, knockback: 6, reach: 58, crit: 10, swingProjectile: 'starfall', shootSpeed: 12 }, 8, 8000, 'Each swing calls down a falling star.'),
  // --- Ranged ---
  ranged('timber_bow', 'Timber Bow', { t: 'bow', c: ['#a4713f', '#e8e8e8'] }, 28, { damage: 5, knockback: 0.5, ammo: 'arrow', shootSpeed: 7 }, 0, 20),
  ranged('ferrocite_bow', 'Ferrocite Bow', { t: 'bow', c: ['#a7b3c2', '#e8e8e8'] }, 25, { damage: 9, knockback: 1, ammo: 'arrow', shootSpeed: 8 }, 0, 130),
  ranged('sungild_longbow', 'Sungild Longbow', { t: 'bow', c: ['#f5cf3c', '#ffffff'] }, 22, { damage: 14, knockback: 1.5, ammo: 'arrow', shootSpeed: 10 }, 1, 320),
  ranged('brass_arbalest', 'Brass Arbalest', { t: 'crossbow', c: ['#e0923d', '#6a4220'] }, 38, { damage: 22, knockback: 4, ammo: 'arrow', shootSpeed: 13, crit: 10 }, 1, 350, 'Slow to reload, hits like a mule.'),
  ranged('boomstick', 'Boomstick', { t: 'gun', c: ['#5d6474', '#8b5a2b'] }, 30, { damage: 18, knockback: 3, ammo: 'pellet', shootSpeed: 12, shots: 4, spread: 0.22 }, 2, 700, 'Fires a spread of pellets.'),
  ranged('shardrepeater', 'Shardrepeater', { t: 'crossbow', c: ['#6fe0d0', '#2a3558'] }, 10, { damage: 24, knockback: 1.5, ammo: 'arrow', shootSpeed: 12 }, 4, 1500, 'Rapid-fire crystal crossbow.'),
  ranged('cinderstring', 'Cinderstring', { t: 'bow', c: ['#ff6a2a', '#ffd070'] }, 18, { damage: 32, knockback: 2, ammo: 'arrow', shootSpeed: 11, onHit: { buff: 'burning', seconds: 3, chance: 0.5 } }, 3, 1200, 'Arrows catch fire as they leave the string.'),
  ranged('wyrmstring', 'Wyrmstring', { t: 'bow', c: ['#ffb040', '#5a1a10'] }, 14, { damage: 46, knockback: 2, ammo: 'arrow', shootSpeed: 13, shots: 2, spread: 0.08 }, 6, 3200),
  ranged('astral_volley', 'Astral Volley', { t: 'gun', c: ['#9ff5ff', '#ff8ae6'] }, 8, { damage: 58, knockback: 2, projectile: 'star_volley', shootSpeed: 14, ammo: 'pellet' }, 8, 7500, 'Converts pellets into seeking stars.'),
  // --- Magic ---
  magic('apprentice_wand', 'Apprentice’s Wand', { t: 'wand', c: ['#a4713f', '#ffe070'] }, 22, { damage: 9, knockback: 2, projectile: 'spark', shootSpeed: 8, manaCost: 4 }, 0, 60),
  magic('frostbloom_staff', 'Frostbloom Staff', { t: 'staff', c: ['#8fe0ff', '#5a7f9c'] }, 24, { damage: 16, knockback: 3, projectile: 'frost_bolt', shootSpeed: 9, manaCost: 7, onHit: { buff: 'chilled', seconds: 3, chance: 0.6 } }, 1, 300),
  magic('verdant_scepter', 'Verdant Scepter', { t: 'staff', c: ['#6ad04a', '#3a2a1a'] }, 20, { damage: 22, knockback: 2, projectile: 'verdant_leaf', shootSpeed: 7, manaCost: 7, shots: 2, spread: 0.3 }, 3, 900, 'Homing leaves seek the nearest foe.'),
  magic('tome_of_embers', 'Tome of Embers', { t: 'tome', c: ['#ff6a2a', '#5a2a2a'] }, 28, { damage: 28, knockback: 4, projectile: 'fireball', shootSpeed: 8, manaCost: 12, onHit: { buff: 'burning', seconds: 4, chance: 0.8 } }, 3, 1000),
  magic('prismatic_staff', 'Prismatic Staff', { t: 'staff', c: ['#9ff5ff', '#2a3558'] }, 10, { damage: 24, knockback: 1, projectile: 'prism_ray', shootSpeed: 14, manaCost: 5 }, 4, 1500, 'Refracts mana into piercing rays.'),
  magic('voidcaller_codex', 'Voidcaller Codex', { t: 'tome', c: ['#a64cff', '#1a0a2a'] }, 20, { damage: 48, knockback: 3, projectile: 'void_orb', shootSpeed: 7, manaCost: 14, shots: 2, spread: 0.4 }, 5, 2600),
  magic('astral_scepter', 'Astral Scepter', { t: 'staff', c: ['#fff0a0', '#9ff5ff'] }, 14, { damage: 72, knockback: 4, projectile: 'astral_star', shootSpeed: 13, manaCost: 16 }, 8, 7800, 'Calls stars down around the cursor.'),
  // --- Summon ---
  summon('wisp_rod', 'Wisp Rod', { t: 'wand', c: ['#45c8d8', '#8fe0ff'] }, { damage: 9, knockback: 1, projectile: 'wisp_minion', manaCost: 10 }, 1, 200, 'Summons a glowing wisp to fight beside you.'),
  summon('shardcaller', 'Shardcaller', { t: 'staff', c: ['#6fe0d0', '#ffffff'] }, { damage: 24, knockback: 2, projectile: 'shard_minion', manaCost: 10 }, 4, 1600, 'Summons a crystal shard that orbits and strikes.'),
  summon('wyrmling_staff', 'Wyrmling Staff', { t: 'staff', c: ['#ff8a3a', '#5a1a10'] }, { damage: 42, knockback: 3, projectile: 'wyrmling_minion', manaCost: 10 }, 6, 3000, 'Summons a young emberwyrm.'),
];

export const AMMO_ITEMS: ItemDef[] = [
  { id: 'wooden_arrow', name: 'Timber Arrow', category: 'ammo', rarity: 0, maxStack: 999, value: 0.2, icon: { t: 'arrow', c: ['#c9a36a', '#e8e8e8'] }, ammo: { type: 'arrow', damage: 4, projectile: 'arrow_wood' } },
  { id: 'barbed_arrow', name: 'Barbed Arrow', category: 'ammo', rarity: 0, maxStack: 999, value: 0.5, icon: { t: 'arrow', c: ['#a7b3c2', '#e8e8e8'] }, ammo: { type: 'arrow', damage: 7, projectile: 'arrow_barbed', speedBonus: 1 }, description: 'Pierces one target.' },
  { id: 'frost_arrow', name: 'Frost Arrow', category: 'ammo', rarity: 1, maxStack: 999, value: 0.8, icon: { t: 'arrow', c: ['#8fe0ff', '#ffffff'] }, ammo: { type: 'arrow', damage: 8, projectile: 'arrow_frost' }, description: 'Chills targets.' },
  { id: 'ember_arrow', name: 'Ember Arrow', category: 'ammo', rarity: 2, maxStack: 999, value: 1.2, icon: { t: 'arrow', c: ['#ff7a2a', '#ffd070'] }, ammo: { type: 'arrow', damage: 11, projectile: 'arrow_ember', speedBonus: 1 }, description: 'Sets targets alight.' },
  { id: 'void_arrow', name: 'Void Arrow', category: 'ammo', rarity: 5, maxStack: 999, value: 2, icon: { t: 'arrow', c: ['#a64cff', '#e0b0ff'] }, ammo: { type: 'arrow', damage: 16, projectile: 'arrow_void', speedBonus: 2 }, description: 'Pierces several targets.' },
  { id: 'lead_pellet', name: 'Lead Pellet', category: 'ammo', rarity: 0, maxStack: 999, value: 0.3, icon: { t: 'bullet', c: ['#9aa0a8'] }, ammo: { type: 'pellet', damage: 7, projectile: 'pellet_lead' } },
  { id: 'cindershot', name: 'Cindershot', category: 'ammo', rarity: 3, maxStack: 999, value: 1.5, icon: { t: 'bullet', c: ['#ff7a2a'] }, ammo: { type: 'pellet', damage: 12, projectile: 'pellet_cinder', speedBonus: 2 } },
];
