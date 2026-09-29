/** A stack of items. Item ids are string keys from the item registry. */
export interface ItemStack {
  id: string;
  count: number;
}

export type Slot = ItemStack | null;

export function cloneStack(s: Slot): Slot {
  return s ? { id: s.id, count: s.count } : null;
}
