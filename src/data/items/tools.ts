import type { ItemDef } from '../../items/types';

const pick = (id: string, name: string, power: number, dmg: number, useTime: number, head: string, rarity: number, value: number, handle = '#8b5a2b'): ItemDef => ({
  id, name, category: 'tool', rarity, maxStack: 1, value, icon: { t: 'pickaxe', c: [head, handle] },
  useTime, useStyle: 'swing', autoReuse: true, tool: { pick: power }, weapon: { damage: dmg, knockback: 2, kind: 'melee', reach: 30 },
});
const axe = (id: string, name: string, power: number, dmg: number, useTime: number, head: string, rarity: number, value: number): ItemDef => ({
  id, name, category: 'tool', rarity, maxStack: 1, value, icon: { t: 'axe', c: [head, '#8b5a2b'] },
  useTime, useStyle: 'swing', autoReuse: true, tool: { axe: power }, weapon: { damage: dmg, knockback: 4, kind: 'melee', reach: 30 },
});
const hammer = (id: string, name: string, power: number, dmg: number, useTime: number, head: string, rarity: number, value: number): ItemDef => ({
  id, name, category: 'tool', rarity, maxStack: 1, value, icon: { t: 'hammer', c: [head, '#8b5a2b'] },
  useTime, useStyle: 'swing', autoReuse: true, tool: { hammer: power }, weapon: { damage: dmg, knockback: 5, kind: 'melee', reach: 30 },
  description: 'Knocks out background walls.',
});

export const TOOL_ITEMS: ItemDef[] = [
  pick('brasslite_pickaxe', 'Brasslite Pickaxe', 35, 4, 13, '#e0923d', 0, 60),
  pick('ferrocite_pickaxe', 'Ferrocite Pickaxe', 45, 5, 12, '#a7b3c2', 0, 120),
  pick('moonsilver_pickaxe', 'Moonsilver Pickaxe', 55, 6, 11, '#cfe0ff', 1, 200),
  pick('sungild_pickaxe', 'Sungild Pickaxe', 62, 7, 10, '#f5cf3c', 1, 300),
  pick('glimmer_pickaxe', 'Glimmer Pickaxe', 75, 10, 9, '#6fe0d0', 2, 500),
  pick('chitin_drill', 'Gravelmaw Mandible', 70, 12, 7, '#c0a070', 2, 450, '#6a4a2a'),
  pick('cindrite_pickaxe', 'Cinderpick', 100, 16, 8, '#ff6a2a', 3, 900),
  pick('umbral_pickaxe', 'Umbral Pickaxe', 120, 24, 7, '#8a3cd6', 5, 1600),
  pick('aether_pickaxe', 'Aether Pickaxe', 160, 34, 6, '#9ff5ff', 6, 2600),
  axe('brasslite_axe', 'Brasslite Hatchet', 40, 5, 15, '#e0923d', 0, 50),
  axe('ferrocite_axe', 'Ferrocite Axe', 55, 7, 14, '#a7b3c2', 0, 110),
  axe('sungild_axe', 'Sungild Axe', 75, 10, 12, '#f5cf3c', 1, 280),
  axe('cindrite_axe', 'Cinder Axe', 110, 18, 11, '#ff6a2a', 3, 850),
  hammer('timber_mallet', 'Timber Mallet', 25, 3, 18, '#a4713f', 0, 20),
  hammer('ferrocite_hammer', 'Ferrocite Hammer', 45, 8, 16, '#a7b3c2', 0, 110),
  hammer('cindrite_hammer', 'Cinder Maul', 80, 20, 14, '#ff6a2a', 3, 800),
  {
    id: 'homeward_compass', name: 'Homeward Compass', description: 'Use to return to your spawn point.', category: 'utility',
    rarity: 2, maxStack: 1, value: 300, icon: { t: 'compass', c: ['#f5cf3c', '#6fe0d0'] }, useTime: 60, useStyle: 'hold', utility: 'recall',
  },
  {
    id: 'delvers_almanac', name: 'Delver\u2019s Almanac', description: 'Everything you need to know to beat Veinreach: bosses, loadouts, armour and more. Use it (or press G) to read.',
    category: 'utility', rarity: 1, maxStack: 1, value: 5, icon: { t: 'tome', c: ['#d9a441', '#5a3a1e'] }, useTime: 20, useStyle: 'hold', utility: 'guide',
  },
  {
    id: 'bucket', name: 'Empty Bucket', description: 'Scoop up water or magma.', category: 'utility', rarity: 0, maxStack: 1, value: 20,
    icon: { t: 'bucket', c: ['#a7b3c2'] }, useTime: 15, useStyle: 'hold', liquid: { action: 'collect' },
  },
  {
    id: 'water_bucket', name: 'Water Bucket', category: 'utility', rarity: 0, maxStack: 1, value: 20,
    icon: { t: 'bucket', c: ['#a7b3c2', '#3a8ae0'] }, useTime: 15, useStyle: 'hold', liquid: { action: 'pour', type: 1 },
  },
  {
    id: 'lava_bucket', name: 'Magma Bucket', category: 'utility', rarity: 1, maxStack: 1, value: 20,
    icon: { t: 'bucket', c: ['#a7b3c2', '#ff6a2a'] }, useTime: 15, useStyle: 'hold', liquid: { action: 'pour', type: 2 },
  },
];
