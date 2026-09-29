import { RECIPES, type RecipeDef } from '../data/recipes';
import { ItemRegistry } from '../items/ItemRegistry';
import { TileRegistry } from '../world/TileRegistry';

export interface Recipe extends RecipeDef {
  index: number;
  count: number;
}

/** Validated recipe list. Invalid recipes are dropped with a warning rather than crashing. */
class RecipeRegistryImpl {
  readonly recipes: Recipe[] = [];
  readonly problems: string[] = [];
  private stations = new Set<string>();

  constructor() {
    for (const t of TileRegistry.defs) if (t?.station) this.stations.add(t.station);
    RECIPES.forEach((r, i) => {
      const err = this.check(r);
      if (err) {
        this.problems.push(`recipe #${i} (${r.out}): ${err}`);
        return;
      }
      this.recipes.push({ ...r, index: this.recipes.length, count: r.count ?? 1 });
    });
    if (this.problems.length) console.warn('[Recipes] invalid recipes skipped:\n' + this.problems.join('\n'));
  }

  private check(r: RecipeDef): string | null {
    if (!ItemRegistry.has(r.out)) return `unknown output ${r.out}`;
    for (const [id, n] of r.ing) {
      if (!ItemRegistry.has(id)) return `unknown ingredient ${id}`;
      if (!(n > 0)) return `bad quantity for ${id}`;
    }
    if (r.station && !this.stations.has(r.station)) return `unknown station ${r.station}`;
    return null;
  }

  forOutput(itemId: string): Recipe[] {
    return this.recipes.filter((r) => r.out === itemId);
  }

  usingIngredient(itemId: string): Recipe[] {
    return this.recipes.filter((r) => r.ing.some(([id]) => id === itemId));
  }
}

export const RecipeRegistry = new RecipeRegistryImpl();
