import { describe, it, expect } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { checkRoom } from '../src/world/housing';
import { TileRegistry } from '../src/world/TileRegistry';
import { placeObjectRaw } from '../src/world/objects';
import type { World } from '../src/world/World';

/** Build a 10×6 interior house with its floor at row `floor` (the solid row). */
function buildHouse(w: World, x0: number, floor: number, opts: { door?: boolean; light?: boolean; wall?: boolean } = {}): { cx: number; cy: number } {
  const plank = TileRegistry.id('timber');
  const wall = TileRegistry.wallId('timber_wall');
  const W = 12;
  const H = 8;
  const top = floor - H + 1;
  for (let y = top - 2; y <= floor; y++) for (let x = x0 - 2; x < x0 + W + 2; x++) w.setFg(x, y, 0, 0);
  for (let y = top; y <= floor; y++) {
    for (let x = x0; x < x0 + W; x++) {
      const edge = x === x0 || x === x0 + W - 1 || y === top || y === floor;
      w.setFg(x, y, edge ? plank : 0, 0);
      if (!edge && opts.wall !== false) w.setWall(x, y, wall);
    }
  }
  if (opts.door !== false) {
    for (let y = floor - 3; y < floor; y++) w.setFg(x0, y, 0, 0);
    placeObjectRaw(w, x0, floor - 3, TileRegistry.id('door_closed'));
  }
  placeObjectRaw(w, x0 + 2, floor - 2, TileRegistry.id('chair'));
  placeObjectRaw(w, x0 + 4, floor - 2, TileRegistry.id('table'));
  if (opts.light !== false) w.setFg(x0 + 9, top + 2, TileRegistry.id('torch'), 0);
  return { cx: x0 + 2, cy: floor - 1 };
}

describe('housing & NPCs', () => {
  const g = generateWorldSync({ name: 'npc', seed: 'npc-town', width: 500, height: 280 });
  const w = g.world;

  it('validates rooms with helpful reasons', () => {
    const a = buildHouse(w, g.spawnX + 20, g.spawnY - 2);
    expect(checkRoom(w, a.cx, a.cy).valid).toBe(true);
    const b = buildHouse(w, g.spawnX + 40, g.spawnY - 2, { light: false });
    expect(checkRoom(w, b.cx, b.cy).reason).toMatch(/light/);
    const c = buildHouse(w, g.spawnX + 60, g.spawnY - 2, { door: false });
    expect(checkRoom(w, c.cx, c.cy).reason).toMatch(/door/);
    const d = buildHouse(w, g.spawnX + 80, g.spawnY - 2, { wall: false });
    expect(checkRoom(w, d.cx, d.cy).reason).toMatch(/wall/);
    expect(checkRoom(w, g.spawnX, g.spawnY - 10).valid).toBe(false);
  });

  it('an NPC moves in once a house exists and its condition is met', () => {
    const ctx = new SimContext(w);
    ctx.player.teleportTo(ctx, g.spawnX + 25, g.spawnY - 3);
    ctx.time.setHour(10);
    ctx.time.speed = 0;
    ctx.step(600);
    expect(ctx.entities.npcs.length).toBe(0);
    ctx.player.inventory.wallet = 100;
    ctx.step(600);
    expect(ctx.entities.npcs.map((n) => n.def.id)).toContain('pedlar');
    const pedlar = ctx.entities.npcs[0];
    expect(pedlar.homeX).not.toBeNull();
    expect(ctx.npcs.shop(ctx, pedlar).length).toBeGreaterThan(5);
    expect(ctx.npcs.dialogue(ctx, pedlar).length).toBeGreaterThan(5);
    // The Smith needs a progression flag and a second free house.
    ctx.progression.set('boss:gravelmaw');
    ctx.step(600);
    expect(ctx.entities.npcs.map((n) => n.def.id)).not.toContain('smith');
    buildHouse(w, g.spawnX - 20, g.spawnY - 2);
    ctx.step(600);
    expect(ctx.entities.npcs.map((n) => n.def.id)).toContain('smith');
    // Serialisation
    const saved = ctx.npcs.serialize();
    expect(saved.length).toBe(ctx.entities.npcs.length);
  });
});
