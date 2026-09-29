import { TILE_SIZE } from '../core/config';
import type { World } from '../world/World';
import { TileRegistry } from '../world/TileRegistry';

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface MoveOpts {
  /** Collide with one-way platforms when falling. */
  platforms: boolean;
  /** Ignore platforms this move (dropping through). */
  dropThrough?: boolean;
  /** Automatically step up one-tile ledges while grounded. */
  stepUp?: boolean;
  /** Pass through all tiles. */
  noClip?: boolean;
}

export interface MoveResult {
  hitX: boolean;
  hitY: boolean;
  hitCeiling: boolean;
  landed: boolean;
  steppedUp: boolean;
}

const EPS = 0.001;
const tileOf = (px: number) => Math.floor(px / TILE_SIZE);

/** Is the axis-aligned rect overlapping any solid tile? */
export function rectHitsSolid(world: World, x: number, y: number, w: number, h: number): boolean {
  const x0 = tileOf(x + EPS);
  const x1 = tileOf(x + w - EPS);
  const y0 = tileOf(y + EPS);
  const y1 = tileOf(y + h - EPS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.isSolid(tx, ty)) return true;
  return false;
}

/**
 * Move a body through the tile grid with axis-separated sweeps. Large
 * velocities are sub-stepped so fast entities never tunnel through tiles.
 */
export function moveBody(world: World, b: Body, o: MoveOpts): MoveResult {
  const res: MoveResult = { hitX: false, hitY: false, hitCeiling: false, landed: false, steppedUp: false };
  if (o.noClip) {
    b.x += b.vx;
    b.y += b.vy;
    b.onGround = false;
    return res;
  }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) / (TILE_SIZE / 2)));
  const sx = b.vx / steps;
  const sy = b.vy / steps;
  const wasGround = b.onGround;
  b.onGround = false;
  for (let i = 0; i < steps; i++) {
    if (!res.hitX) moveX(world, b, sx, o, wasGround, res);
    if (!res.hitY) moveY(world, b, sy, o, res);
  }
  if (res.hitX) b.vx = 0;
  if (res.hitY) b.vy = 0;
  // Ground probe (so standing still still counts as grounded).
  if (!b.onGround && b.vy >= 0) {
    const footY = b.y + b.h;
    const ty = tileOf(footY + 1);
    if (Math.abs(footY - ty * TILE_SIZE) < 0.5) {
      const x0 = tileOf(b.x + EPS);
      const x1 = tileOf(b.x + b.w - EPS);
      for (let tx = x0; tx <= x1; tx++) {
        if (world.isSolid(tx, ty) || (o.platforms && !o.dropThrough && world.isPlatform(tx, ty))) {
          b.onGround = true;
          break;
        }
      }
    }
  }
  return res;
}

function moveX(world: World, b: Body, dx: number, o: MoveOpts, grounded: boolean, res: MoveResult): void {
  if (dx === 0) return;
  const nx = b.x + dx;
  const edge = dx > 0 ? nx + b.w - EPS : nx + EPS;
  const tx = tileOf(edge);
  const y0 = tileOf(b.y + EPS);
  const y1 = tileOf(b.y + b.h - EPS);
  let blocked = false;
  let blockTop = Infinity;
  for (let ty = y0; ty <= y1; ty++) {
    if (world.isSolid(tx, ty)) {
      blocked = true;
      blockTop = Math.min(blockTop, ty);
    }
  }
  if (!blocked) {
    b.x = nx;
    return;
  }
  // Auto step-up: only the bottom tile row is blocked and there's headroom.
  if (o.stepUp && grounded && blockTop === y1) {
    const liftTo = y1 * TILE_SIZE - b.h;
    if (b.y + b.h - y1 * TILE_SIZE <= TILE_SIZE + EPS && !rectHitsSolid(world, nx, liftTo - EPS, b.w, b.h)) {
      b.y = liftTo;
      b.x = nx;
      b.onGround = true;
      res.steppedUp = true;
      return;
    }
  }
  b.x = dx > 0 ? tx * TILE_SIZE - b.w : (tx + 1) * TILE_SIZE;
  res.hitX = true;
}

function moveY(world: World, b: Body, dy: number, o: MoveOpts, res: MoveResult): void {
  if (dy === 0) return;
  const ny = b.y + dy;
  const x0 = tileOf(b.x + EPS);
  const x1 = tileOf(b.x + b.w - EPS);
  if (dy > 0) {
    const oldBottom = b.y + b.h;
    const ty = tileOf(ny + b.h - EPS);
    for (let tx = x0; tx <= x1; tx++) {
      const solid = world.isSolid(tx, ty);
      const plat = !solid && o.platforms && !o.dropThrough && world.isPlatform(tx, ty) && oldBottom <= ty * TILE_SIZE + EPS;
      if (solid || plat) {
        b.y = ty * TILE_SIZE - b.h;
        b.onGround = true;
        res.hitY = true;
        res.landed = true;
        return;
      }
    }
  } else {
    const ty = tileOf(ny + EPS);
    for (let tx = x0; tx <= x1; tx++) {
      if (world.isSolid(tx, ty)) {
        b.y = (ty + 1) * TILE_SIZE;
        res.hitY = true;
        res.hitCeiling = true;
        return;
      }
    }
  }
  b.y = ny;
}

/** Push a body out of solid tiles if it ended up embedded (e.g. after a block was placed on it). */
export function unstick(world: World, b: Body): void {
  if (!rectHitsSolid(world, b.x, b.y, b.w, b.h)) return;
  for (let d = 1; d <= 6; d++) {
    for (const [dx, dy] of [[0, -d], [d, 0], [-d, 0], [0, d]] as const) {
      const nx = b.x + dx * TILE_SIZE;
      const ny = b.y + dy * TILE_SIZE;
      if (!rectHitsSolid(world, nx, ny, b.w, b.h)) {
        b.x = nx;
        b.y = ny;
        return;
      }
    }
  }
}

/** Liquid at the body's centre: 0 none, 1 water, 2 lava. */
export function liquidAt(world: World, b: Body): number {
  const tx = tileOf(b.x + b.w / 2);
  const ty = tileOf(b.y + b.h * 0.6);
  return world.getLiquid(tx, ty) > 60 ? world.getLiquidType(tx, ty) : 0;
}

/** Highest contact damage and strongest drag among tiles overlapping the body. */
export function tileContact(world: World, b: Body): { damage: number; drag: number; climb: boolean } {
  let damage = 0;
  let drag = 1;
  let climb = false;
  const x0 = tileOf(b.x + 2);
  const x1 = tileOf(b.x + b.w - 2);
  const y0 = tileOf(b.y + 2);
  const y1 = tileOf(b.y + b.h + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const def = TileRegistry.get(world.getFg(tx, ty));
      if (def.contactDamage && def.contactDamage > damage) damage = def.contactDamage;
      if (ty < y1 && def.drag !== undefined) drag = Math.min(drag, def.drag);
      if (ty < y1 && def.climbable) climb = true;
    }
  }
  return { damage, drag, climb };
}

/** Grid raycast between two world points; true if line of sight is clear. */
export function lineOfSight(world: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / (TILE_SIZE / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = tileOf(x0 + (x1 - x0) * t);
    const ty = tileOf(y0 + (y1 - y0) * t);
    if (TileRegistry.opaque[world.getFg(tx, ty)]) return false;
  }
  return true;
}
