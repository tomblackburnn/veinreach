import type { GenContext } from '../generation/GenContext';
import { TileRegistry } from '../world/TileRegistry';

export interface RoomOpts {
  shell: string;
  wall: string;
  /** Knock random holes in the shell (ruins). 0..1 */
  decay?: number;
  protect?: boolean;
}

/** Build a rectangular room: solid shell, hollow interior with background wall. */
export function buildRoom(ctx: GenContext, x: number, y: number, w: number, h: number, o: RoomOpts, rng = ctx.rng): void {
  const shell = TileRegistry.id(o.shell);
  const wall = TileRegistry.wallId(o.wall);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (!ctx.inside(xx, yy, 2)) continue;
      const edge = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1;
      ctx.world.setLiquid(xx, yy, 0, 0);
      if (edge) {
        if (o.decay && rng.chance(o.decay)) ctx.world.setFg(xx, yy, 0, 0);
        else ctx.world.setFg(xx, yy, shell, 0);
      } else {
        ctx.world.setFg(xx, yy, 0, 0);
        if (!o.decay || !rng.chance(o.decay * 0.6)) ctx.world.setWall(xx, yy, wall);
      }
    }
  }
  if (o.protect !== false) ctx.protect(x, y, w, h);
}

/** Fill a rectangle with a tile. */
export function fillRect(ctx: GenContext, x: number, y: number, w: number, h: number, key: string): void {
  const id = key === 'air' ? 0 : TileRegistry.id(key);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (ctx.inside(xx, yy, 1)) ctx.world.setFg(xx, yy, id, 0);
}

export function wallRect(ctx: GenContext, x: number, y: number, w: number, h: number, key: string): void {
  const id = TileRegistry.wallId(key);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (ctx.inside(xx, yy, 1)) ctx.world.setWall(xx, yy, id);
}

export function placeTorch(ctx: GenContext, x: number, y: number): void {
  if (ctx.air(x, y)) ctx.world.setFg(x, y, TileRegistry.id('torch'), 0);
}

/** Check that a rectangle is mostly solid ground (for burying structures) or mostly unprotected. */
export function areaFree(ctx: GenContext, x: number, y: number, w: number, h: number): boolean {
  for (let yy = y; yy < y + h; yy += 2) {
    for (let xx = x; xx < x + w; xx += 2) {
      if (!ctx.inside(xx, yy, 4) || ctx.isProtected(xx, yy)) return false;
    }
  }
  return true;
}

/** Row of platforms. */
export function platformRow(ctx: GenContext, x: number, y: number, w: number): void {
  const id = TileRegistry.id('platform');
  for (let xx = x; xx < x + w; xx++) if (ctx.air(xx, y)) ctx.world.setFg(xx, y, id, 0);
}
