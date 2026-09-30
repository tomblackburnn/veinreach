import type { AIController } from './AIController';
import type { Enemy } from '../Enemy';
import type { GameContext } from '../../../core/context';
import { p, physics, gravity, distToPlayer, dirToPlayer, canSeePlayer, shootAt, flyToward } from './helpers';
import { rectHitsSolid } from '../../../physics/Physics';

const TILE = 16;

/** Erratic bat-like flight toward the player, bouncing off terrain. */
export const flierAI: AIController = {
  update(e, ctx) {
    const pl = e.target;
    const erratic = p(e, 'erratic', 1);
    const wob = Math.sin(e.age * 0.08 + e.id) * 60 * erratic;
    if (!pl.dead && distToPlayer(e, ctx) < 50 * TILE) flyToward(e, pl.cx + wob, pl.cy + Math.cos(e.age * 0.06 + e.id) * 40 * erratic, p(e, 'speed', 3), 0.05);
    else flyToward(e, e.cx + Math.sin(e.age * 0.02) * 100, e.cy - 20, 1.5, 0.03);
    const res = physics(e, ctx, false);
    if (res.hitX) e.vx *= -1;
    if (res.hitY) e.vy *= -1;
    e.setState('fly');
  },
};

/** Circles above the player, winds up, then dives through their position. */
export const hoverdiveAI: AIController = {
  update(e, ctx) {
    const pl = e.target;
    switch (e.state) {
      case 'dive':
        e.x += e.vx;
        e.y += e.vy;
        if (e.stateTime > 40 || rectHitsSolid(ctx.world, e.x, e.y, e.w, e.h)) {
          e.setState('rise');
          if (rectHitsSolid(ctx.world, e.x, e.y, e.w, e.h)) e.vy = -3;
        }
        break;
      case 'windup':
        e.vx *= 0.9;
        e.vy *= 0.9;
        physics(e, ctx, false);
        if (e.age % 3 === 0) ctx.particles.sparks(e.cx, e.cy, '#ffe070', 2);
        if (e.stateTime > 30) {
          const a = Math.atan2(pl.cy - e.cy, pl.cx - e.cx);
          e.vx = Math.cos(a) * p(e, 'dive', 7);
          e.vy = Math.sin(a) * p(e, 'dive', 7);
          e.setState('dive');
        }
        break;
      case 'rise':
        flyToward(e, pl.cx, pl.cy - 140, p(e, 'speed', 2.4), 0.08);
        physics(e, ctx, false);
        if (e.stateTime > 50) e.setState('circle');
        break;
      default: {
        e.setState('circle');
        const a = e.age * 0.025 + e.id;
        flyToward(e, pl.cx + Math.cos(a) * 130, pl.cy - 110 + Math.sin(a * 2) * 25, p(e, 'speed', 2.4), 0.06);
        const res = physics(e, ctx, false);
        if (res.hitY) e.vy = -1;
        if (e.stateTime > 150 && canSeePlayer(e, ctx, 300)) e.setState('windup');
      }
    }
  },
};

/** Hovers at range and fires fan bursts (crystal motes). */
export const floaterAI: AIController = {
  update(e, ctx) {
    const pl = e.target;
    const side = e.id % 2 ? 1 : -1;
    const tx = pl.cx + side * 150 + Math.sin(e.age * 0.03) * 40;
    const ty = pl.cy - 90 + Math.cos(e.age * 0.05) * 20;
    flyToward(e, tx, ty, p(e, 'speed', 1.6), 0.05);
    physics(e, ctx, false);
    e.facing = dirToPlayer(e, ctx) > 0 ? 1 : -1;
    e.mem.cd = (e.mem.cd ?? 60) - 1;
    if (e.mem.cd === 30 && canSeePlayer(e, ctx, 450)) e.setState('charge');
    if (e.mem.cd <= 0) {
      e.mem.cd = p(e, 'cooldown', 140);
      if (canSeePlayer(e, ctx, 450)) {
        const n = p(e, 'burst', 5);
        for (let i = 0; i < n; i++) shootAt(e, ctx, 5, (i - (n - 1) / 2) * 0.18);
        ctx.audio.play('crystal', { x: e.cx, y: e.cy, volume: 0.5 });
      }
      e.setState('float');
    }
  },
};

/** Phases through terrain with a drifting approach and occasional lunges. */
export const ghostAI: AIController = {
  update(e, ctx) {
    e.noClip = true;
    const pl = e.target;
    if (e.state === 'lunge') {
      e.x += e.vx;
      e.y += e.vy;
      e.vx *= 0.97;
      e.vy *= 0.97;
      if (e.stateTime > 35) e.setState('drift');
      return;
    }
    e.setState('drift');
    flyToward(e, pl.cx + Math.sin(e.age * 0.04) * 50, pl.cy + Math.cos(e.age * 0.03) * 50, p(e, 'speed', 2.2), 0.03);
    e.x += e.vx;
    e.y += e.vy;
    if (e.stateTime > 200 && distToPlayer(e, ctx) < 250) {
      const a = Math.atan2(pl.cy - e.cy, pl.cx - e.cx);
      e.vx = Math.cos(a) * 7;
      e.vy = Math.sin(a) * 7;
      e.setState('lunge');
      ctx.audio.play('magic', { x: e.cx, y: e.cy, pitch: 0.5 });
    }
  },
};

/** Stands and casts; teleports near the player when out of range or sight. */
export const casterAI: AIController = {
  update(e, ctx) {
    const flying = p(e, 'fly', 0) === 1;
    const pl = e.target;
    if (flying) {
      flyToward(e, pl.cx + Math.sin(e.age * 0.02 + e.id) * 160, pl.cy - 80, 1.4, 0.04);
      physics(e, ctx, false);
    } else {
      gravity(e, ctx);
      e.vx *= 0.8;
      physics(e, ctx);
    }
    e.facing = dirToPlayer(e, ctx) > 0 ? 1 : -1;
    const see = canSeePlayer(e, ctx, 500);
    e.mem.cd = (e.mem.cd ?? 90) - 1;
    if (e.state === 'cast') {
      if (e.age % 3 === 0) ctx.particles.emit(e.cx + e.facing * 8, e.y + 10, { count: 2, color: e.def.sprite.colors[1], speed: [0.3, 1.2], life: [10, 20], glow: true, gravity: -0.05 });
      if (e.stateTime > 30) {
        shootAt(e, ctx, 4.5, -0.15);
        shootAt(e, ctx, 4.5, 0.15);
        ctx.audio.play('magic', { x: e.cx, y: e.cy, volume: 0.7, pitch: 0.7 });
        e.setState('idle');
      }
      return;
    }
    if (see && e.mem.cd <= 0) {
      e.mem.cd = p(e, 'cooldown', 150);
      e.setState('cast');
      return;
    }
    e.mem.unseen = see ? 0 : (e.mem.unseen ?? 0) + 1;
    if ((e.mem.unseen ?? 0) > 200 || distToPlayer(e, ctx) > p(e, 'teleport', 300) * 1.8) {
      if (teleportNear(e, ctx, flying)) e.mem.unseen = 0;
    }
  },
};

/** Find an open spot near the player and blink there. */
export function teleportNear(e: Enemy, ctx: GameContext, air: boolean): boolean {
  const pl = e.target;
  for (let i = 0; i < 30; i++) {
    const tx = Math.floor(pl.cx / TILE) + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.floor(Math.random() * 12));
    let ty = Math.floor(pl.cy / TILE) + Math.floor(Math.random() * 16) - 8;
    if (!air) {
      while (ty < ctx.world.height - 1 && !ctx.world.isSolid(tx, ty + 1)) ty++;
    }
    const x = tx * TILE + 8 - e.w / 2;
    const y = (ty + 1) * TILE - e.h;
    if (rectHitsSolid(ctx.world, x, y, e.w, e.h)) continue;
    ctx.particles.emit(e.cx, e.cy, { count: 16, color: e.def.sprite.colors[1], speed: [1, 3], glow: true, gravity: 0 });
    e.x = x;
    e.y = y;
    e.vx = e.vy = 0;
    ctx.particles.emit(e.cx, e.cy, { count: 16, color: e.def.sprite.colors[1], speed: [1, 3], glow: true, gravity: 0 });
    ctx.audio.play('teleport', { x: e.cx, y: e.cy, volume: 0.5 });
    return true;
  }
  return false;
}
