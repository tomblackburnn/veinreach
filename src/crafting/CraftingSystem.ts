import { RecipeRegistry, type Recipe } from './RecipeRegistry';
import type { ItemContainer } from '../inventory/ItemContainer';
import type { ItemStack } from '../items/ItemStack';
import { TileRegistry } from '../world/TileRegistry';
import type { World } from '../world/World';

export const STATION_RANGE_X = 5;
export const STATION_RANGE_Y = 4;

/** Scan tiles around a point for crafting station tags. */
export function nearbyStations(world: World, tx: number, ty: number): Set<string> {
  const out = new Set<string>();
  for (let y = ty - STATION_RANGE_Y; y <= ty + STATION_RANGE_Y; y++) {
    for (let x = tx - STATION_RANGE_X; x <= tx + STATION_RANGE_X; x++) {
      const st = TileRegistry.get(world.getFg(x, y)).station;
      if (st) out.add(st);
      // Bookcases double as a scholar station, tables as a basic workbench surface are not stations.
    }
  }
  return out;
}

export function recipeUnlocked(r: Recipe, stations: ReadonlySet<string>, flags: ReadonlySet<string>): boolean {
  if (r.station && !stations.has(r.station)) return false;
  if (r.requires && !flags.has(r.requires)) return false;
  return true;
}

export function ingredientCount(sources: ItemContainer[], id: string): number {
  return sources.reduce((n, c) => n + c.count(id), 0);
}

export function canCraft(r: Recipe, sources: ItemContainer[]): boolean {
  return r.ing.every(([id, n]) => ingredientCount(sources, id) >= n);
}

/** Max number of times a recipe can be crafted from the given sources. */
export function maxCrafts(r: Recipe, sources: ItemContainer[]): number {
  let m = Infinity;
  for (const [id, n] of r.ing) m = Math.min(m, Math.floor(ingredientCount(sources, id) / n));
  return m === Infinity ? 0 : m;
}

/**
 * Consume ingredients and return the output stack, or null if not craftable.
 * Ingredients are removed from sources in order.
 */
export function craft(r: Recipe, sources: ItemContainer[]): ItemStack | null {
  if (!canCraft(r, sources)) return null;
  for (const [id, n] of r.ing) {
    let left = n;
    for (const c of sources) {
      if (left <= 0) break;
      left -= c.remove(id, left);
    }
  }
  return { id: r.out, count: r.count };
}

/** Recipes visible at the current stations, craftable first. */
export function listRecipes(stations: ReadonlySet<string>, flags: ReadonlySet<string>, sources: ItemContainer[]): { recipe: Recipe; craftable: boolean }[] {
  const out: { recipe: Recipe; craftable: boolean }[] = [];
  for (const r of RecipeRegistry.recipes) {
    if (!recipeUnlocked(r, stations, flags)) continue;
    out.push({ recipe: r, craftable: canCraft(r, sources) });
  }
  out.sort((a, b) => Number(b.craftable) - Number(a.craftable));
  return out;
}
