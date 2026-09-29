import type { GenContext } from '../generation/GenContext';
import type { Rng } from '../utils/random';
import { T, TileRegistry } from '../world/TileRegistry';
import { buildRoom, fillRect, placeTorch, platformRow, areaFree, wallRect } from './common';

/** Floating island with a small sungild-roofed shrine and a chest. */
export function buildSkyIsle(ctx: GenContext, rng: Rng, cx: number, cy: number): void {
  const rw = rng.int(18, 28);
  const rh = rng.int(8, 12);
  for (let x = -rw; x <= rw; x++) {
    const t = 1 - (x * x) / (rw * rw);
    const depth = Math.floor(rh * t + ctx.noise.perlin1((cx + x) * 0.2) * 2);
    const topBump = Math.floor(ctx.noise2.perlin1((cx + x) * 0.15) * 1.5);
    for (let y = -topBump; y < depth; y++) {
      const id = y < 3 ? T.loam : T.stone;
      ctx.set(cx + x, cy + y, y === -topBump ? T.meadowgrass : id);
      if (y > 1 && Math.abs(x) < rw - 3) ctx.wall(cx + x, cy + y, TileRegistry.wallId('loam_wall'));
    }
  }
  ctx.protect(cx - rw, cy - 12, rw * 2 + 1, rh + 14);
  // House
  const hw = 11;
  const hh = 7;
  const hx = cx - Math.floor(hw / 2);
  const hy = cy - hh - 1;
  buildRoom(ctx, hx, hy, hw, hh + 1, { shell: 'moonsilver_brick', wall: 'glass_wall' }, rng);
  fillRect(ctx, hx - 1, hy, hw + 2, 1, 'sungild_brick');
  for (let dy = hh - 3; dy < hh; dy++) {
    ctx.world.setFg(hx, hy + dy, 0, 0);
    ctx.world.setFg(hx + hw - 1, hy + dy, 0, 0);
  }
  ctx.addChest(cx - 1, hy + hh - 2, 'chest_sky', rng);
  placeTorch(ctx, hx + 2, hy + 2);
  placeTorch(ctx, hx + hw - 3, hy + 2);
  ctx.addStructure('skyisle', 'Drifting Isle', cx - rw, cy - 12, rw * 2, rh + 12);
}

/** Sunken sandstone vault beneath the dunes. */
export function buildDuneVault(ctx: GenContext, rng: Rng, x: number): void {
  const surf = ctx.world.surface[x];
  const top = surf + 12;
  // Entrance shaft.
  for (let y = surf - 4; y < top + 2; y++) {
    fillRect(ctx, x - 2, y, 5, 1, 'sandstone_brick');
    fillRect(ctx, x - 1, y, 3, 1, 'air');
    wallRect(ctx, x - 1, y, 3, 1, 'sandstone_brick_wall');
  }
  ctx.protect(x - 2, surf - 4, 5, top - surf + 6);
  // Chambers descending in a zig-zag.
  let rx = x - 10;
  let ry = top;
  const rooms = rng.int(3, 5);
  for (let i = 0; i < rooms; i++) {
    const w = rng.int(18, 26);
    const h = rng.int(9, 12);
    buildRoom(ctx, rx, ry, w, h, { shell: 'sandstone_brick', wall: 'sandstone_brick_wall', protect: true }, rng);
    ctx.addChest(rx + rng.int(3, w - 5), ry + h - 3, 'chest_vault', rng);
    placeTorch(ctx, rx + 2, ry + 2);
    placeTorch(ctx, rx + w - 3, ry + 2);
    for (let k = 0; k < 3; k++) {
      const px = rx + rng.int(2, w - 4);
      if (ctx.air(px, ry + h - 3) && ctx.air(px + 1, ry + h - 3)) ctx.placeObject(px, ry + h - 3, 'pot');
    }
    // Connector down to the next room.
    const nx = rx + (i % 2 === 0 ? w - 6 : 2);
    const nextRy = ry + h - 1;
    fillRect(ctx, nx, ry + h - 1, 4, 1, 'air');
    platformRow(ctx, nx, ry + h - 1, 4);
    rx = nx - rng.int(4, w - 8) + (i % 2 === 0 ? 6 : -6);
    ry = nextRy;
    if (i === 0) {
      // Open the first room to the shaft.
      fillRect(ctx, x - 1, top, 3, 1, 'air');
    }
  }
  ctx.addStructure('vault', 'Sunken Vault', x - 30, top, 60, ry - top + 12);
}

/** Crystal shrine in the middle of a Glimmer Hollow. */
export function buildShrine(ctx: GenContext, rng: Rng, cx: number, cy: number): void {
  const w = 13;
  const h = 9;
  const x = cx - 6;
  const y = cy - 5;
  buildRoom(ctx, x, y, w, h, { shell: 'moonsilver_brick', wall: 'prism_wall', decay: 0.1 }, rng);
  for (let dy = 3; dy < h - 1; dy++) {
    ctx.world.setFg(x, y + dy, 0, 0);
    ctx.world.setFg(x + w - 1, y + dy, 0, 0);
  }
  fillRect(ctx, x + 4, y + h - 2, 5, 1, 'sungild_brick');
  ctx.addChest(cx - 1, y + h - 4, 'chest_hollow', rng);
  ctx.world.setFg(x + 1, y + 1, TileRegistry.id('crystal_cluster'), 0);
  ctx.world.setFg(x + w - 2, y + 1, TileRegistry.id('crystal_cluster'), 0);
  ctx.addStructure('shrine', 'Glimmer Shrine', x, y, w, h);
}

/** Ruined ember-brick tower in Emberdeep. */
export function buildSpire(ctx: GenContext, rng: Rng, x: number): void {
  const L = ctx.world.layers;
  // Find the floor.
  let floor = L.underworldY + 20;
  while (floor < ctx.H - 5 && !ctx.solid(x + 5, floor)) floor++;
  const w = rng.int(11, 15);
  const h = rng.int(22, 34);
  const y = floor - h;
  if (y < L.underworldY - 10) return;
  buildRoom(ctx, x, y, w, h, { shell: 'ember_brick', wall: 'ember_wall', decay: 0.08 }, rng);
  // Foundation into the ground.
  fillRect(ctx, x, floor, w, 3, 'ember_brick');
  for (let fy = y + 7; fy < floor - 2; fy += 7) platformRow(ctx, x + 1, fy, w - 2);
  for (let dy = h - 4; dy < h - 1; dy++) {
    ctx.world.setFg(x, y + dy, 0, 0);
    ctx.world.setFg(x + w - 1, y + dy, 0, 0);
  }
  ctx.addChest(x + Math.floor(w / 2) - 1, y + 5, 'chest_ember', rng);
  placeTorch(ctx, x + 1, y + 2);
  ctx.addStructure('spire', 'Ashen Spire', x, y, w, h);
}

/** Old mineshaft: vertical timber-braced shaft with platforms and a rope line. */
export function buildMineshaft(ctx: GenContext, rng: Rng, x: number): void {
  const surf = ctx.world.surface[x];
  const depth = rng.int(70, Math.min(150, ctx.world.layers.cavernY - surf + 20));
  const rope = TileRegistry.id('rope');
  const trunk = TileRegistry.id('timber');
  for (let d = -2; d < depth; d++) {
    const y = surf + d;
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2) {
        if (d % 6 < 5) ctx.set(x + dx, y, trunk);
      } else {
        ctx.set(x + dx, y, 0);
        ctx.wall(x + dx, y, TileRegistry.wallId('dungeon_timber_wall'));
      }
    }
    if (d >= 0) ctx.world.setFg(x, y, rope, 0);
    if (d > 4 && d % 14 === 0) {
      platformRow(ctx, x - 1, y, 1);
      platformRow(ctx, x + 1, y, 1);
      placeTorch(ctx, x - 1, y - 2);
    }
  }
  ctx.protect(x - 2, surf - 2, 5, depth + 2);
  const by = surf + depth;
  buildRoom(ctx, x - 7, by, 15, 7, { shell: 'timber', wall: 'dungeon_timber_wall', decay: 0.05 }, rng);
  ctx.world.setFg(x, by, rope, 0);
  for (let dx = -1; dx <= 1; dx++) if (dx !== 0) ctx.world.setFg(x + dx, by, 0, 0);
  ctx.addChest(x + 3, by + 4, 'chest_underground', rng);
  placeTorch(ctx, x - 5, by + 2);
  ctx.addStructure('mineshaft', 'Old Mineshaft', x - 7, surf, 15, depth + 7);
}

/** Small hollow containing a Vital Crystal. */
export function buildVitalChamber(ctx: GenContext, rng: Rng, x: number, y: number): boolean {
  if (!areaFree(ctx, x - 4, y - 4, 9, 7)) return false;
  for (let dy = -3; dy <= 1; dy++) for (let dx = -3; dx <= 4; dx++) if (dx * dx * 0.6 + dy * dy < 9) ctx.set(x + dx, y + dy, 0);
  for (let dx = -3; dx <= 4; dx++) if (!ctx.solid(x + dx, y + 2)) ctx.set(x + dx, y + 2, T.stone);
  ctx.set(x, y + 2, T.stone);
  ctx.set(x + 1, y + 2, T.stone);
  ctx.placeObject(x, y, 'vital_crystal');
  ctx.protect(x - 1, y - 1, 4, 4);
  void rng;
  return true;
}

/** Ruined watchtower on the surface. */
export function buildSurfaceRuin(ctx: GenContext, rng: Rng, x: number): void {
  const surf = ctx.world.surface[x];
  const w = rng.int(9, 13);
  const h = rng.int(14, 20);
  const y = surf - h + 4;
  buildRoom(ctx, x, y, w, h, { shell: 'stone_brick', wall: 'stone_brick_wall', decay: 0.16 }, rng);
  const floor = y + h - 1;
  fillRect(ctx, x, floor, w, 3, 'stone_brick');
  for (let fy = y + 5; fy < floor - 3; fy += 5) platformRow(ctx, x + 1, fy, w - 2);
  for (let dy = floor - 3; dy < floor; dy++) {
    ctx.world.setFg(x, dy, 0, 0);
    ctx.world.setFg(x + w - 1, dy, 0, 0);
  }
  ctx.addChest(x + 2, floor - 2, 'chest_surface', rng);
  placeTorch(ctx, x + w - 2, floor - 3);
  for (let dx = 0; dx < w; dx++) if (rng.chance(0.5)) ctx.world.setFg(x + dx, y, 0, 0);
  ctx.addStructure('ruin', 'Ruined Watchtower', x, y, w, h);
}
