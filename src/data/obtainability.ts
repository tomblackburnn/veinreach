/**
 * Reachability analysis: which items can a player actually obtain?
 * Used by tests (and scripts/audit-items.ts) to guarantee no dead content.
 */
import { ItemRegistry } from '../items/ItemRegistry';
import { RecipeRegistry } from '../crafting/RecipeRegistry';
import { LOOT_TABLES, type LootTable } from './lootTables';
import { ENEMIES } from './enemies';
import { BOSSES } from './bosses';
import { NPCS } from './npcs';
import { TileRegistry } from '../world/TileRegistry';

export interface ObtainSources {
  /** Tile ids that exist in generated worlds or appear through gameplay. */
  naturalTiles: Set<number>;
  naturalWalls: Set<number>;
  startingKit: string[];
  /** Other gameplay sources (e.g. tree felling drops). */
  extra?: string[];
}

const tableItems = (t: LootTable | undefined) => (t ? [...(t.always ?? []), ...(t.pools ?? []).flatMap((p) => p.entries)].map((e) => e.item).concat(t.aurels ? ['aurel'] : []) : []);

export function obtainableItems(src: ObtainSources): { obtainable: Set<string>; how: Map<string, string> } {
  const got = new Set<string>();
  const how = new Map<string, string>();
  const add = (id: string, why: string) => {
    if (!got.has(id)) {
      got.add(id);
      how.set(id, why);
      return true;
    }
    return false;
  };
  for (const id of src.startingKit) add(id, 'starting kit');
  for (const id of src.extra ?? []) add(id, 'gameplay (tree felling etc.)');
  add('aurel', 'currency');
  for (const t of src.naturalTiles) {
    const d = TileRegistry.get(t);
    if (d.drop) add(d.drop, `mined from ${d.name}`);
  }
  for (const w of src.naturalWalls) {
    const d = TileRegistry.wall(w);
    if (d.drop) add(d.drop, `hammered from ${d.name}`);
  }
  for (const [id, t] of Object.entries(LOOT_TABLES)) if (id.startsWith('chest_') || id.startsWith('pot_')) for (const i of tableItems(t)) add(i, `loot: ${id}`);
  for (const e of ENEMIES) if (e.spawn.length) for (const i of tableItems(LOOT_TABLES[e.loot])) add(i, `dropped by ${e.name}`);
  for (const n of NPCS) for (const s of n.shop) add(s.item, `sold by the ${n.role}`);
  const stationItem = new Map<string, string[]>();
  for (const t of TileRegistry.defs) {
    if (!t?.station) continue;
    const items = ItemRegistry.all().filter((i) => i.placeTile === t.key).map((i) => i.id);
    stationItem.set(t.station, [...(stationItem.get(t.station) ?? []), ...items]);
  }
  // Fixed point over recipes, boss drops and buckets.
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of RecipeRegistry.recipes) {
      if (got.has(r.out)) continue;
      if (r.station && !(stationItem.get(r.station) ?? []).some((i) => got.has(i))) continue;
      if (!r.ing.every(([i]) => got.has(i))) continue;
      changed = add(r.out, `crafted${r.station ? ` at ${r.station}` : ' by hand'}`) || changed;
    }
    for (const b of BOSSES) {
      if (!got.has(b.summonItem)) continue;
      for (const i of tableItems(LOOT_TABLES[b.loot])) changed = add(i, `dropped by ${b.name}`) || changed;
    }
    // Boss adds only exist during their boss fight.
    for (const e of ENEMIES) {
      if (e.spawn.length) continue;
      for (const i of tableItems(LOOT_TABLES[e.loot])) changed = add(i, `dropped by ${e.name}`) || changed;
    }
    if (got.has('bucket')) {
      changed = add('water_bucket', 'bucket + water') || changed;
      changed = add('lava_bucket', 'bucket + magma') || changed;
    }
  }
  return { obtainable: got, how };
}

export function unobtainableItems(src: ObtainSources): string[] {
  const { obtainable } = obtainableItems(src);
  return ItemRegistry.all().filter((i) => !i.cheat).map((i) => i.id).filter((id) => !obtainable.has(id));
}
