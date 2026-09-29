import type { ItemContainer } from './ItemContainer';
import type { Slot } from '../items/ItemStack';

/**
 * Mouse-cursor item transfer rules (drag & drop via click-to-pick-up).
 * Pure functions over containers so they can be unit-tested.
 */
export interface Cursor {
  stack: Slot;
}

/** Left click: pick up, place, merge or swap. */
export function leftClickSlot(c: ItemContainer, i: number, cursor: Cursor): void {
  const slot = c.get(i);
  const held = cursor.stack;
  if (!held) {
    if (slot) {
      cursor.stack = slot;
      c.set(i, null);
    }
    return;
  }
  if (!c.accepts(i, held.id)) return;
  if (!slot) {
    const limit = c.stackLimit(held.id);
    if (held.count <= limit) {
      c.set(i, held);
      cursor.stack = null;
    } else {
      c.set(i, { id: held.id, count: limit });
      held.count -= limit;
    }
    return;
  }
  if (slot.id === held.id) {
    const limit = c.stackLimit(slot.id);
    const n = Math.min(held.count, limit - slot.count);
    slot.count += n;
    held.count -= n;
    if (held.count <= 0) cursor.stack = null;
    c.changed();
    return;
  }
  // Swap (only if the held stack fits in one slot).
  if (held.count <= c.stackLimit(held.id)) {
    c.set(i, held);
    cursor.stack = slot;
  }
}

/** Right click: split half of a stack onto the cursor, or place a single item. */
export function rightClickSlot(c: ItemContainer, i: number, cursor: Cursor): void {
  const slot = c.get(i);
  const held = cursor.stack;
  if (!held) {
    if (!slot) return;
    const half = Math.ceil(slot.count / 2);
    cursor.stack = c.takeFromSlot(i, half);
    return;
  }
  if (!c.accepts(i, held.id)) return;
  if (!slot) {
    c.set(i, { id: held.id, count: 1 });
  } else if (slot.id === held.id && slot.count < c.stackLimit(slot.id)) {
    slot.count++;
    c.changed();
  } else {
    return;
  }
  held.count--;
  if (held.count <= 0) cursor.stack = null;
}

/** Shift-click: move a whole stack to the first container that accepts it. */
export function shiftClickSlot(from: ItemContainer, i: number, targets: { c: ItemContainer; range?: [number, number] }[]): boolean {
  const slot = from.get(i);
  if (!slot) return false;
  let left = slot.count;
  for (const t of targets) {
    if (left <= 0) break;
    left = t.c.add({ id: slot.id, count: left }, t.range);
  }
  if (left === slot.count) return false;
  from.set(i, left > 0 ? { id: slot.id, count: left } : null);
  return true;
}
