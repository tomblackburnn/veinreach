import { describe, it, expect, beforeAll } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import type { World } from '../src/world/World';

let world: World;
let spawn: [number, number];
beforeAll(() => {
  const g = generateWorldSync({ name: 'use', seed: 'item-use', width: 500, height: 280 });
  world = g.world;
  spawn = [g.spawnX, g.spawnY];
});

function setup(item: string, extra: [string, number][] = []) {
  const ctx = new SimContext(world);
  ctx.player.teleportTo(ctx, spawn[0], spawn[1]);
  ctx.step(30);
  ctx.player.inventory.main.set(0, { id: item, count: 1 });
  for (const [id, n] of extra) ctx.player.inventory.give({ id, count: n });
  ctx.player.inventory.selected = 0;
  return ctx;
}

function useAt(ctx: SimContext, x: number, y: number, ticks: number) {
  for (let i = 0; i < ticks; i++) {
    ctx.nextInput = { use: true, usePressed: i === 0, aimX: x, aimY: y };
    ctx.step(1);
  }
  ctx.nextInput = {};
}

describe('item use', () => {
  it('bows fire arrows, consume ammo and damage enemies', () => {
    const ctx = setup('timber_bow', [['wooden_arrow', 20]]);
    const p = ctx.player;
    const fired: string[] = [];
    const orig = ctx.spawnProjectile.bind(ctx);
    ctx.spawnProjectile = (id, ...rest) => (fired.push(id), orig(id, ...rest));
    // A training dummy in open air in front of the player.
    const e = ctx.spawnEnemy('duskwing', p.cx + 70, p.y - 30)!;
    e.despawnable = false;
    e.update = () => undefined;
    const life = e.life;
    for (let k = 0; k < 4 && !e.dead && e.life === life; k++) useAt(ctx, e.cx, e.cy - 4, 40);
    expect(fired.filter((f) => f === 'arrow_wood').length).toBeGreaterThan(0);
    expect(p.inventory.count('wooden_arrow')).toBeLessThan(20);
    ctx.step(30);
    expect(e.life < life || e.dead).toBe(true);
  });

  it('refuses to fire without ammo', () => {
    const ctx = setup('timber_bow');
    useAt(ctx, ctx.player.cx + 100, ctx.player.cy, 30);
    expect(ctx.entities.projectiles.length).toBe(0);
    expect(ctx.messages.some((m) => /Out of arrows/.test(m))).toBe(true);
  });

  it('magic weapons spend mana and stop when empty', () => {
    const ctx = setup('apprentice_wand');
    const p = ctx.player;
    const fired: string[] = [];
    const orig = ctx.spawnProjectile.bind(ctx);
    ctx.spawnProjectile = (id, ...rest) => (fired.push(id), orig(id, ...rest));
    const mana0 = p.mana;
    useAt(ctx, p.cx + 100, p.cy - 60, 30);
    expect(p.mana).toBeLessThan(mana0);
    expect(fired).toContain('spark');
    p.mana = 0;
    const before = ctx.entities.projectiles.length;
    useAt(ctx, p.cx + 100, p.cy, 2);
    expect(ctx.entities.projectiles.length).toBeLessThanOrEqual(before);
  });

  it('summon weapons create a persistent minion limited by slots', () => {
    const ctx = setup('wisp_rod');
    const p = ctx.player;
    for (let k = 0; k < 3; k++) {
      p.mana = p.maxMana;
      useAt(ctx, p.cx + 40, p.cy - 40, 40);
    }
    ctx.step(200);
    expect(ctx.entities.projectiles.filter((pr) => pr.def.behavior === 'minion').length).toBe(1);
  });

  it('melee swings hit enemies in the arc', () => {
    const ctx = setup('ferrocite_broadsword');
    const p = ctx.player;
    const e = ctx.spawnEnemy('husk', p.cx + 30, p.bottom)!;
    const life = e.life;
    useAt(ctx, e.cx, e.cy, 25);
    expect(e.life).toBeLessThan(life);
  });

  it('healing draughts heal and apply draught sickness', () => {
    const ctx = setup('lesser_mending');
    const p = ctx.player;
    p.inventory.main.set(0, { id: 'lesser_mending', count: 2 });
    p.life = 20;
    useAt(ctx, p.cx, p.cy, 20);
    expect(p.life).toBeGreaterThanOrEqual(70);
    expect(p.buffs.has('potion_sickness')).toBe(true);
    const count = p.inventory.count('lesser_mending');
    useAt(ctx, p.cx, p.cy, 20);
    expect(p.inventory.count('lesser_mending')).toBe(count);
  });

  it('vital hearts raise max life', () => {
    const ctx = setup('vital_heart');
    const p = ctx.player;
    useAt(ctx, p.cx, p.cy, 35);
    expect(p.baseLife).toBe(120);
    expect(p.maxLife).toBe(120);
  });

  it('armour sets grant defense and set bonuses', () => {
    const ctx = setup('brasslite_blade');
    const p = ctx.player;
    p.inventory.armor.set(0, { id: 'ferrocite_head', count: 1 });
    p.inventory.armor.set(1, { id: 'ferrocite_body', count: 1 });
    p.inventory.armor.set(2, { id: 'ferrocite_legs', count: 1 });
    p.inventory.accessories.set(0, { id: 'stonehide_charm', count: 1 });
    ctx.step(2);
    expect(p.stats.setBonus).toBe('ferrocite');
    expect(p.defense).toBe(3 + 4 + 3 + 3 + 4);
  });

  it('boss summon items enforce conditions', () => {
    const ctx = setup('grubbling_lure');
    // On the surface the lure refuses.
    useAt(ctx, ctx.player.cx, ctx.player.cy, 10);
    expect(ctx.bosses.active.length).toBe(0);
    expect(ctx.player.inventory.count('grubbling_lure')).toBe(1);
  });

  it('pickaxes mine tiles into the inventory', () => {
    const ctx = setup('brasslite_pickaxe');
    const p = ctx.player;
    const tx = p.tileX;
    const ty = Math.floor((p.bottom + 2) / 16);
    const id = world.getFg(tx, ty);
    expect(id).not.toBe(0);
    useAt(ctx, tx * 16 + 8, ty * 16 + 8, 90);
    ctx.step(60);
    expect(world.getFg(tx, ty)).toBe(0);
    expect(p.inventory.main.slots.filter(Boolean).length).toBeGreaterThan(1);
  });

  it('the starter pickaxe digs soil in one hit and stone in two', () => {
    const ctx = setup('brasslite_pickaxe');
    const T = { loam: 1, stone: 3 };
    const x = ctx.player.tileX + 3;
    const y = ctx.player.tileY - 6;
    world.setFg(x, y, T.loam, 0);
    world.setFg(x + 1, y, T.stone, 0);
    expect(ctx.mining.hitTile(ctx, x, y, 35, 'pick', 0)).toBe('broke');
    expect(ctx.mining.hitTile(ctx, x + 1, y, 35, 'pick', 0)).toBe('hit');
    expect(ctx.mining.hitTile(ctx, x + 1, y, 35, 'pick', 0)).toBe('broke');
  });

  it('creative cheats: god, fly through terrain, instant mining, infinite items', () => {
    const ctx = setup('brasslite_pickaxe');
    const p = ctx.player;
    p.cheats.god = true;
    expect(p.hurt(ctx, { damage: 9999, knockback: 0, dirX: 1 })).toBe(0);
    p.cheats.fly = true;
    const y0 = p.y;
    for (let i = 0; i < 90; i++) {
      ctx.nextInput = { down: true };
      ctx.step(1);
    }
    expect(p.y).toBeGreaterThan(y0 + 16 * 8); // passed down through the ground
    p.cheats.fly = false;
    ctx.nextInput = {};
    ctx.step(2);
    expect(world.isSolid(p.tileX, p.tileY)).toBe(false); // popped out to a safe spot
    p.cheats.instantMine = true;
    const tx = p.tileX + 2;
    const ty = p.tileY;
    world.setFg(tx, ty, 15, 0); // basaltglass needs power 55; instant mine ignores that
    useAt(ctx, tx * 16 + 8, ty * 16 + 8, 12);
    expect(world.getFg(tx, ty)).toBe(0);
    p.cheats.infinite = true;
    p.inventory.main.set(1, { id: 'stone', count: 1 });
    p.inventory.selected = 1;
    useAt(ctx, tx * 16 + 8, ty * 16 + 8, 14);
    expect(world.getFg(tx, ty)).toBe(3);
    expect(p.inventory.count('stone')).toBe(1);
  });
});
