import type { StatMods } from '../items/types';

export interface BuffDef {
  id: string;
  name: string;
  description: string;
  debuff: boolean;
  icon: { t: string; c: string[] };
  mods?: StatMods;
  /** Damage per second while active (debuffs). */
  dps?: number;
  /** Movement multiplier (e.g. chilled). */
  speedMul?: number;
  /** Particle colour emitted while active. */
  particle?: string;
}

export const BUFFS: BuffDef[] = [
  { id: 'swiftness', name: 'Swiftness', description: '+25% movement speed', debuff: false, icon: { t: 'potion', c: ['#6ad0ff'] }, mods: { moveSpeed: 0.25 } },
  { id: 'ironskin', name: 'Ironskin', description: '+8 defense', debuff: false, icon: { t: 'potion', c: ['#c0c0a0'] }, mods: { defense: 8 } },
  { id: 'nighteye', name: 'Nighteye', description: 'Improved vision in darkness', debuff: false, icon: { t: 'potion', c: ['#8a6aff'] }, mods: { nightVision: 1 } },
  { id: 'delving', name: 'Delving', description: '+30% mining speed', debuff: false, icon: { t: 'potion', c: ['#e0923d'] }, mods: { miningSpeed: 0.3 } },
  { id: 'fury', name: 'Fury', description: '+10% damage', debuff: false, icon: { t: 'potion', c: ['#ff4a2a'] }, mods: { damage: 0.1 } },
  { id: 'precision', name: 'Precision', description: '+10% critical chance', debuff: false, icon: { t: 'potion', c: ['#f5cf3c'] }, mods: { crit: 10 } },
  { id: 'regeneration', name: 'Regeneration', description: 'Regenerating 3 health per second', debuff: false, icon: { t: 'potion', c: ['#ff8ac0'] }, mods: { lifeRegen: 3 } },
  { id: 'emberward', name: 'Emberward', description: 'Immune to fire and magma', debuff: false, icon: { t: 'potion', c: ['#ff8a2a'] }, mods: { fireImmune: 1, lavaImmune: 1 } },
  { id: 'wellfed', name: 'Well Fed', description: 'Minor improvements to all stats', debuff: false, icon: { t: 'bowl', c: ['#45c8d8', '#a4713f'] }, mods: { defense: 2, crit: 2, damage: 0.05, moveSpeed: 0.05, lifeRegen: 0.5 } },
  { id: 'campfire', name: 'Cozy Fire', description: 'Life regeneration is increased', debuff: false, icon: { t: 'flame', c: ['#ff9a3a'] }, mods: { lifeRegen: 1 } },
  { id: 'homely', name: 'Homely', description: 'Your spawn point is set', debuff: false, icon: { t: 'heart', c: ['#b8434a', '#ffb0c0'] } },
  // Debuffs
  { id: 'potion_sickness', name: 'Draught Sickness', description: 'Cannot drink healing draughts', debuff: true, icon: { t: 'potion', c: ['#707070'] } },
  { id: 'poisoned', name: 'Poisoned', description: 'Slowly losing health', debuff: true, icon: { t: 'drop', c: ['#6ad04a'] }, dps: 4, particle: '#6ad04a' },
  { id: 'burning', name: 'Burning', description: 'Losing health rapidly', debuff: true, icon: { t: 'flame', c: ['#ff6a2a'] }, dps: 8, particle: '#ff8a2a' },
  { id: 'chilled', name: 'Chilled', description: 'Movement slowed', debuff: true, icon: { t: 'snowflake', c: ['#8fe0ff'] }, speedMul: 0.6, particle: '#bff0ff' },
  { id: 'weakened', name: 'Weakened', description: '-15% damage, -4 defense', debuff: true, icon: { t: 'drop', c: ['#8a8a6a'] }, mods: { damage: -0.15, defense: -4 } },
  { id: 'blighted', name: 'Blighted', description: 'Losing health and defense', debuff: true, icon: { t: 'drop', c: ['#8d5aa8'] }, dps: 5, mods: { defense: -6 }, particle: '#b07ad0' },
  { id: 'voidtouched', name: 'Voidtouched', description: 'Life regeneration disabled', debuff: true, icon: { t: 'drop', c: ['#a64cff'] }, mods: { lifeRegen: -4 }, particle: '#a64cff' },
];

export const BUFF_MAP = new Map(BUFFS.map((b) => [b.id, b]));
