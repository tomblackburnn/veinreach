import { describe, it, expect, beforeAll, vi } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { ENEMIES } from '../src/data/enemies';
import { BOSSES } from '../src/data/bosses';
import { Boss } from '../src/entities/bosses/Boss';
import { breakTile, placeTile } from '../src/world/WorldActions';
import { TileRegistry, T } from '../src/world/TileRegistry';
import type { World } from '../src/world/World';

let world: World;
let spawn: [number, number];

beforeAll(() => {
  const g = generateWorldSync({ name: 'sim', seed: 'simulation', width: 700, height: 360 });
  world = g.world;
  spawn = [g.spawnX, g.spawnY];
});

function fresh(): SimContext {
  const ctx = new SimContext(world);
  ctx.player.teleportTo(ctx, spawn[0], spawn[1]);
  return ctx;
}

describe('simulation', () => {
  it('player falls onto the ground, walks and jumps', () => {
    const ctx = fresh();
    ctx.player.y -= 64;
    ctx.step(120);
    expect(ctx.player.onGround).toBe(true);
    const x0 = ctx.player.x;
    ctx.nextInput = { right: true };
    ctx.step(60);
    expect(ctx.player.x).toBeGreaterThan(x0 + 40);
    ctx.nextInput = { jump: true, jumpPressed: true };
    ctx.step(1);
    ctx.nextInput = { jump: true };
    ctx.step(10);
    expect(ctx.player.onGround).toBe(false);
  });

  it('every enemy type runs its AI without errors', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ctx = fresh();
    ctx.god = true;
    for (const def of ENEMIES) {
      const e = ctx.spawnEnemy(def.id, ctx.player.cx + 120, ctx.player.bottom - 4)!;
      e.despawnable = false;
    }
    ctx.step(900);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('enemies can be killed and drop loot', () => {
    const ctx = fresh();
    const e = ctx.spawnEnemy('gloop', ctx.player.cx + 60, ctx.player.bottom)!;
    e.hurt(ctx, { damage: 999, knockback: 0, dirX: 1 });
    expect(e.dead).toBe(true);
    ctx.step(1);
    expect(ctx.entities.drops.length).toBeGreaterThan(0);
  });

  for (const b of BOSSES) {
    it(`boss ${b.id} cycles through its attacks and phases and can be defeated`, () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const ctx = fresh();
      ctx.god = true;
      if (b.id === 'thornwarden' || b.id === 'solmara') ctx.time.setHour(22);
      ctx.time.speed = 0;
      const boss = ctx.bosses.spawn(ctx, b.id, ctx.player)!;
      expect(boss).toBeInstanceOf(Boss);
      const attacks = new Set<string>();
      let maxPhase = 1;
      for (let t = 0; t < 9000 && !boss.removed; t++) {
        ctx.step(1);
        attacks.add(boss.attack);
        maxPhase = Math.max(maxPhase, boss.phase);
        // Keep the player near the boss and chip away at it.
        if (t % 300 === 0) ctx.player.setCenter(boss.cx - 200, boss.cy);
        if (t > 600 && t % 40 === 0) boss.hurt(ctx, { damage: boss.maxLife / 60, knockback: 0, dirX: 1, ignoreDefense: true });
      }
      expect(err).not.toHaveBeenCalled();
      err.mockRestore();
      expect(attacks.size).toBeGreaterThanOrEqual(4);
      expect(maxPhase).toBeGreaterThanOrEqual(2);
      expect(boss.removed).toBe(true);
      expect(ctx.progression.has(`boss:${b.id}`)).toBe(true);
      if (b.id === 'obelisk') expect(ctx.progression.has('unsealed')).toBe(true);
    });
  }

  it('mining, felling and placing edit the world correctly', () => {
    const ctx = fresh();
    const w = ctx.world;
    // Find a tree near spawn.
    let tree: [number, number] | null = null;
    for (let x = 20; x < w.width - 20 && !tree; x++) {
      for (let y = 20; y < w.height / 2; y++) {
        if (w.getFg(x, y) === T.trunk && w.getFg(x, y + 1) !== T.trunk) {
          tree = [x, y];
          break;
        }
      }
    }
    expect(tree).not.toBeNull();
    const [tx, ty] = tree!;
    breakTile(ctx, tx, ty);
    expect(w.getFg(tx, ty)).toBe(0);
    expect(w.getFg(tx, ty - 3)).not.toBe(T.trunk);
    expect(ctx.entities.drops.some((d) => d.stack.id === 'wood')).toBe(true);
    // Place a workbench on flat ground.
    const gx = spawn[0] + 3;
    let gy = spawn[1];
    while (!w.isSolid(gx, gy + 1)) gy++;
    while (w.isSolid(gx, gy)) gy--;
    for (let dx = 0; dx < 2; dx++) if (!w.isSolid(gx + dx, gy + 1)) w.setFg(gx + dx, gy + 1, T.stone, 0);
    w.setFg(gx + 1, gy, 0, 0);
    expect(placeTile(ctx, gx, gy, TileRegistry.id('workbench'))).toBe(true);
    expect(w.getFg(gx + 1, gy)).toBe(TileRegistry.id('workbench'));
    // Mining away the floor beneath breaks the object (support cascade) and drops it.
    breakTile(ctx, gx, gy + 1);
    expect(w.getFg(gx, gy)).toBe(TileRegistry.id('workbench'));
    breakTile(ctx, gx + 1, gy + 1);
    expect(w.getFg(gx, gy)).toBe(0);
    expect(w.getFg(gx + 1, gy)).toBe(0);
    expect(ctx.entities.drops.some((d) => d.stack.id === 'workbench')).toBe(true);
  });
});
