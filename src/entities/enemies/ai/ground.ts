import type { AIController } from './AIController';
import type { Enemy } from '../Enemy';
import type { GameContext } from '../../../core/context';
import { p, gravity, physics, walk, distToPlayer, dirToPlayer, canSeePlayer, shootAt } from './helpers';
import { approach } from '../../../utils/math';

const TILE = 16;

/** Hops toward the player at intervals (gloops). */
export const jumperAI: AIController = {
  update(e, ctx) {
    gravity(e, ctx);
    if (e.onGround) {
      e.vx = approach(e.vx, 0, 0.3);
      e.mem.t = (e.mem.t ?? Math.random() * 60) + 1;
      if (e.mem.t >= p(e, 'interval', 80)) {
        e.mem.t = 0;
        const chase = distToPlayer(e, ctx) < 30 * TILE && !ctx.player.dead;
        const dir = chase ? dirToPlayer(e, ctx) : Math.random() < 0.5 ? -1 : 1;
        const big = chase && Math.random() < 0.35;
        e.vy = -p(e, 'jump', 6.5) * (big ? 1.25 : 1);
        e.vx = dir * p(e, 'hop', 2.2) * e.buffs.speedMul();
        e.facing = dir > 0 ? 1 : -1;
        e.setState('jump');
      } else e.setState('idle');
    }
    const res = physics(e, ctx, false);
    if (res.hitX) e.vx = -e.vx * 0.5;
    if (res.landed) ctx.particles.dust(e.cx, e.bottom, e.def.sprite.colors[1], 3);
  },
};

/** Walks toward the player, jumps obstacles; wanders when no player nearby. */
export const walkerAI: AIController = {
  update(e, ctx) {
    const d = distToPlayer(e, ctx);
    let dir: number;
    if (d < 45 * TILE && !ctx.player.dead) {
      dir = dirToPlayer(e, ctx);
      // Unstick: if not making progress, briefly reverse.
      if (Math.abs(e.vx) < 0.2 && e.onGround) e.mem.stuck = (e.mem.stuck ?? 0) + 1;
      else e.mem.stuck = 0;
      if ((e.mem.stuck ?? 0) > 90) {
        e.mem.reverse = 60;
        e.mem.stuck = 0;
      }
      if ((e.mem.reverse ?? 0) > 0) {
        e.mem.reverse!--;
        dir = -dir;
      }
      e.setState('chase');
    } else {
      if (e.stateTime % 180 === 0) e.mem.wander = Math.random() < 0.3 ? 0 : Math.random() < 0.5 ? -1 : 1;
      dir = e.mem.wander ?? 0;
      e.setState('wander');
    }
    walk(e, ctx, dir, p(e, 'speed', 1) * (e.state === 'wander' ? 0.5 : 1), p(e, 'jump', 6.5));
    const spore = p(e, 'spore', 0);
    if (spore && d < spore * 1.5 && e.age % 130 === 0) {
      for (let i = 0; i < 3; i++) ctx.spawnProjectile('enemy_spore', e.cx, e.y + 4, (Math.random() - 0.5) * 3, -1.5 - Math.random(), { damage: e.def.projectileDamage ?? 14, knockback: 1, friendly: false, owner: e, onHit: e.def.onHit });
    }
  },
};

/** Patrols, notices the player, winds up, then charges in a straight line. */
export const chargerAI: AIController = {
  update(e, ctx) {
    const sight = p(e, 'sight', 200);
    switch (e.state) {
      case 'idle':
      case 'patrol': {
        if (e.stateTime % 150 === 0) e.mem.dir = Math.random() < 0.5 ? -1 : 1;
        walk(e, ctx, e.mem.dir ?? 1, p(e, 'speed', 1), p(e, 'jump', 6));
        if (e.stateTime > 20 && canSeePlayer(e, ctx, sight)) e.setState('notice');
        else e.setState('patrol');
        break;
      }
      case 'notice':
        e.facing = dirToPlayer(e, ctx) > 0 ? 1 : -1;
        walk(e, ctx, 0, 0, 0, 0.3);
        if (e.stateTime > 25) {
          e.mem.dir = dirToPlayer(e, ctx);
          e.setState('charge');
          ctx.audio.play('bossAttack', { x: e.cx, y: e.cy, volume: 0.3, pitch: 1.6 });
        }
        break;
      case 'charge': {
        const jumped = walk(e, ctx, e.mem.dir ?? 1, p(e, 'charge', 4), p(e, 'jump', 6.5), 0.4);
        if (e.stateTime % 4 === 0 && e.onGround) ctx.particles.dust(e.cx, e.bottom, '#9a8a7a', 1);
        const passed = (e.mem.dir ?? 1) * (ctx.player.cx - e.cx) < -64;
        if (e.stateTime > 100 || passed || (!jumped && Math.abs(e.vx) < 0.5 && e.stateTime > 10)) e.setState('recover');
        break;
      }
      case 'recover':
        walk(e, ctx, 0, 0, 0, 0.2);
        if (e.stateTime > 35) e.setState(canSeePlayer(e, ctx, sight) ? 'notice' : 'patrol');
        break;
      default:
        e.setState('patrol');
    }
  },
};

/** Armoured tortoise: hides in its shell (high defense) then rolls at the player. */
export const rollerAI: AIController = {
  update(e, ctx) {
    const d = distToPlayer(e, ctx);
    const base = e.def.defense;
    switch (e.state) {
      case 'hide':
        e.defense = base * 3;
        walk(e, ctx, 0, 0, 0, 0.3);
        if (e.stateTime > 45) {
          e.mem.dir = dirToPlayer(e, ctx);
          e.setState('roll');
        }
        break;
      case 'roll': {
        e.defense = base * 2;
        gravity(e, ctx);
        e.vx = approach(e.vx, (e.mem.dir ?? 1) * p(e, 'roll', 5), 0.3);
        const res = physics(e, ctx);
        if (res.hitX) {
          e.mem.dir = -(e.mem.dir ?? 1);
          e.vy = -4;
          ctx.shake(0.05);
          ctx.audio.play('stone', { x: e.cx, y: e.cy });
        }
        if (e.stateTime > 150) e.setState('walk');
        break;
      }
      default:
        e.defense = base;
        walk(e, ctx, d < 30 * TILE ? dirToPlayer(e, ctx) : 0, p(e, 'speed', 0.7), 5);
        e.setState('walk');
        if (d < 10 * TILE && e.stateTime > 90 && canSeePlayer(e, ctx, 12 * TILE)) e.setState('hide');
    }
  },
};

/** Buried in sand until the player comes close, then erupts and hunts. */
export const burrowAmbushAI: AIController = {
  update(e, ctx) {
    const d = distToPlayer(e, ctx);
    if (e.state === 'idle' || e.state === 'buried') {
      e.setState('buried');
      e.hittable = false;
      e.harmful = false;
      gravity(e, ctx);
      physics(e, ctx);
      e.vx = 0;
      if (e.age % 20 === 0) ctx.particles.dust(e.cx, e.bottom, '#dcc37a', 1);
      if (d < p(e, 'trigger', 120) && !ctx.player.dead) {
        e.setState('emerge');
        e.vy = -7;
        e.hittable = true;
        e.harmful = true;
        ctx.particles.dust(e.cx, e.bottom, '#dcc37a', 20);
        ctx.audio.play('soil', { x: e.cx, y: e.cy, volume: 1 });
      }
      return;
    }
    walk(e, ctx, dirToPlayer(e, ctx), p(e, 'speed', 2.4), 7);
    if (canSeePlayer(e, ctx, 400)) e.mem.lost = 0;
    else e.mem.lost = (e.mem.lost ?? 0) + 1;
    if ((e.mem.lost ?? 0) > 360 && e.onGround) {
      e.setState('buried');
      e.mem.lost = 0;
    }
  },
};

/** Spider: climbs walls toward the player and drops from ceilings. */
export const climberAI: AIController = {
  update(e, ctx) {
    const dir = ctx.player.dead ? (e.mem.dir ?? 1) : dirToPlayer(e, ctx);
    const speed = p(e, 'speed', 2) * e.buffs.speedMul();
    const tx = Math.floor((dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE);
    const wallAhead = ctx.world.isSolid(tx, Math.floor(e.cy / TILE)) || ctx.world.isSolid(tx, Math.floor((e.bottom - 2) / TILE));
    const ceiling = ctx.world.isSolid(Math.floor(e.cx / TILE), Math.floor((e.y - 2) / TILE));
    const playerBelow = ctx.player.cy > e.cy + 32 && Math.abs(ctx.player.cx - e.cx) < 40;
    if (wallAhead && ctx.player.cy < e.bottom + 8) {
      e.setState('climb');
      e.vy = -speed;
      e.vx = dir * 0.5;
    } else if (e.state === 'ceiling' && !playerBelow && ceiling) {
      e.vy = -0.5;
      e.vx = approach(e.vx, dir * speed, 0.2);
    } else if (ceiling && !e.onGround && !playerBelow && e.state === 'climb') {
      e.setState('ceiling');
    } else {
      if (e.state !== 'walk') e.setState('walk');
      e.vx = approach(e.vx, dir * speed, 0.2);
      gravity(e, ctx);
    }
    e.facing = dir > 0 ? 1 : -1;
    const res = physics(e, ctx);
    if (res.hitY && e.state === 'climb' && res.hitCeiling) e.setState('ceiling');
    if (e.state === 'ceiling' && (playerBelow || !ceiling)) e.setState('walk');
  },
};

/** Disguised as a chest until the player approaches or strikes it. */
export const mimicAI: AIController = {
  update(e, ctx) {
    const d = distToPlayer(e, ctx);
    if (e.state === 'idle' || e.state === 'disguised') {
      e.setState('disguised');
      e.harmful = false;
      gravity(e, ctx);
      physics(e, ctx);
      e.vx = 0;
      if (d < 56 && !ctx.player.dead) wake(e, ctx);
      return;
    }
    gravity(e, ctx);
    if (e.onGround) {
      e.vx = approach(e.vx, 0, 0.5);
      if (e.stateTime > 25) {
        e.vy = -p(e, 'jump', 8);
        e.vx = dirToPlayer(e, ctx) * p(e, 'speed', 3);
        e.facing = e.vx > 0 ? 1 : -1;
        e.stateTime = 0;
      }
    }
    physics(e, ctx);
  },
  onHurt(e, ctx) {
    if (e.state === 'disguised') wake(e, ctx);
  },
};

function wake(e: Enemy, ctx: GameContext): void {
  e.setState('awake');
  e.harmful = true;
  ctx.audio.play('chest', { x: e.cx, y: e.cy, pitch: 0.6 });
  ctx.message('The chest was alive!', '#ff6a6a');
}

/** Keeps its distance and fires arced projectiles. */
export const archerAI: AIController = {
  update(e, ctx) {
    const d = distToPlayer(e, ctx);
    const range = p(e, 'range', 320);
    const see = canSeePlayer(e, ctx, range * 1.3);
    let dir = 0;
    if (!ctx.player.dead && d < 50 * TILE) {
      if (!see || d > range) dir = dirToPlayer(e, ctx);
      else if (d < range * 0.4) dir = -dirToPlayer(e, ctx);
    }
    walk(e, ctx, dir, p(e, 'speed', 1.1), p(e, 'jump', 6.5));
    if (see) e.facing = dirToPlayer(e, ctx) > 0 ? 1 : -1;
    e.mem.cd = (e.mem.cd ?? p(e, 'cooldown', 100)) - 1;
    if (see && e.mem.cd <= 0) {
      e.mem.cd = p(e, 'cooldown', 100) + Math.random() * 30;
      e.setState('shoot');
      const lift = -Math.min(0.35, d * 0.0007);
      shootAt(e, ctx, 8.5, lift);
      ctx.audio.play('bow', { x: e.cx, y: e.cy, volume: 0.6 });
    } else if (e.stateTime > 20) e.setState(dir ? 'walk' : 'idle');
  },
};
