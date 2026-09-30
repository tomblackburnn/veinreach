import { Entity, type LightSource } from './Entity';
import type { GameContext } from '../core/context';
import type { ProjectileDef } from '../data/projectiles';
import type { DamageClass } from '../items/types';
import type { Actor } from './Actor';
import { moveBody } from '../physics/Physics';
import { rectsOverlap, angleLerp } from '../utils/math';
import { shade } from '../utils/color';

export interface ProjectileSpawn {
  damage: number;
  knockback: number;
  friendly: boolean;
  critChance?: number;
  owner?: Entity | null;
  damageClass?: DamageClass;
  onHit?: { buff: string; seconds: number; chance: number };
  /** Multiply the def lifetime. */
  lifeMul?: number;
  scale?: number;
  /** Orbit/anchor behaviour parameters. */
  orbit?: { radius: number; speed: number; angle: number; center: Entity };
  /** Multiplayer: a copy of another player's shot, drawn but harmless here. */
  ghost?: boolean;
  /** Multiplayer: created from a network message (never re-broadcast). */
  fromNet?: boolean;
  /** Spawned by another projectile (splits); the other games make their own. */
  derived?: boolean;
}

/**
 * Generalised projectile used by players, enemies and bosses. Behaviour is
 * selected by the def (default ballistic, boomerang, spear, minion, orbit).
 */
export class Projectile extends Entity {
  readonly kind = 'projectile';
  readonly hit = new Set<number>();
  pierceLeft: number;
  bouncesLeft: number;
  life: number;
  rotation = 0;
  private returning = false;
  private target: Actor | null = null;
  scale: number;
  private attackCooldown = 0;

  constructor(
    readonly def: ProjectileDef,
    x: number,
    y: number,
    vx: number,
    vy: number,
    readonly o: ProjectileSpawn,
  ) {
    super(def.size * (o.scale ?? 1), def.size * (o.scale ?? 1));
    this.scale = o.scale ?? 1;
    this.setCenter(x, y);
    this.vx = vx;
    this.vy = vy;
    this.pierceLeft = def.pierce ?? 0;
    this.bouncesLeft = def.bounces ?? 0;
    this.life = Math.round(def.lifetime * (o.lifeMul ?? 1));
    this.rotation = Math.atan2(vy, vx);
  }

  get friendly(): boolean {
    return this.o.friendly;
  }

  update(ctx: GameContext): void {
    this.age++;
    this.life--;
    if (this.life <= 0) {
      this.kill(ctx);
      return;
    }
    const d = this.def;
    switch (d.behavior) {
      case 'boomerang':
        this.updateBoomerang(ctx);
        break;
      case 'spear':
        this.updateSpear();
        break;
      case 'minion':
        this.updateMinion(ctx);
        break;
      case 'orbit':
        this.updateOrbit();
        break;
      default:
        this.updateBallistic(ctx);
    }
    if (this.removed) return;
    if (d.rotate === 'spin') this.rotation += 0.3;
    else if (d.rotate === 'velocity' && (this.vx || this.vy)) this.rotation = Math.atan2(this.vy, this.vx);
    if (d.trail && this.age % 2 === 0) {
      ctx.particles.emit(this.cx, this.cy, { count: 1, color: d.trail, speed: [0, 0.4], life: [8, 18], size: [1, 2.5], gravity: 0, glow: true, jitter: this.w / 3 });
    }
    this.checkHits(ctx);
  }

  private updateBallistic(ctx: GameContext): void {
    const d = this.def;
    if (d.gravity) this.vy += d.gravity;
    if (d.drag) {
      this.vx *= d.drag;
      this.vy *= d.drag;
    }
    if (d.homing) this.home(ctx, d.homing, d.homingRange ?? 400);
    if (d.tileCollide === false) {
      this.x += this.vx;
      this.y += this.vy;
    } else {
      const pvx = this.vx;
      const pvy = this.vy;
      const res = moveBody(ctx.world, this, { platforms: false });
      if (res.hitX || res.hitY) {
        if (this.bouncesLeft > 0) {
          this.bouncesLeft--;
          if (res.hitX) this.vx = -pvx * 0.9;
          else this.vx = pvx;
          if (res.hitY) this.vy = -pvy * 0.8;
          else this.vy = pvy;
        } else {
          ctx.particles.dust(this.cx, this.cy, d.color, 4);
          this.kill(ctx);
        }
      }
    }
    if (this.x < 0 || this.y < 0 || this.x > ctx.world.width * 16 || this.y > ctx.world.height * 16) this.removed = true;
  }

  private home(ctx: GameContext, turn: number, range: number): void {
    const t = this.findTarget(ctx, range);
    if (!t) return;
    const speed = Math.hypot(this.vx, this.vy) || 4;
    const cur = Math.atan2(this.vy, this.vx);
    const want = Math.atan2(t.cy - this.cy, t.cx - this.cx);
    const a = angleLerp(cur, want, Math.min(1, turn * 3));
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
  }

  private findTarget(ctx: GameContext, range: number): Actor | null {
    if (!this.friendly) return ctx.player.dead ? null : ctx.player;
    if (this.target && !this.target.dead && !this.target.removed && Math.hypot(this.target.cx - this.cx, this.target.cy - this.cy) < range * 1.2) return this.target;
    this.target = ctx.entities.nearestEnemy(this.cx, this.cy, range);
    return this.target;
  }

  private updateBoomerang(ctx: GameContext): void {
    const owner = this.o.owner;
    if (!owner) {
      this.removed = true;
      return;
    }
    if (!this.returning && this.age > 28) this.returning = true;
    if (this.returning) {
      const dx = owner.cx - this.cx;
      const dy = owner.cy - this.cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 16) {
        this.removed = true;
        return;
      }
      const sp = 12;
      this.vx += ((dx / dist) * sp - this.vx) * 0.2;
      this.vy += ((dy / dist) * sp - this.vy) * 0.2;
      this.x += this.vx;
      this.y += this.vy;
    } else {
      const res = moveBody(ctx.world, this, { platforms: false });
      if (res.hitX || res.hitY) {
        this.returning = true;
        ctx.audio.play('stone', { x: this.cx, y: this.cy, volume: 0.4 });
      }
    }
  }

  private updateSpear(): void {
    const owner = this.o.owner;
    if (!owner) {
      this.removed = true;
      return;
    }
    const total = this.def.lifetime;
    const t = 1 - this.life / total;
    const ext = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    const len = (this.def.length ?? 48) * (0.35 + ext * 0.75);
    const a = Math.atan2(this.vy, this.vx);
    this.rotation = a;
    this.setCenter(owner.cx + Math.cos(a) * len, owner.cy - 4 + Math.sin(a) * len);
  }

  private updateMinion(ctx: GameContext): void {
    const owner = this.o.owner;
    if (!owner || (owner as Actor).dead) {
      this.removed = true;
      return;
    }
    if (Math.hypot(owner.cx - this.cx, owner.cy - this.cy) > 1400) this.setCenter(owner.cx, owner.cy - 30);
    const t = this.findTarget(ctx, 500);
    if (this.attackCooldown > 0) this.attackCooldown--;
    let tx: number;
    let ty: number;
    let speed: number;
    if (t) {
      tx = t.cx;
      ty = t.cy;
      speed = 9;
      // Allow re-hitting the same target after a cooldown.
      if (this.attackCooldown <= 0 && this.hit.size) {
        this.hit.clear();
        this.attackCooldown = 25;
      }
    } else {
      const slot = (this.id % 5) - 2;
      tx = owner.cx - owner.facing * 30 + slot * 14;
      ty = owner.y - 20 + Math.sin(this.age * 0.05 + this.id) * 6;
      speed = 5;
    }
    const dx = tx - this.cx;
    const dy = ty - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.min(speed, dist * 0.15);
    this.vx += ((dx / dist) * want - this.vx) * 0.12;
    this.vy += ((dy / dist) * want - this.vy) * 0.12;
    this.x += this.vx;
    this.y += this.vy;
    this.life = Math.max(this.life, 60);
  }

  private updateOrbit(): void {
    const o = this.o.orbit;
    if (!o || o.center.removed) {
      this.removed = true;
      return;
    }
    o.angle += o.speed;
    this.setCenter(o.center.cx + Math.cos(o.angle) * o.radius, o.center.cy + Math.sin(o.angle) * o.radius);
  }

  private checkHits(ctx: GameContext): void {
    if (this.o.damage <= 0 || this.o.ghost) return;
    const r = this.rect();
    if (this.friendly) {
      for (const e of ctx.entities.enemies) {
        if (e.dead || e.removed || this.hit.has(e.id) || !e.hittable) continue;
        if (!rectsOverlap(r, e.rect())) continue;
        this.hit.add(e.id);
        this.applyHit(ctx, e);
        if (this.removed) return;
      }
    } else {
      const p = ctx.player;
      if (!p.dead && !this.hit.has(p.id) && rectsOverlap(r, p.rect())) {
        this.hit.add(p.id);
        const dealt = p.hurt(ctx, { damage: this.o.damage, knockback: this.o.knockback, dirX: Math.sign(this.vx) || 1, kind: 'environment', source: this, immunity: 40, buff: this.o.onHit });
        if (dealt > 0 && this.def.behavior !== 'minion') this.consumePierce(ctx);
      }
    }
  }

  private applyHit(ctx: GameContext, target: Actor): void {
    const dir = this.def.behavior === 'spear' || this.def.behavior === 'minion' ? Math.sign(target.cx - (this.o.owner?.cx ?? this.cx)) || 1 : Math.sign(this.vx) || 1;
    target.hurt(ctx, {
      damage: this.o.damage,
      knockback: this.o.knockback,
      dirX: dir,
      critChance: this.o.critChance,
      kind: this.o.damageClass,
      source: this.o.owner,
      buff: this.o.onHit,
    });
    ctx.particles.sparks(this.cx, this.cy, this.def.color, 5);
    if (this.def.behavior !== 'minion') this.consumePierce(ctx);
  }

  private consumePierce(ctx: GameContext): void {
    if (this.pierceLeft === -1 || this.def.behavior === 'boomerang' || this.def.behavior === 'spear') return;
    this.pierceLeft--;
    if (this.pierceLeft < 0) this.kill(ctx);
  }

  /** Die with side effects (explosions, splits). */
  kill(ctx: GameContext): void {
    if (this.removed) return;
    this.removed = true;
    const d = this.def;
    if (d.explode) {
      const R = d.explode.radius * this.scale;
      ctx.particles.emit(this.cx, this.cy, { count: 30, colors: [d.color, d.color2 ?? '#ffffff', '#ffe070'], speed: [1, 5], life: [15, 35], size: [1.5, 3.5], glow: true, gravity: 0.02 });
      ctx.particles.smoke(this.cx, this.cy, 8);
      ctx.audio.play('explosion', { x: this.cx, y: this.cy, volume: 0.6 });
      ctx.shake(0.12);
      const targets: Actor[] = this.o.ghost || this.o.damage <= 0 ? [] : this.friendly ? ctx.entities.enemies.filter((e) => e.hittable) : [ctx.player];
      for (const t of targets) {
        if (t.dead || this.hit.has(t.id)) continue;
        if (Math.hypot(t.cx - this.cx, t.cy - this.cy) < R + t.w / 2) {
          t.hurt(ctx, { damage: this.o.damage, knockback: this.o.knockback + 3, dirX: Math.sign(t.cx - this.cx) || 1, critChance: this.o.critChance, source: this.o.owner, buff: this.o.onHit, immunity: this.friendly ? undefined : 40 });
        }
      }
    }
    if (d.split) {
      for (let i = 0; i < d.split.count; i++) {
        const a = (i / d.split.count) * Math.PI * 2;
        ctx.spawnProjectile(d.split.id, this.cx, this.cy, Math.cos(a) * d.split.speed, Math.sin(a) * d.split.speed, { ...this.o, damage: Math.round(this.o.damage * 0.6), derived: true });
      }
    }
  }

  override light(): LightSource | null {
    const l = this.def.light;
    return l ? { x: this.cx, y: this.cy, r: l[0], g: l[1], b: l[2], radius: 5 } : null;
  }

  render(g: CanvasRenderingContext2D): void {
    const d = this.def;
    const s = this.scale;
    g.save();
    g.translate(this.cx, this.cy);
    g.rotate(this.rotation);
    const c = d.color;
    const c2 = d.color2 ?? shade(c, 1.4);
    switch (d.shape) {
      case 'arrow': {
        const L = (d.length ?? 16) * s;
        g.fillStyle = '#8b5a2b';
        g.fillRect(-L / 2, -1, L, 2);
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(L / 2 + 4, 0);
        g.lineTo(L / 2 - 2, -3);
        g.lineTo(L / 2 - 2, 3);
        g.fill();
        g.fillStyle = c2;
        g.fillRect(-L / 2 - 2, -3, 5, 2);
        g.fillRect(-L / 2 - 2, 1, 5, 2);
        break;
      }
      case 'pellet':
        g.fillStyle = c2;
        g.fillRect(-(d.length ?? 8), -1, d.length ?? 8, 2);
        g.fillStyle = c;
        g.fillRect(-2, -2, 4, 4);
        break;
      case 'spear': {
        const L = (d.length ?? 48) * s;
        g.fillStyle = c2;
        g.fillRect(-L + 8, -1.5, L - 8, 3);
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(10, 0);
        g.lineTo(-2, -5);
        g.lineTo(-2, 5);
        g.fill();
        break;
      }
      case 'boomerang':
        g.fillStyle = c;
        g.fillRect(-8, -2, 16, 4);
        g.fillRect(-2, -8, 4, 16);
        g.fillStyle = c2;
        g.fillRect(-2, -2, 4, 4);
        break;
      case 'shard':
      case 'thorn':
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(this.w * 0.8, 0);
        g.lineTo(-this.w * 0.6, -this.h * 0.35);
        g.lineTo(-this.w * 0.3, 0);
        g.lineTo(-this.w * 0.6, this.h * 0.35);
        g.fill();
        g.fillStyle = c2;
        g.fillRect(-2, -1, this.w * 0.6, 2);
        break;
      case 'leaf':
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(0, 0, this.w * 0.6, this.h * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c2;
        g.fillRect(-this.w * 0.5, -0.5, this.w, 1);
        break;
      case 'star': {
        g.fillStyle = c;
        g.beginPath();
        const R = this.w * 0.7;
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5;
          const r = i % 2 ? R * 0.45 : R;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.fill();
        g.fillStyle = c2;
        g.fillRect(-2, -2, 4, 4);
        break;
      }
      case 'rock':
        g.fillStyle = c2;
        g.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        g.fillStyle = c;
        g.fillRect(-this.w / 2, -this.h / 2, this.w - 2, this.h - 2);
        g.fillStyle = shade(c, 1.3);
        g.fillRect(-this.w / 2 + 1, -this.h / 2 + 1, 3, 2);
        break;
      case 'beam': {
        const L = (d.length ?? 24) * s;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = c;
        g.fillRect(-L, -2.5, L, 5);
        g.fillStyle = c2;
        g.fillRect(-L, -1, L, 2);
        break;
      }
      case 'ring':
        g.strokeStyle = c;
        g.lineWidth = 3;
        g.globalAlpha = Math.min(1, this.life / 10);
        g.beginPath();
        g.arc(-this.w * 0.3, 0, this.w * 0.7, -1.1, 1.1);
        g.stroke();
        g.strokeStyle = c2;
        g.lineWidth = 1;
        g.stroke();
        break;
      case 'wisp':
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = c;
        g.globalAlpha = 0.5;
        g.beginPath();
        g.arc(0, 0, this.w * 0.6 + Math.sin(this.age * 0.2), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = c2;
        g.fillRect(-3, -3, 6, 6);
        break;
      case 'fireball':
      case 'orb':
      case 'spark':
      case 'bolt':
      default: {
        const R = this.w / 2;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = c;
        g.globalAlpha = 0.45;
        g.beginPath();
        g.arc(0, 0, R + 2, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c2;
        g.beginPath();
        g.arc(0, 0, R * 0.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }
}
