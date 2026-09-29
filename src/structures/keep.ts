import type { GenContext } from '../generation/GenContext';
import type { Rng } from '../utils/random';
import { TileRegistry } from '../world/TileRegistry';
import { platformRow, placeTorch } from './common';

/**
 * The Warden's Keep: a brick fortress whose entrance hall sits on the surface
 * and whose corridors wind down deep underground. Built with a two-stage
 * "shell then hollow" approach so corridors can cross each other cleanly.
 */
export function buildKeep(ctx: GenContext, rng: Rng, x: number): void {
  const world = ctx.world;
  const brick = TileRegistry.id('warden_brick');
  const wall = TileRegistry.wallId('warden_wall');
  const hollow = new Set<number>();
  const key = (px: number, py: number) => py * ctx.W + px;
  const SHELL = 3;
  const rooms: { x: number; y: number; w: number; h: number }[] = [];

  const shellRect = (x0: number, y0: number, w: number, h: number) => {
    for (let yy = y0 - SHELL; yy < y0 + h + SHELL; yy++) {
      for (let xx = x0 - SHELL; xx < x0 + w + SHELL; xx++) {
        if (!ctx.inside(xx, yy, 3) || hollow.has(key(xx, yy))) continue;
        world.setFg(xx, yy, brick, 0);
        world.setLiquid(xx, yy, 0, 0);
        world.setWall(xx, yy, wall);
      }
    }
  };
  const hollowRect = (x0: number, y0: number, w: number, h: number) => {
    for (let yy = y0; yy < y0 + h; yy++) {
      for (let xx = x0; xx < x0 + w; xx++) {
        if (!ctx.inside(xx, yy, 3)) continue;
        world.setFg(xx, yy, 0, 0);
        world.setWall(xx, yy, wall);
        hollow.add(key(xx, yy));
      }
    }
  };
  const area = (x0: number, y0: number, w: number, h: number) => {
    shellRect(x0, y0, w, h);
    hollowRect(x0, y0, w, h);
  };

  const surf = world.surface[x];
  // Entrance hall on the surface.
  const hallW = 22;
  const hallH = 14;
  const hx = x - hallW / 2;
  const hy = surf - hallH + 2;
  area(hx, hy, hallW, hallH);
  // Clear terrain above the hall so it stands on the surface.
  for (let yy = hy - SHELL - 12; yy < hy - SHELL; yy++) {
    for (let xx = hx - SHELL - 2; xx < hx + hallW + SHELL + 2; xx++) if (ctx.inside(xx, yy, 2)) world.setFg(xx, yy, 0, 0);
  }
  // Doorway on the side facing spawn.
  const doorSide = ctx.keepSide === 1 ? -1 : 1;
  const doorX = doorSide === -1 ? hx - SHELL : hx + hallW;
  for (let yy = hy + hallH - 5; yy < hy + hallH; yy++) for (let d = 0; d < SHELL; d++) world.setFg(doorX + d, yy, 0, 0);
  rooms.push({ x: hx, y: hy, w: hallW, h: hallH });

  // Winding corridor system descending from the hall floor.
  let cx = x - 2;
  let cy = hy + hallH;
  const segments = rng.int(14, 20);
  let dir = rng.chance(0.5) ? 1 : -1;
  const maxDepth = world.layers.cavernY + 40;
  for (let s = 0; s < segments; s++) {
    const vertical = s % 2 === 0;
    if (vertical) {
      const len = rng.int(12, 22);
      const ny = Math.min(maxDepth, cy + len);
      area(cx, cy, 5, ny - cy);
      for (let py = cy + 5; py < ny - 1; py += 6) platformRow(ctx, cx, py, 5);
      cy = ny;
    } else {
      const len = rng.int(18, 34);
      const nx = cx + dir * len;
      const x0 = Math.min(cx, nx);
      area(x0, cy - 5, Math.abs(nx - cx) + 5, 6);
      cx = Math.max(ctx.W * 0.05, Math.min(ctx.W * 0.95, nx));
      if (rng.chance(0.3)) dir = -dir;
    }
    if (rng.chance(0.55)) {
      const rw = rng.int(14, 22);
      const rh = rng.int(9, 13);
      const rx = cx - Math.floor(rw / 2) + rng.int(-4, 4);
      const ry = cy - rh + 1;
      area(rx, ry, rw, rh);
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }
  }

  // Furnish rooms.
  const bone = TileRegistry.id('bone_pile');
  const web = TileRegistry.id('cobweb');
  rooms.forEach((r, i) => {
    const floor = r.y + r.h - 1;
    // Ensure a floor under the room interior (the shell provides it).
    if (i > 0 && rng.chance(0.75)) {
      const chx = r.x + rng.int(2, Math.max(2, r.w - 4));
      if (ctx.air(chx, floor - 1) && ctx.air(chx + 1, floor - 1) && ctx.solid(chx, floor + 1)) ctx.addChest(chx, floor - 1, 'chest_keep', rng);
    }
    for (let k = 0; k < 3; k++) {
      const bx = r.x + rng.int(1, r.w - 2);
      if (ctx.air(bx, floor) && ctx.solid(bx, floor + 1)) world.setFg(bx, floor, bone, 0);
    }
    if (ctx.air(r.x, r.y)) world.setFg(r.x, r.y, web, 0);
    if (ctx.air(r.x + r.w - 1, r.y)) world.setFg(r.x + r.w - 1, r.y, web, 0);
    placeTorch(ctx, r.x + 1, r.y + 2);
    if (r.w > 12) placeTorch(ctx, r.x + r.w - 2, r.y + 2);
  });
  let minX = Infinity;
  let maxX = -Infinity;
  for (const k of hollow) {
    const px = k % ctx.W;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
  }
  ctx.protect(minX - SHELL, hy - SHELL, maxX - minX + SHELL * 2, cy - hy + SHELL * 2 + 14);
  ctx.addStructure('keep', 'Warden’s Keep', minX, hy, maxX - minX, cy - hy + 14);
}
