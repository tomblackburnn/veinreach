import type { AIController } from './AIController';
import type { Enemy } from '../Enemy';
import type { GameContext } from '../../../core/context';
import { rectHitsSolid } from '../../../physics/Physics';
import { p } from './helpers';

/** Body segment: follows the segment ahead at a fixed spacing. Damage is routed to the head. */
export class WormBodyAI implements AIController {
  constructor(
    private prev: Enemy,
    private spacing: number,
  ) {}

  update(e: Enemy, ctx: GameContext): void {
    const head = e.head;
    if (!head || head.removed || head.dead) {
      e.removed = true;
      ctx.particles.emit(e.cx, e.cy, { count: 10, colors: e.def.sprite.colors, speed: [1, 3], life: [20, 40], gravity: 0.15 });
      return;
    }
    const dx = this.prev.cx - e.cx;
    const dy = this.prev.cy - e.cy;
    const d = Math.hypot(dx, dy) || 1;
    e.mem.rot = Math.atan2(dy, dx);
    if (d > this.spacing) {
      e.x += (dx / d) * (d - this.spacing);
      e.y += (dy / d) * (d - this.spacing);
    }
    e.hitFlash = Math.max(e.hitFlash, head.hitFlash > 6 ? 2 : 0);
  }
}

/**
 * Burrowing worm head. Steers freely while inside terrain and falls under
 * gravity when it breaches into open air — the classic burrower arc.
 */
export class WormHeadAI implements AIController {
  segments: Enemy[] = [];
  private wasInside = true;

  constructor(
    private count = 6,
    private spacing = 14,
  ) {}

  update(e: Enemy, ctx: GameContext): void {
    e.noClip = true;
    e.noGravity = true;
    if (!this.segments.length) this.spawnSegments(e, ctx);
    const pl = e.target;
    const inside = rectHitsSolid(ctx.world, e.x + 2, e.y + 2, e.w - 4, e.h - 4) || ctx.world.getWall(Math.floor(e.cx / 16), Math.floor(e.cy / 16)) !== 0 && e.def.id !== 'tunnelgrub';
    const speed = p(e, 'speed', 4.5) * e.buffs.speedMul();
    const turn = p(e, 'turn', 0.07);
    if (inside) {
      const tx = pl.dead ? e.cx + e.vx * 10 : pl.cx;
      const ty = pl.dead ? e.cy + 400 : pl.cy;
      const a = Math.atan2(ty - e.cy, tx - e.cx);
      e.vx += (Math.cos(a) * speed - e.vx) * turn;
      e.vy += (Math.sin(a) * speed - e.vy) * turn;
      if (e.age % 6 === 0) ctx.particles.dust(e.cx, e.cy, '#7a5a3a', 1);
    } else {
      e.vy = Math.min(e.vy + 0.22, 9);
      e.vx *= 0.995;
    }
    if (inside !== this.wasInside) {
      ctx.particles.dust(e.cx, e.cy, '#8a6a4a', 10);
      ctx.audio.play('soil', { x: e.cx, y: e.cy, volume: 0.8, pitch: 0.7 });
    }
    this.wasInside = inside;
    e.x += e.vx;
    e.y += e.vy;
    e.mem.rot = Math.atan2(e.vy, e.vx);
    e.mem.seg = 0;
    // Keep inside the world.
    e.x = Math.max(0, Math.min(ctx.world.width * 16 - e.w, e.x));
    e.y = Math.max(0, Math.min(ctx.world.height * 16 - e.h, e.y));
  }

  /** Mirror of another player's worm: face along the motion and grow a local body that follows. */
  puppetUpdate(e: Enemy, ctx: GameContext): void {
    e.mem.rot = Math.atan2(e.vy, e.vx);
    e.mem.seg = 0;
    if (!this.segments.length) this.spawnSegments(e, ctx);
  }

  private spawnSegments(e: Enemy, ctx: GameContext): void {
    let prev = e;
    for (let i = 0; i < this.count; i++) {
      const seg = ctx.spawnEnemy(e.def.id, e.cx, e.bottom);
      if (!seg) break;
      seg.head = e;
      seg.ai = new WormBodyAI(prev, this.spacing);
      seg.mem.seg = i === this.count - 1 ? 2 : 1;
      seg.noClip = true;
      seg.noGravity = true;
      seg.despawnable = false;
      seg.isBoss = e.isBoss;
      seg.damage = Math.round(e.damage * 0.7);
      seg.defense = e.defense;
      seg.setCenter(e.cx, e.cy + (i + 1) * 4);
      this.segments.push(seg);
      prev = seg;
    }
  }

  onDeath(_e: Enemy, _ctx: GameContext): void {
    for (const s of this.segments) s.removed = true;
  }
}
