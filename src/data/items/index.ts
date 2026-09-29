import type { ItemDef } from '../../items/types';
import { BLOCK_ITEMS } from './blocks';
import { MATERIAL_ITEMS } from './materials';
import { TOOL_ITEMS } from './tools';
import { WEAPON_ITEMS, AMMO_ITEMS } from './weapons';
import { ARMOR_ITEMS } from './armor';
import { ACCESSORY_ITEMS } from './accessories';
import { CONSUMABLE_ITEMS, SUMMON_ITEMS } from './consumables';

export const ALL_ITEMS: ItemDef[] = [
  ...BLOCK_ITEMS,
  ...MATERIAL_ITEMS,
  ...TOOL_ITEMS,
  ...WEAPON_ITEMS,
  ...AMMO_ITEMS,
  ...ARMOR_ITEMS,
  ...ACCESSORY_ITEMS,
  ...CONSUMABLE_ITEMS,
  ...SUMMON_ITEMS,
];
