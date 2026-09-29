import { describe, it, expect } from 'vitest';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { RecipeRegistry } from '../src/crafting/RecipeRegistry';
import { canCraft, craft, listRecipes, maxCrafts } from '../src/crafting/CraftingSystem';
import { ItemContainer } from '../src/inventory/ItemContainer';
import { LOOT_TABLES } from '../src/data/lootTables';
import { rollLootTable } from '../src/systems/LootSystem';
import { Rng } from '../src/utils/random';
import { ENEMIES } from '../src/data/enemies';
import { BOSSES } from '../src/data/bosses';
import { NPCS } from '../src/data/npcs';
import { TILE_DEFS } from '../src/data/tiles';
import { BIOMES } from '../src/data/biomes';
import { BUFF_MAP } from '../src/data/buffs';
import { rollDamage, applyReduction, fallDamage, knockbackVelocity } from '../src/combat/damage';
import { ProgressionSystem } from '../src/systems/ProgressionSystem';
import { EventBus } from '../src/core/EventBus';
import { LOADOUTS } from '../src/ui/panels/CreativePanel';
import type { GameEvents } from '../src/core/context';

describe('content integrity', () => {
  it('has no content validation problems', () => {
    expect(ItemRegistry.problems).toEqual([]);
    expect(RecipeRegistry.problems).toEqual([]);
  });

  it('meets the content targets', () => {
    const items = ItemRegistry.all();
    expect(TILE_DEFS.length).toBeGreaterThanOrEqual(40);
    expect(items.length).toBeGreaterThanOrEqual(75);
    expect(items.filter((i) => i.weapon && i.category !== 'tool').length).toBeGreaterThanOrEqual(15);
    expect(new Set(items.filter((i) => i.armor).map((i) => i.armor!.set)).size).toBeGreaterThanOrEqual(8);
    expect(items.filter((i) => i.category === 'accessory').length).toBeGreaterThanOrEqual(10);
    expect(items.filter((i) => i.category === 'consumable').length).toBeGreaterThanOrEqual(10);
    expect(RecipeRegistry.recipes.length).toBeGreaterThanOrEqual(100);
    expect(ENEMIES.filter((e) => e.spawn.length).length).toBeGreaterThanOrEqual(15);
    expect(BOSSES.length).toBeGreaterThanOrEqual(5);
    expect(NPCS.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(BIOMES).length).toBeGreaterThanOrEqual(6);
  });

  it('references only existing items in loot tables and shops', () => {
    for (const [id, t] of Object.entries(LOOT_TABLES)) {
      for (const e of [...(t.always ?? []), ...(t.pools ?? []).flatMap((p) => p.entries)]) expect(ItemRegistry.has(e.item), `${id}: ${e.item}`).toBe(true);
    }
    for (const n of NPCS) for (const s of n.shop) expect(ItemRegistry.has(s.item), `${n.id}: ${s.item}`).toBe(true);
    for (const e of ENEMIES) expect(e.loot in LOOT_TABLES, e.id).toBe(true);
    for (const b of BOSSES) {
      expect(b.loot in LOOT_TABLES).toBe(true);
      expect(ItemRegistry.has(b.summonItem)).toBe(true);
    }
    for (const i of ItemRegistry.all()) for (const b of i.consumable?.buffs ?? []) expect(BUFF_MAP.has(b.id), `${i.id}: ${b.id}`).toBe(true);
  });

  it('every boss summon item and progression material is obtainable by crafting or loot', () => {
    const craftable = new Set(RecipeRegistry.recipes.map((r) => r.out));
    const lootable = new Set(Object.values(LOOT_TABLES).flatMap((t) => [...(t.always ?? []), ...(t.pools ?? []).flatMap((p) => p.entries)]).map((e) => e.item));
    for (const b of BOSSES) expect(craftable.has(b.summonItem) || lootable.has(b.summonItem), b.summonItem).toBe(true);
  });
});

describe('creative loadouts', () => {
  it('reference only real items and complete armour sets', () => {
    for (const l of LOADOUTS) {
      for (const slot of ['head', 'body', 'legs']) expect(ItemRegistry.get(`${l.armor}_${slot}`).armor?.slot, `${l.label} ${slot}`).toBe(slot);
      for (const [id] of l.items) expect(ItemRegistry.has(id), `${l.label}: ${id}`).toBe(true);
      for (const id of l.accessories) expect(ItemRegistry.get(id).category, `${l.label}: ${id}`).toBe('accessory');
      expect(new Set(l.accessories).size).toBe(l.accessories.length);
    }
  });
});

describe('crafting', () => {
  const byOut = (id: string) => RecipeRegistry.forOutput(id)[0];

  it('crafts a workbench by hand from wood', () => {
    const inv = new ItemContainer(10);
    inv.add({ id: 'wood', count: 25 });
    const r = byOut('workbench');
    expect(r.station).toBeUndefined();
    expect(canCraft(r, [inv])).toBe(true);
    expect(maxCrafts(r, [inv])).toBe(2);
    expect(craft(r, [inv])).toEqual({ id: 'workbench', count: 1 });
    expect(inv.count('wood')).toBe(15);
  });

  it('requires stations and progression flags', () => {
    const inv = new ItemContainer(10);
    inv.add({ id: 'brasslite_ore', count: 30 });
    const none = listRecipes(new Set(), new Set(), [inv]).map((x) => x.recipe.out);
    expect(none).not.toContain('brasslite_bar');
    const withFurnace = listRecipes(new Set(['furnace']), new Set(), [inv]);
    expect(withFurnace.find((x) => x.recipe.out === 'brasslite_bar')?.craftable).toBe(true);
    const gated = listRecipes(new Set(['anvil']), new Set(), [inv]).map((x) => x.recipe.out);
    expect(gated).not.toContain('gravelcrusher');
    const unlocked = listRecipes(new Set(['anvil']), new Set(['boss:gravelmaw']), [inv]).map((x) => x.recipe.out);
    expect(unlocked).toContain('gravelcrusher');
  });

  it('refuses to craft without ingredients and leaves inventory untouched', () => {
    const inv = new ItemContainer(4);
    inv.add({ id: 'wood', count: 3 });
    expect(craft(byOut('workbench'), [inv])).toBeNull();
    expect(inv.count('wood')).toBe(3);
  });
});

describe('loot', () => {
  it('rolls deterministically for a seed and respects flags', () => {
    const a = rollLootTable('boss_gravelmaw', new Rng(5));
    const b = rollLootTable('boss_gravelmaw', new Rng(5));
    expect(a).toEqual(b);
    expect(a.some((s) => s.id === 'chitin_plate')).toBe(true);
    expect(a.some((s) => s.id === 'aurel')).toBe(true);
    // brimstone chalice requires 'unsealed'
    let seen = false;
    for (let i = 0; i < 2000 && !seen; i++) seen = rollLootTable('e_cinder_imp', new Rng(i)).some((s) => s.id === 'brimstone_chalice');
    expect(seen).toBe(false);
    for (let i = 0; i < 4000 && !seen; i++) seen = rollLootTable('e_cinder_imp', new Rng(i), { flags: new Set(['unsealed']) }).some((s) => s.id === 'brimstone_chalice');
    expect(seen).toBe(true);
  });

  it('returns an empty list for unknown tables', () => {
    expect(rollLootTable('nope', new Rng(1))).toEqual([]);
  });

  it('pool picks avoid duplicate unique rewards', () => {
    for (let i = 0; i < 200; i++) {
      const out = rollLootTable('boss_obelisk', new Rng(i));
      const weapons = out.filter((s) => ['shardrepeater', 'shardcaller', 'prismatic_staff'].includes(s.id));
      expect(weapons.length).toBe(1);
    }
  });
});

describe('damage', () => {
  const fixed = (v: number) => () => v;
  it('applies defense, bonus and crits', () => {
    expect(rollDamage(20, 0, 0, 10, fixed(0.5)).amount).toBe(15);
    expect(rollDamage(20, 0.5, 0, 0, fixed(0.5)).amount).toBe(30);
    const crit = rollDamage(20, 0, 100, 0, fixed(0.5));
    expect(crit.crit).toBe(true);
    expect(crit.amount).toBe(40);
    expect(rollDamage(1, 0, 0, 100, fixed(0.5)).amount).toBe(1);
  });
  it('reduces, knocks back and computes fall damage', () => {
    expect(applyReduction(100, 0.25)).toBe(75);
    expect(applyReduction(100, 5)).toBe(20);
    expect(knockbackVelocity(10, 1)).toBe(0);
    expect(fallDamage(20, 25)).toBe(0);
    expect(fallDamage(30, 25)).toBe(40);
  });
});

describe('progression', () => {
  it('records boss kills and emits flag events once', () => {
    const bus = new EventBus<GameEvents>();
    const seen: string[] = [];
    bus.on('flagSet', (e) => seen.push(e.flag));
    const p = new ProgressionSystem(bus);
    expect(p.recordBossKill('gravelmaw')).toBe(true);
    expect(p.recordBossKill('gravelmaw')).toBe(false);
    expect(p.bossKills.gravelmaw).toBe(2);
    expect(p.bossesDefeated()).toBe(1);
    expect(seen).toEqual(['boss:gravelmaw']);
  });
});
