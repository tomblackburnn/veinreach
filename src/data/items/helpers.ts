import type { ItemDef, IconSpec } from '../../items/types';

type Extra = Partial<ItemDef>;

export function block(id: string, name: string, tile: string, value = 0, extra: Extra = {}): ItemDef {
  return { id, name, category: 'block', rarity: 0, maxStack: 999, value, icon: { t: 'tile', tile }, useTime: 12, useStyle: 'place', autoReuse: true, placeTile: tile, ...extra };
}

export function wallItem(id: string, name: string, wall: string, value = 0): ItemDef {
  return { id, name, category: 'wall', rarity: 0, maxStack: 999, value, icon: { t: 'wall', wall }, useTime: 8, useStyle: 'place', autoReuse: true, placeWall: wall };
}

export function furniture(id: string, name: string, tile: string, value: number, description?: string, extra: Extra = {}): ItemDef {
  return { id, name, description, category: 'furniture', rarity: 0, maxStack: 99, value, icon: { t: 'object', tile }, useTime: 15, useStyle: 'place', placeTile: tile, ...extra };
}

export function material(id: string, name: string, icon: IconSpec, value: number, rarity = 0, description?: string, extra: Extra = {}): ItemDef {
  return { id, name, description, category: 'material', rarity, maxStack: 999, value, icon, ...extra };
}
