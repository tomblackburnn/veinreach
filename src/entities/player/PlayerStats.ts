import { ItemRegistry } from '../../items/ItemRegistry';
import { SET_BONUSES } from '../../data/items/armor';
import { addMods, emptyStats, type ResolvedStats } from '../../items/stats';
import type { PlayerInventory } from '../../inventory/PlayerInventory';
import type { BuffSet } from '../../systems/BuffSystem';

export interface ComputedStats extends ResolvedStats {
  setBonus: string | null;
}

/** Aggregate armour, set bonus, accessories and buffs into final stats. */
export function computeStats(inv: PlayerInventory, buffs: BuffSet): ComputedStats {
  const s = emptyStats();
  const sets: string[] = [];
  for (const slot of inv.armor.slots) {
    if (!slot) continue;
    const a = ItemRegistry.get(slot.id).armor;
    if (!a) continue;
    s.defense += a.defense;
    addMods(s, a.mods);
    if (a.set) sets.push(a.set);
  }
  let setBonus: string | null = null;
  if (sets.length === 3 && sets.every((x) => x === sets[0]) && SET_BONUSES[sets[0]]) {
    setBonus = sets[0];
    addMods(s, SET_BONUSES[sets[0]].mods);
  }
  for (const slot of inv.accessories.slots) if (slot) addMods(s, ItemRegistry.get(slot.id).accessory);
  buffs.applyMods(s);
  s.minionSlots += 1;
  return { ...s, setBonus };
}
