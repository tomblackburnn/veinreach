import { LOOT_TABLES, type LootEntry } from '../data/lootTables';
import type { ItemStack } from '../items/ItemStack';
import type { Rng } from '../utils/random';

export interface LootContext {
  /** World progression flags for conditional entries. */
  flags?: ReadonlySet<string>;
  /** Multiplier on chance-based drops (luck, events). */
  luck?: number;
}

function entryAllowed(e: LootEntry, ctx: LootContext): boolean {
  if (e.requires && !ctx.flags?.has(e.requires)) return false;
  if (e.excludes && ctx.flags?.has(e.excludes)) return false;
  return true;
}

function rollCount(e: LootEntry, rng: Rng): number {
  const min = e.min ?? 1;
  const max = e.max ?? min;
  return rng.int(min, Math.max(min, max));
}

/** Merge stacks of the same item so loot doesn't fragment. */
function merge(stacks: ItemStack[]): ItemStack[] {
  const out: ItemStack[] = [];
  for (const s of stacks) {
    const same = out.find((o) => o.id === s.id);
    if (same) same.count += s.count;
    else out.push({ ...s });
  }
  return out;
}

/**
 * Roll a loot table. Unknown table ids return [] (and warn once) rather than
 * throwing, so bad content never crashes the game.
 */
export function rollLootTable(tableId: string, rng: Rng, ctx: LootContext = {}): ItemStack[] {
  const table = LOOT_TABLES[tableId];
  if (!table) {
    console.warn(`[Loot] unknown table ${tableId}`);
    return [];
  }
  const luck = ctx.luck ?? 1;
  const out: ItemStack[] = [];
  for (const e of table.always ?? []) {
    if (!entryAllowed(e, ctx)) continue;
    if (rng.next() < Math.min(1, (e.chance ?? 1) * luck)) out.push({ id: e.item, count: rollCount(e, rng) });
  }
  for (const pool of table.pools ?? []) {
    const n = rng.int(pool.count[0], pool.count[1]);
    const available = pool.entries.filter((e) => entryAllowed(e, ctx));
    for (let i = 0; i < n && available.length; i++) {
      const e = rng.weighted(available, (x) => x.weight ?? 1);
      if (!e) break;
      out.push({ id: e.item, count: rollCount(e, rng) });
      // Avoid duplicates of unique rewards within a pool roll.
      if ((e.max ?? 1) === 1 && (e.min ?? 1) === 1) available.splice(available.indexOf(e), 1);
    }
  }
  if (table.aurels) out.push({ id: 'aurel', count: rng.int(table.aurels[0], table.aurels[1]) });
  return merge(out.filter((s) => s.count > 0));
}

export function lootTableExists(id: string): boolean {
  return id in LOOT_TABLES;
}
