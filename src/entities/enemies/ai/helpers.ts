import type { GameContext } from '../../../core/context';
import type { Enemy } from '../Enemy';
import { moveBody, lineOfSight, liquidAt, type MoveResult } from '../../../physics/Physics';
import { PHYSICS } from '../../../core/config';
import { approach } from '../../../utils/math';

export const p = (e: Enemy, key: string, def: number): number => e.def.p?.[key] ?? def;

export function gravity(e: Enemy, ctx: GameContext, scale = 1): void {
  const liquid = liquidAt(ctx.world, e);
  e.vy = Math.min(e.vy + PHYSICS.gravity * scale * (liquid ? 0.5 : 1), liquid ? PHYSICS.liquidMaxFall : PHYSICS.maxFall);
}

export function physics(e: Enemy, ctx: GameContext, stepUp = true): MoveResult {
  return moveBody(ctx.world, e, { platforms: true, stepUp, noClip: e.noClip });
}

/** Ground locomotion toward a direction, jumping over walls. Returns true if it jumped. */
export function walk(e: Enemy, ctx: GameContext, dir: number, speed: number, jump: number, accel = 0.12): boolean {
  const slow = e.buffs.speedMul();
  e.vx = approach(e.vx, dir * speed * slow, accel);
  if (dir !== 0) e.facing = dir > 0 ? 1 : -1;
  gravity(e, ctx);
  const res = physics(e, ctx);
  if (res.hitX && e.onGround && dir !== 0) {
    e.vy = -jump;
    return true;
  }
  return false;
}

export function distToPlayer(e: Enemy, ctx: GameContext): number {
  return Math.hypot(e.target.cx - e.cx, e.target.cy - e.cy);
}

export function dirToPlayer(e: Enemy, ctx: GameContext): number {
  return Math.sign(e.target.cx - e.cx) || 1;
}

export function canSeePlayer(e: Enemy, ctx: GameContext, range: number): boolean {
  if (e.target.dead) return false;
  if (distToPlayer(e, ctx) > range) return false;
  return lineOfSight(ctx.world, e.cx, e.cy, e.target.cx, e.target.cy);
}

/** Aim a projectile at the player with optional lead. */
export function shootAt(e: Enemy, ctx: GameContext, speed: number, spread = 0, id = e.def.projectile, dmg = e.def.projectileDamage): void {
  if (!id) return;
  const pl = e.target;
  const a = Math.atan2(pl.cy - e.cy, pl.cx - e.cx) + spread;
  ctx.spawnProjectile(id, e.cx, e.cy, Math.cos(a) * speed, Math.sin(a) * speed, { damage: dmg ?? e.damage, knockback: 4, friendly: false, owner: e, onHit: e.def.onHit });
}

/** Steer a flying enemy toward a point with inertia. */
export function flyToward(e: Enemy, tx: number, ty: number, speed: number, inertia = 0.06): void {
  const dx = tx - e.cx;
  const dy = ty - e.cy;
  const d = Math.hypot(dx, dy) || 1;
  const slow = e.buffs.speedMul();
  e.vx += ((dx / d) * speed * slow - e.vx) * inertia;
  e.vy += ((dy / d) * speed * slow - e.vy) * inertia;
  e.facing = e.vx >= 0 ? 1 : -1;
}
