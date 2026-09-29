import { Actor, type HitInfo } from '../Actor';
import type { GameContext } from '../../core/context';
import type { EnemyDef } from '../../data/enemies';
import type { AIController } from './ai/AIController';
import { createAI } from './ai';
import { rectsOverlap } from '../../utils/math';
import { rollLootTable } from '../../systems/LootSystem';
import { Rng } from '../../utils/random';
import { drawEnemy } from '../../rendering/sprites/enemySprites';
import type { LightSource } from '../Entity';
import { FLAGS } from '../../systems/ProgressionSystem';

let lootRng = new Rng((Date.now() >>> 0) ^ 0x9e3779b9);

/** Data-driven hostile creature. Behaviour comes from an AIController. */
export class Enemy extends Actor {
  readonly kind = 'enemy';
  readonly team = 'enemy';
  readonly def: EnemyDef;
  ai: AIController;
  /** Generic AI state machine fields. */
  state = 'idle';
  stateTime = 0;
  /** Scratch values for AI implementations. */
  readonly mem: Record<string, number> = {};
  damage: number;
  hittable = true;
  isBoss = false;
  /** Contact damage enabled. */
  harmful = true;
  noGravity = false;
  noClip = false;
  frameTime = 0;
  /** Segment bodies redirect damage to their head. */
  head: Enemy | null = null;
  despawnable = true;
  private farTicks = 0;

  constructor(def: EnemyDef, x: number, y: number, scale = 1) {
    super(def.w, def.h);
    this.def = def;
    this.x = x - def.w / 2;
    this.y = y - def.h;
    this.maxLife = Math.round(def.life * scale);
    this.life = this.maxLife;
    this.damage = Math.round(def.damage * (0.85 + scale * 0.15));
    this.defense = Math.round(def.defense * (0.8 + scale * 0.2));
    this.kbResist = def.kbResist;
    this.noGravity = !!def.flying;
    this.ai = createAI(def.ai, this);
  }

  get name(): string {
    return this.def.name;
  }

  setState(s: string): void {
    if (this.state !== s) {
      this.state = s;
      this.stateTime = 0;
    }
  }

  override hurt(ctx: GameContext, h: HitInfo): number {
    if (!this.hittable) return 0;
    if (this.head && !this.head.dead) return this.head.hurtFromSegment(ctx, h, this);
    return super.hurt(ctx, h);
  }

  /** Damage routed from a body segment: numbers show at the segment. */
  hurtFromSegment(ctx: GameContext, h: HitInfo, seg: Enemy): number {
    const ox = this.x;
    const oy = this.y;
    // Temporarily position text at the segment.
    const dealt = super.hurt(ctx, { ...h, knockback: 0, silent: true });
    if (dealt > 0) {
      ctx.text.damage(dealt, seg.cx, seg.y, false);
      seg.hitFlash = 8;
    }
    this.x = ox;
    this.y = oy;
    return dealt;
  }

  update(ctx: GameContext): void {
    this.age++;
    this.stateTime++;
    this.frameTime++;
    this.tickStatus(ctx, (id) => !!this.def.immune?.includes(id));
    if (this.dead) return;
    this.ai.update(this, ctx);
    if (this.removed) return;
    this.contact(ctx);
    this.checkDespawn(ctx);
  }

  /** Contact damage against the local player. */
  protected contact(ctx: GameContext): void {
    const p = ctx.player;
    if (this.harmful && !p.dead && p.immune <= 0 && rectsOverlap(this.rect(), p.rect())) {
      p.hurt(ctx, { damage: this.damage, knockback: 6, dirX: Math.sign(p.cx - this.cx) || 1, kind: 'contact', source: this, immunity: 40, buff: this.def.onHit });
      p.onContactWith(ctx, this);
    }
  }

  protected checkDespawn(ctx: GameContext): void {
    if (!this.despawnable || this.head) return;
    const p = ctx.player;
    const d = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    if (d > 16 * 110) this.farTicks++;
    else this.farTicks = 0;
    const dayBurn = this.def.nocturnal && ctx.time.isDay && ctx.world.zoneAt(Math.floor(this.cy / 16)) === 'surface' && d > 16 * 40;
    if (this.farTicks > 120 || dayBurn || p.dead && d > 16 * 60) this.removed = true;
  }

  protected onHurt(ctx: GameContext, _amount: number, _h: HitInfo): void {
    ctx.audio.play('enemyHurt', { x: this.cx, y: this.cy });
    ctx.particles.emit(this.cx, this.cy, { count: 5, color: this.def.sprite.colors[0], speed: [0.8, 2.5], life: [15, 30], size: [1.5, 3] });
    this.ai.onHurt?.(this, ctx);
  }

  protected onDeath(ctx: GameContext, h: HitInfo): void {
    this.removed = true;
    ctx.audio.play('enemyDie', { x: this.cx, y: this.cy });
    ctx.particles.emit(this.cx, this.cy, { count: 22, colors: this.def.sprite.colors, speed: [1, 4], life: [20, 45], size: [1.5, 3.5], gravity: 0.15, jitter: this.w / 2 });
    this.ai.onDeath?.(this, ctx);
    this.dropLoot(ctx);
    ctx.worldEvents.onEnemyKilled(this);
    void h;
  }

  dropLoot(ctx: GameContext): void {
    const flags = ctx.progression.flags;
    const luck = ctx.worldEvents.active?.id === 'gloamtide' ? 1.5 : 1;
    for (const s of rollLootTable(this.def.loot, lootRng, { flags, luck })) {
      const count = s.id === 'aurel' && flags.has(FLAGS.unsealed) ? Math.round(s.count * 1.5) : s.count;
      ctx.dropItem({ id: s.id, count }, this.cx, this.cy, (Math.random() - 0.5) * 3, -2 - Math.random() * 2);
    }
  }

  override light(): LightSource | null {
    const l = this.def.light;
    return l ? { x: this.cx, y: this.cy, r: l[0], g: l[1], b: l[2], radius: 5 } : null;
  }

  render(g: CanvasRenderingContext2D, ctx: GameContext): void {
    if (this.ai.render) this.ai.render(g, this, ctx);
    else drawEnemy(g, this);
  }
}

/** For tests: reseed loot rolls. */
export function reseedEnemyLoot(seed: number): void {
  lootRng = new Rng(seed);
}
