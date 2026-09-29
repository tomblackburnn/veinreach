import type { ItemDef, StatMods } from '../../items/types';

const acc = (id: string, name: string, description: string, icon: ItemDef['icon'], mods: StatMods, rarity: number, value: number): ItemDef => ({
  id, name, description, category: 'accessory', rarity, maxStack: 1, value, icon, accessory: mods,
});

export const ACCESSORY_ITEMS: ItemDef[] = [
  acc('swiftstep_boots', 'Swiftstep Boots', '+18% movement speed', { t: 'boots', c: ['#6a8ac0', '#e0e0e0'] }, { moveSpeed: 0.18 }, 1, 200),
  acc('springheel_boots', 'Springheel Boots', 'Jump noticeably higher', { t: 'boots', c: ['#c06a4a', '#ffd070'] }, { jumpBoost: 0.35 }, 1, 200),
  acc('zephyr_charm', 'Zephyr Charm', 'Grants a second jump in mid-air', { t: 'charm', c: ['#bfe6f0', '#ffffff'] }, { doubleJump: 1 }, 2, 350),
  acc('featherfall_pendant', 'Featherfall Pendant', 'Negates fall damage', { t: 'amulet', c: ['#ffffff', '#9ab0d0'] }, { fallImmune: 1 }, 1, 150),
  acc('menders_band', 'Mender’s Band', 'Regenerate 2 health per second', { t: 'ring', c: ['#ff5a7a', '#f5cf3c'] }, { lifeRegen: 2 }, 1, 250),
  acc('keen_monocle', 'Keen Monocle', '+6% critical chance', { t: 'lens', c: ['#f5cf3c', '#bfe6f0'] }, { crit: 6 }, 1, 200),
  acc('stonehide_charm', 'Stonehide Charm', '+4 defense', { t: 'charm', c: ['#77777f', '#b0b0b8'] }, { defense: 4 }, 1, 180),
  acc('dashing_sash', 'Dashing Sash', 'Double-tap left or right to dash', { t: 'sash', c: ['#c0404a', '#f5cf3c'] }, { dash: 1 }, 2, 400),
  acc('mana_prism', 'Mana Prism', '+20 max mana, 8% reduced mana cost', { t: 'shard', c: ['#6a8aff', '#ffffff'] }, { maxMana: 20, manaCostReduce: 0.08 }, 2, 300),
  acc('miners_glove', 'Miner’s Glove', '+25% mining speed', { t: 'glove', c: ['#a4713f', '#e0923d'] }, { miningSpeed: 0.25 }, 1, 150),
  acc('hunters_lens', 'Hunter’s Lens', 'Reveals nearby creatures on the minimap', { t: 'lens', c: ['#c0404a', '#ffe070'] }, { detectEnemies: 1 }, 1, 150),
  acc('ironclad_buckler', 'Ironclad Buckler', 'Immune to knockback, +1 defense', { t: 'shield', c: ['#a7b3c2', '#5d6474'] }, { knockbackImmune: 1, defense: 1 }, 2, 300),
  acc('ember_sigil', 'Ember Sigil', 'Immunity to burning and brief magma protection', { t: 'charm', c: ['#ff6a2a', '#ffe070'] }, { fireImmune: 1, lavaImmune: 1 }, 3, 500),
  acc('spirit_lantern', 'Spirit Lantern', 'Surrounds you with a gentle light', { t: 'lantern', c: ['#8fe0ff', '#ffffff'] }, { lightRadius: 0.8 }, 1, 150),
  acc('depth_gauge', 'Depth Gauge', 'Displays your depth', { t: 'compass', c: ['#a7b3c2', '#e0923d'] }, { showDepth: 1 }, 0, 100),
  acc('pocket_sundial', 'Pocket Sundial', 'Displays the time of day', { t: 'compass', c: ['#f5cf3c', '#8e7020'] }, { showTime: 1 }, 0, 100),
  // Boss accessories
  acc('burrowers_carapace', 'Burrower’s Carapace', 'Immune to knockback, +4 defense, +10% mining speed', { t: 'shield', c: ['#9a7a52', '#c0a070'] }, { knockbackImmune: 1, defense: 4, miningSpeed: 0.1 }, 3, 600),
  acc('seedcrown', 'Warden’s Seedcrown', '+1 life regen, +8% damage', { t: 'ring', c: ['#6ad04a', '#3a2a1a'] }, { lifeRegen: 1, damage: 0.08 }, 3, 700),
  acc('resonant_core', 'Resonant Core', '+40 max mana, +10% magic damage', { t: 'core', c: ['#6fe0d0', '#2a3558'] }, { maxMana: 40, magicDamage: 0.1 }, 4, 900),
  acc('wyrm_heart', 'Wyrm Heart', 'Immune to fire and magma, +10% melee speed and movement', { t: 'orb', c: ['#ff8a3a', '#5a1a10'] }, { fireImmune: 1, lavaImmune: 1, meleeSpeed: 0.1, moveSpeed: 0.1 }, 6, 1800),
  // Combined accessories
  acc('voyager_treads', 'Voyager Treads', '+22% movement speed, jump higher, no fall damage', { t: 'boots', c: ['#6fe0d0', '#f5cf3c'] }, { moveSpeed: 0.22, jumpBoost: 0.35, fallImmune: 1 }, 3, 800),
  acc('aurora_mantle', 'Aurora Mantle', 'Double jump, dash, +10% movement speed', { t: 'sash', c: ['#9ff5ff', '#ff8ae6'] }, { doubleJump: 1, dash: 1, moveSpeed: 0.1 }, 5, 1500),
  acc('delvers_kit', 'Delver’s Kit', 'Depth, time, and creature readouts; personal light', { t: 'lantern', c: ['#f5cf3c', '#c0404a'] }, { showDepth: 1, showTime: 1, detectEnemies: 1, lightRadius: 0.8 }, 3, 600),
];
