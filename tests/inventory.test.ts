import { describe, it, expect } from 'vitest';
import { ItemContainer } from '../src/inventory/ItemContainer';
import { leftClickSlot, rightClickSlot, shiftClickSlot, type Cursor } from '../src/inventory/transfer';
import { PlayerInventory } from '../src/inventory/PlayerInventory';

describe('ItemContainer', () => {
  it('stacks into existing stacks before empty slots', () => {
    const c = new ItemContainer(5);
    c.set(3, { id: 'loam', count: 990 });
    expect(c.add({ id: 'loam', count: 20 })).toBe(0);
    expect(c.get(3)!.count).toBe(999);
    expect(c.get(0)!.count).toBe(11);
  });

  it('respects max stack and reports leftovers', () => {
    const c = new ItemContainer(2);
    expect(c.add({ id: 'brasslite_pickaxe', count: 3 })).toBe(1);
    expect(c.count('brasslite_pickaxe')).toBe(2);
  });

  it('removes from the end and counts correctly', () => {
    const c = new ItemContainer(4);
    c.set(0, { id: 'torch', count: 5 });
    c.set(2, { id: 'torch', count: 5 });
    expect(c.remove('torch', 7)).toBe(7);
    expect(c.count('torch')).toBe(3);
    expect(c.get(2)).toBeNull();
  });

  it('sorts by category and merges stacks', () => {
    const c = new ItemContainer(6);
    c.set(0, { id: 'loam', count: 10 });
    c.set(1, { id: 'brasslite_blade', count: 1 });
    c.set(2, { id: 'loam', count: 5 });
    c.set(4, { id: 'lesser_mending', count: 2 });
    c.sort();
    expect(c.get(0)!.id).toBe('brasslite_blade');
    expect(c.get(1)!.id).toBe('lesser_mending');
    expect(c.get(2)).toEqual({ id: 'loam', count: 15 });
    expect(c.get(3)).toBeNull();
  });

  it('quick-stacks only matching items', () => {
    const a = new ItemContainer(3);
    const b = new ItemContainer(3);
    a.set(0, { id: 'loam', count: 10 });
    a.set(1, { id: 'stone', count: 10 });
    b.set(0, { id: 'stone', count: 1 });
    expect(a.quickStackInto(b)).toBe(10);
    expect(b.count('stone')).toBe(11);
    expect(a.count('loam')).toBe(10);
  });

  it('filters slots (armour slots only accept matching armour)', () => {
    const inv = new PlayerInventory();
    expect(inv.armor.accepts(0, 'brasslite_head')).toBe(true);
    expect(inv.armor.accepts(0, 'brasslite_body')).toBe(false);
    expect(inv.accessories.accepts(0, 'loam')).toBe(false);
  });

  it('ignores unknown items when loading', () => {
    const c = new ItemContainer(3);
    c.load([{ id: 'does_not_exist', count: 3 }, { id: 'loam', count: 5 }, 'garbage']);
    expect(c.get(0)).toBeNull();
    expect(c.get(1)).toEqual({ id: 'loam', count: 5 });
  });
});

describe('cursor transfers', () => {
  it('picks up, places, merges and swaps', () => {
    const c = new ItemContainer(3);
    const cur: Cursor = { stack: null };
    c.set(0, { id: 'loam', count: 10 });
    c.set(1, { id: 'loam', count: 5 });
    c.set(2, { id: 'stone', count: 1 });
    leftClickSlot(c, 0, cur);
    expect(cur.stack).toEqual({ id: 'loam', count: 10 });
    leftClickSlot(c, 1, cur);
    expect(c.get(1)!.count).toBe(15);
    expect(cur.stack).toBeNull();
    leftClickSlot(c, 2, cur);
    leftClickSlot(c, 1, cur);
    expect(c.get(1)!.id).toBe('stone');
    expect(cur.stack!.id).toBe('loam');
  });

  it('right click splits half and places singles', () => {
    const c = new ItemContainer(2);
    const cur: Cursor = { stack: null };
    c.set(0, { id: 'torch', count: 9 });
    rightClickSlot(c, 0, cur);
    expect(cur.stack!.count).toBe(5);
    expect(c.get(0)!.count).toBe(4);
    rightClickSlot(c, 1, cur);
    expect(c.get(1)!.count).toBe(1);
    expect(cur.stack!.count).toBe(4);
  });

  it('shift click moves whole stacks to targets', () => {
    const a = new ItemContainer(2);
    const b = new ItemContainer(2);
    a.set(0, { id: 'loam', count: 40 });
    expect(shiftClickSlot(a, 0, [{ c: b }])).toBe(true);
    expect(a.get(0)).toBeNull();
    expect(b.count('loam')).toBe(40);
  });
});

describe('PlayerInventory', () => {
  it('sends aurels to the wallet and ammo to ammo slots', () => {
    const inv = new PlayerInventory();
    inv.give({ id: 'aurel', count: 150 });
    expect(inv.wallet).toBe(150);
    inv.ammo.set(0, { id: 'wooden_arrow', count: 5 });
    inv.give({ id: 'wooden_arrow', count: 10 });
    expect(inv.ammo.count('wooden_arrow')).toBe(15);
    expect(inv.findAmmo('arrow')).toBe('wooden_arrow');
    expect(inv.consume('wooden_arrow', 15)).toBe(true);
    expect(inv.findAmmo('arrow')).toBeNull();
  });

  it('quick-equips armour and accessories, swapping', () => {
    const inv = new PlayerInventory();
    inv.main.set(12, { id: 'ferrocite_head', count: 1 });
    inv.armor.set(0, { id: 'brasslite_head', count: 1 });
    expect(inv.quickEquip(12)).toBe(true);
    expect(inv.armor.get(0)!.id).toBe('ferrocite_head');
    expect(inv.main.get(12)!.id).toBe('brasslite_head');
    inv.main.set(13, { id: 'zephyr_charm', count: 1 });
    expect(inv.quickEquip(13)).toBe(true);
    inv.main.set(14, { id: 'zephyr_charm', count: 1 });
    expect(inv.quickEquip(14)).toBe(false); // duplicate accessories not allowed
  });

  it('round-trips through serialize/load', () => {
    const inv = new PlayerInventory();
    inv.main.set(0, { id: 'torch', count: 33 });
    inv.wallet = 1234;
    inv.selected = 4;
    const other = new PlayerInventory();
    other.load(JSON.parse(JSON.stringify(inv.serialize())));
    expect(other.main.get(0)).toEqual({ id: 'torch', count: 33 });
    expect(other.wallet).toBe(1234);
    expect(other.selected).toBe(4);
  });
});
