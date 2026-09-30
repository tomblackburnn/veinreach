import { describe, it, expect } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { LIQUID } from '../src/world/TileRegistry';
import { LiquidSystem } from '../src/systems/LiquidSystem';
import { SimContext } from './helpers/SimContext';
import type { World } from '../src/world/World';

/** Underworld lava cells beside open space with less liquid in it: lava that should still be flowing. */
function lavaBesideGaps(w: World): string[] {
  const out: string[] = [];
  for (let y = w.layers.underworldY; y < w.height - 1; y++) {
    for (let x = 1; x < w.width - 1; x++) {
      const a = w.getLiquid(x, y);
      if (!a || w.getLiquidType(x, y) !== LIQUID.lava) continue;
      if (!w.isSolid(x, y + 1) && w.getLiquid(x, y + 1) < 255) out.push(`${x},${y + 1}`);
      for (const d of [-1, 1]) if (!w.isSolid(x + d, y) && w.getLiquid(x + d, y) + 2 < a) out.push(`${x + d},${y}`);
    }
  }
  return out;
}

describe('the underworld', () => {
  it('lava lakes have no dry gaps under overhangs', () => {
    for (const seed of ['lava-a', 'lava-b', 'lava-c']) {
      const { world } = generateWorldSync({ name: 'u', seed, width: 1200, height: 600 });
      expect(lavaBesideGaps(world), `seed ${seed}`).toEqual([]);
    }
  });

  it('lava resting beside an empty gap flows into it once the area is woken', () => {
    const { world } = generateWorldSync({ name: 'u', seed: 'lava-gap', width: 600, height: 320 });
    // Find a full lava cell and dig a dry pocket beside it (like older worlds have).
    let gx = -1;
    let gy = -1;
    for (let y = world.height - 30; y < world.height - 4 && gx < 0; y++) {
      for (let x = 20; x < world.width - 20; x++) {
        if (world.getLiquid(x, y) === 255 && world.getLiquid(x + 1, y) === 255 && world.isSolid(x + 1, y + 1)) {
          gx = x + 1;
          gy = y;
          break;
        }
      }
    }
    expect(gx).toBeGreaterThan(0);
    world.setLiquid(gx, gy, 0, 0);
    const liquids = new LiquidSystem(world);
    liquids.wakeArea(gx - 40, gy - 40, gx + 40, gy + 40);
    for (let i = 0; i < 60; i++) liquids.step(gx, gy, 110);
    expect(world.getLiquid(gx, gy)).toBeGreaterThan(0);
  });
});

describe('cinder imps', () => {
  it('stop following a player who flies far away, and despawn', () => {
    const { world } = generateWorldSync({ name: 'u', seed: 'imps', width: 600, height: 600 });
    const ctx = new SimContext(world);
    ctx.god = true;
    // Start in an open spot of the underworld.
    const x = 300;
    let y = world.layers.underworldY + 15;
    while (y < world.height - 30 && world.isSolid(x, y)) y++;
    // …with an open shaft up to the sky to fly through.
    for (let yy = 5; yy <= y + 1; yy++) for (let dx = -2; dx <= 2; dx++) world.setFg(x + dx, yy, 0, 0);
    ctx.player.teleportTo(ctx, x, y);
    const imp = ctx.spawnEnemy('cinder_imp', ctx.player.cx + 60, ctx.player.cy - 20)!;
    expect(imp).toBeTruthy();
    ctx.step(30);
    // Fly straight up to the surface at wing speed (about 30 tiles a second), then hover there.
    const top = (world.layers.surfaceY - 20) * 16;
    let closest = Infinity;
    for (let i = 0; i < 1200; i++) {
      ctx.player.vx = ctx.player.vy = 0;
      ctx.player.y = Math.max(top, ctx.player.y - 8);
      ctx.step(1);
      if (ctx.player.y < top + 16 && !imp.removed) closest = Math.min(closest, Math.hypot(imp.cx - ctx.player.cx, imp.cy - ctx.player.cy) / 16);
    }
    expect(ctx.player.y, 'the player made it to the surface').toBeLessThan(top + 16);
    expect(closest, 'the imp never blinks up next to the player on the surface').toBeGreaterThan(60);
    expect(imp.removed, 'and it despawns').toBe(true);
  });

  it('still blink toward a player who is nearby but out of sight', () => {
    const { world, spawnX, spawnY } = generateWorldSync({ name: 'u', seed: 'imps', width: 600, height: 320 });
    const ctx = new SimContext(world);
    ctx.god = true;
    ctx.player.teleportTo(ctx, spawnX, spawnY);
    const imp = ctx.spawnEnemy('cinder_imp', ctx.player.cx + 16 * 40, ctx.player.cy - 16 * 10)!;
    let blinked = false;
    for (let i = 0; i < 120 && !blinked; i++) {
      const before = imp.cx;
      ctx.step(1);
      blinked = Math.abs(imp.cx - before) > 16 * 8;
    }
    expect(blinked).toBe(true);
  });
});
