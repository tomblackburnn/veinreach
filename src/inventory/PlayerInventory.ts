import { ItemContainer } from './ItemContainer';
import { ItemRegistry } from '../items/ItemRegistry';
import type { ItemStack } from '../items/ItemStack';

export const HOTBAR_SIZE = 10;
export const MAIN_SIZE = 50; // 10 hotbar + 40 backpack
export const ACCESSORY_SLOTS = 5;
export const AMMO_SLOTS = 4;
const ARMOR_ORDER = ['head', 'body', 'legs'] as const;

/** All of the player's item storage plus the aurel wallet. */
export class PlayerInventory {
  readonly main = new ItemContainer(MAIN_SIZE);
  readonly armor = new ItemContainer(3, (i, def) => def.armor?.slot === ARMOR_ORDER[i], 1);
  readonly accessories = new ItemContainer(ACCESSORY_SLOTS, (i, def) => def.category === 'accessory' && !this.accessories.slots.some((s, j) => j !== i && s?.id === def.id), 1);
  readonly ammo = new ItemContainer(AMMO_SLOTS, (_i, def) => def.category === 'ammo');
  readonly trash = new ItemContainer(1);
  wallet = 0;
  selected = 0;

  /** Add picked-up items. Currency goes to the wallet; ammo prefers ammo slots. Returns leftover. */
  give(stack: ItemStack): number {
    if (!ItemRegistry.has(stack.id)) return 0;
    if (stack.id === 'aurel') {
      this.wallet += stack.count;
      return 0;
    }
    const def = ItemRegistry.get(stack.id);
    let left = stack.count;
    if (def.category === 'ammo' && this.ammo.has(stack.id)) left = this.ammo.add({ id: stack.id, count: left });
    if (left > 0) left = this.main.add({ id: stack.id, count: left });
    return left;
  }

  canFit(stack: ItemStack): boolean {
    if (stack.id === 'aurel') return true;
    return this.main.roomFor(stack.id) + (ItemRegistry.get(stack.id).category === 'ammo' ? this.ammo.roomFor(stack.id) : 0) > 0;
  }

  heldItem() {
    return this.main.get(this.selected);
  }

  count(id: string): number {
    return this.main.count(id) + (ItemRegistry.get(id).category === 'ammo' ? this.ammo.count(id) : 0);
  }

  /** Remove from main inventory (and ammo slots for ammo). */
  consume(id: string, n = 1): boolean {
    if (this.count(id) < n) return false;
    let left = n;
    if (ItemRegistry.get(id).category === 'ammo') left -= this.ammo.remove(id, left);
    if (left > 0) this.main.remove(id, left);
    return true;
  }

  /** First usable ammo of a type: ammo slots first, then main inventory. */
  findAmmo(type: string): string | null {
    for (const c of [this.ammo, this.main]) {
      for (const s of c.slots) {
        if (!s) continue;
        const def = ItemRegistry.get(s.id);
        if (def.ammo?.type === type) return s.id;
      }
    }
    return null;
  }

  equippedIds(): string[] {
    const out: string[] = [];
    for (const s of this.armor.slots) if (s) out.push(s.id);
    for (const s of this.accessories.slots) if (s) out.push(s.id);
    return out;
  }

  /** Try to equip armour/accessory from a main slot (swapping out what was there). */
  quickEquip(mainIndex: number): boolean {
    const s = this.main.get(mainIndex);
    if (!s) return false;
    const def = ItemRegistry.get(s.id);
    if (def.armor) {
      const i = ARMOR_ORDER.indexOf(def.armor.slot);
      const prev = this.armor.get(i);
      this.armor.set(i, { id: s.id, count: 1 });
      this.main.set(mainIndex, prev);
      return true;
    }
    if (def.category === 'accessory') {
      if (this.accessories.slots.some((a) => a?.id === s.id)) return false;
      let i = this.accessories.slots.findIndex((a) => !a);
      if (i < 0) i = 0;
      const prev = this.accessories.get(i);
      this.accessories.set(i, { id: s.id, count: 1 });
      this.main.set(mainIndex, prev);
      return true;
    }
    return false;
  }

  serialize() {
    return {
      main: this.main.serialize(),
      armor: this.armor.serialize(),
      accessories: this.accessories.serialize(),
      ammo: this.ammo.serialize(),
      trash: this.trash.serialize(),
      wallet: this.wallet,
      selected: this.selected,
    };
  }

  load(d: Partial<ReturnType<PlayerInventory['serialize']>> | undefined): void {
    if (!d) return;
    this.main.load(d.main);
    this.armor.load(d.armor);
    this.accessories.load(d.accessories);
    this.ammo.load(d.ammo);
    this.trash.load(d.trash);
    this.wallet = typeof d.wallet === 'number' && d.wallet >= 0 ? Math.floor(d.wallet) : 0;
    this.selected = typeof d.selected === 'number' ? Math.max(0, Math.min(HOTBAR_SIZE - 1, d.selected)) : 0;
  }
}
