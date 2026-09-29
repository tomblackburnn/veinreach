import type { ItemDef } from '../../items/types';

const potion = (id: string, name: string, description: string, color: string, rarity: number, value: number, c: ItemDef['consumable']): ItemDef => ({
  id, name, description, category: 'consumable', rarity, maxStack: 30, value, icon: { t: 'potion', c: [color] }, useTime: 17, useStyle: 'consume', consumable: c,
});

export const CONSUMABLE_ITEMS: ItemDef[] = [
  potion('lesser_mending', 'Lesser Mending Draught', 'Restores 50 health', '#ff5a7a', 0, 4, { heal: 50, sickness: true }),
  potion('mending', 'Mending Draught', 'Restores 100 health', '#ff2a5a', 1, 10, { heal: 100, sickness: true }),
  potion('greater_mending', 'Greater Mending Draught', 'Restores 175 health', '#ff2aa0', 4, 30, { heal: 175, sickness: true }),
  potion('mana_tonic', 'Mana Tonic', 'Restores 100 mana', '#4a6aff', 0, 4, { mana: 100 }),
  potion('swiftness_elixir', 'Swiftness Elixir', '+25% movement speed for 4 minutes', '#6ad0ff', 1, 8, { buffs: [{ id: 'swiftness', seconds: 240 }] }),
  potion('ironskin_elixir', 'Ironskin Elixir', '+8 defense for 4 minutes', '#c0c0a0', 1, 8, { buffs: [{ id: 'ironskin', seconds: 240 }] }),
  potion('nighteye_elixir', 'Nighteye Elixir', 'See in the dark for 4 minutes', '#8a6aff', 1, 8, { buffs: [{ id: 'nighteye', seconds: 240 }] }),
  potion('delver_elixir', 'Delver’s Elixir', '+30% mining speed for 5 minutes', '#e0923d', 1, 8, { buffs: [{ id: 'delving', seconds: 300 }] }),
  potion('fury_elixir', 'Fury Elixir', '+10% damage for 4 minutes', '#ff4a2a', 2, 12, { buffs: [{ id: 'fury', seconds: 240 }] }),
  potion('precision_elixir', 'Precision Elixir', '+10% critical chance for 4 minutes', '#f5cf3c', 2, 12, { buffs: [{ id: 'precision', seconds: 240 }] }),
  potion('regen_tonic', 'Regeneration Tonic', 'Regenerate health for 5 minutes', '#ff8ac0', 1, 8, { buffs: [{ id: 'regeneration', seconds: 300 }] }),
  potion('emberward_elixir', 'Emberward Elixir', 'Immune to fire and magma for 3 minutes', '#ff8a2a', 2, 12, { buffs: [{ id: 'emberward', seconds: 180 }] }),
  potion('recall_draught', 'Recall Draught', 'Returns you home', '#6fe0d0', 1, 10, { recall: true }),
  {
    id: 'glowcap_stew', name: 'Glowcap Stew', description: 'Minor improvements to all stats for 10 minutes', category: 'consumable', rarity: 1, maxStack: 30, value: 6,
    icon: { t: 'bowl', c: ['#45c8d8', '#a4713f'] }, useTime: 17, useStyle: 'consume', consumable: { buffs: [{ id: 'wellfed', seconds: 600 }] },
  },
  {
    id: 'mushroom', name: 'Meadow Mushroom', description: 'Restores 15 health', category: 'consumable', rarity: 0, maxStack: 99, value: 1,
    icon: { t: 'mushroom', c: ['#d06a4a', '#f0e0d0'] }, useTime: 17, useStyle: 'consume', consumable: { heal: 15, sickness: true },
  },
  {
    id: 'vital_heart', name: 'Vital Heart', description: 'Permanently increases maximum health by 20', category: 'consumable', rarity: 2, maxStack: 99, value: 30,
    icon: { t: 'heart', c: ['#ff3b5c', '#ffb0c0'] }, useTime: 30, useStyle: 'consume', consumable: { maxLifeUp: 20, heal: 20 },
  },
  {
    id: 'arcane_star', name: 'Arcane Star', description: 'Permanently increases maximum mana by 20', category: 'consumable', rarity: 2, maxStack: 99, value: 30,
    icon: { t: 'star', c: ['#6a8aff', '#ffffff'] }, useTime: 30, useStyle: 'consume', consumable: { maxManaUp: 20, mana: 20 },
  },
  {
    id: 'aurel', name: 'Aurel', description: 'The common currency of Veinreach.', category: 'currency', rarity: 0, maxStack: 999999, value: 1,
    icon: { t: 'coin', c: ['#f5cf3c', '#8e7020'] },
  },
];

const summonItem = (id: string, name: string, description: string, icon: ItemDef['icon'], boss: string, rarity: number): ItemDef => ({
  id, name, description, category: 'bossSummon', rarity, maxStack: 20, value: 20, icon, useTime: 45, useStyle: 'hold', summonBoss: boss,
});

export const SUMMON_ITEMS: ItemDef[] = [
  summonItem('grubbling_lure', 'Grubbling Lure', 'Use underground to draw out Gravelmaw, the Burrowing Tyrant', { t: 'lure', c: ['#c0a070', '#6a4a2a'] }, 'gravelmaw', 1),
  summonItem('withered_seed', 'Withered Seed', 'Plant it on the surface at night to wake the Thornwarden', { t: 'seed', c: ['#8d5aa8', '#3a2a1a'] }, 'thornwarden', 2),
  summonItem('resonant_prism', 'Resonant Prism', 'Use in the deep caverns to awaken Obelisk Prime', { t: 'prism', c: ['#6fe0d0', '#ffffff'] }, 'obelisk', 3),
  summonItem('brimstone_chalice', 'Brimstone Chalice', 'Offer it in Emberdeep to call Nhal’Zyra, the Emberwyrm', { t: 'chalice', c: ['#ff6a2a', '#f5cf3c'] }, 'serpent', 5),
  summonItem('astral_sigil', 'Astral Sigil', 'Raise it to the night sky to challenge Solmara, the Unmade Star', { t: 'sigil', c: ['#fff0a0', '#ff8ae6'] }, 'solmara', 7),
  {
    id: 'rusted_horn', name: 'Rusted Horn', description: 'Sound it to provoke a Rustbound Raid', category: 'bossSummon', rarity: 2, maxStack: 20, value: 20,
    icon: { t: 'horn', c: ['#9aa0a8', '#8a5a3a'] }, useTime: 45, useStyle: 'hold', startsEvent: 'raid',
  },
  {
    id: 'gloam_lantern', name: 'Gloam Lantern', description: 'Light it at night to begin a Gloamtide', category: 'bossSummon', rarity: 2, maxStack: 20, value: 20,
    icon: { t: 'lantern', c: ['#8a60c0', '#e0b0ff'] }, useTime: 45, useStyle: 'hold', startsEvent: 'gloamtide',
  },
];
