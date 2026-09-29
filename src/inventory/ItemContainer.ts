import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemDef } from '../items/types';
import type { ItemStack, Slot } from '../items/ItemStack';

const CATEGORY_ORDER: ItemDef['category'][] = [
  'tool', 'melee', 'ranged', 'magic', 'summon', 'ammo', 'armor', 'accessory', 'consumable', 'bossSummon', 'utility',
  'furniture', 'block', 'wall', 'material', 'currency',
];

export type SlotFilter = (index: number, def: ItemDef) => boolean;

/**
 * A fixed-size array of item slots with stacking logic. Used for the player
 * inventory, equipment, chests, the trash slot and shop buyback.
 */
export class ItemContainer {
  readonly slots: Slot[];
  /** Incremented on every change so UI can cheaply detect updates. */
  version = 0;

  constructor(
    size: number,
    readonly filter?: SlotFilter,
    readonly maxPerSlot?: number,
  ) {
    this.slots = new Array<Slot>(size).fill(null);
  }

  get size(): number {
    return this.slots.length;
  }

  changed(): void {
    this.version++;
  }

  accepts(index: number, id: string): boolean {
    if (!this.filter) return true;
    const def = ItemRegistry.tryGet(id);
    return !!def && this.filter(index, def);
  }

  stackLimit(id: string): number {
    const max = ItemRegistry.get(id).maxStack;
    return this.maxPerSlot ? Math.min(max, this.maxPerSlot) : max;
  }

  get(i: number): Slot {
    return this.slots[i] ?? null;
  }

  set(i: number, s: Slot): void {
    this.slots[i] = s && s.count > 0 ? s : null;
    this.changed();
  }

  /**
   * Add a stack, filling partial stacks first and then empty slots.
   * Returns the number of items that did NOT fit.
   */
  add(stack: ItemStack, range: [number, number] = [0, this.size]): number {
    let left = stack.count;
    const limit = this.stackLimit(stack.id);
    for (let i = range[0]; i < range[1] && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === stack.id && s.count < limit) {
        const n = Math.min(left, limit - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (let i = range[0]; i < range[1] && left > 0; i++) {
      if (!this.slots[i] && this.accepts(i, stack.id)) {
        const n = Math.min(left, limit);
        this.slots[i] = { id: stack.id, count: n };
        left -= n;
      }
    }
    if (left !== stack.count) this.changed();
    return left;
  }

  /** How many of `id` could be added. */
  roomFor(id: string): number {
    const limit = this.stackLimit(id);
    let room = 0;
    this.slots.forEach((s, i) => {
      if (!s) room += this.accepts(i, id) ? limit : 0;
      else if (s.id === id) room += Math.max(0, limit - s.count);
    });
    return room;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  has(id: string, n = 1): boolean {
    return this.count(id) >= n;
  }

  /** Remove up to n of an item, taking from the last slots first. Returns removed amount. */
  remove(id: string, n: number): number {
    let left = n;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(left, s.count);
        s.count -= take;
        left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    if (left !== n) this.changed();
    return n - left;
  }

  /** Remove `n` from a specific slot. */
  takeFromSlot(i: number, n: number): ItemStack | null {
    const s = this.slots[i];
    if (!s) return null;
    const take = Math.min(n, s.count);
    s.count -= take;
    if (s.count <= 0) this.slots[i] = null;
    this.changed();
    return { id: s.id, count: take };
  }

  isEmpty(): boolean {
    return this.slots.every((s) => !s);
  }

  /** Sort a range: merge stacks then order by category, rarity (desc) and name. */
  sort(range: [number, number] = [0, this.size]): void {
    const items: ItemStack[] = [];
    for (let i = range[0]; i < range[1]; i++) {
      const s = this.slots[i];
      if (s) items.push(s);
      this.slots[i] = null;
    }
    const merged = new Map<string, number>();
    for (const s of items) merged.set(s.id, (merged.get(s.id) ?? 0) + s.count);
    const ids = [...merged.keys()].sort((a, b) => {
      const da = ItemRegistry.get(a);
      const db = ItemRegistry.get(b);
      const ca = CATEGORY_ORDER.indexOf(da.category);
      const cb = CATEGORY_ORDER.indexOf(db.category);
      if (ca !== cb) return ca - cb;
      if (da.rarity !== db.rarity) return db.rarity - da.rarity;
      return da.name.localeCompare(db.name);
    });
    let i = range[0];
    for (const id of ids) {
      let n = merged.get(id)!;
      const limit = this.stackLimit(id);
      while (n > 0 && i < range[1]) {
        const c = Math.min(n, limit);
        this.slots[i++] = { id, count: c };
        n -= c;
      }
    }
    this.changed();
  }

  /** Move stacks of items that already exist in `target` into it. */
  quickStackInto(target: ItemContainer, range: [number, number] = [0, this.size]): number {
    let moved = 0;
    for (let i = range[0]; i < range[1]; i++) {
      const s = this.slots[i];
      if (!s || !target.has(s.id)) continue;
      const left = target.add({ id: s.id, count: s.count });
      moved += s.count - left;
      s.count = left;
      if (s.count <= 0) this.slots[i] = null;
    }
    if (moved) this.changed();
    return moved;
  }

  /** Move everything possible into target. */
  depositAll(target: ItemContainer, range: [number, number] = [0, this.size]): void {
    for (let i = range[0]; i < range[1]; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const left = target.add({ ...s });
      if (left === 0) this.slots[i] = null;
      else s.count = left;
    }
    this.changed();
  }

  serialize(): Slot[] {
    return this.slots.map((s) => (s ? { id: s.id, count: s.count } : null));
  }

  /** Load saved slots, dropping malformed entries and unknown items. */
  load(data: unknown): void {
    this.slots.fill(null);
    if (!Array.isArray(data)) return;
    for (let i = 0; i < Math.min(data.length, this.size); i++) {
      const d = data[i] as Partial<ItemStack> | null;
      if (d && typeof d.id === 'string' && typeof d.count === 'number' && d.count > 0 && ItemRegistry.has(d.id)) {
        this.slots[i] = { id: d.id, count: Math.min(Math.floor(d.count), ItemRegistry.get(d.id).maxStack) };
      }
    }
    this.changed();
  }
}
