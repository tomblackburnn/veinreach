import { Enemy } from '../enemies/Enemy';
import type { GameContext } from '../../core/context';
import type { BossDef } from '../../data/bosses';
import type { EnemyDef } from '../../data/enemies';
import type { HitInfo } from '../Actor';
import { updateHazards, renderHazards, type Hazard } from './hazards';

function asEnemyDef(b: BossDef): EnemyDef {
  return {
    id: b.id, name: b.name, life: b.life, damage: b.damage, defense: b.defense, kbResist: 1, w: b.w, h: b.h,
    ai: 'walker', sprite: { kind: 'blob', colors: b.colors }, loot: b.loot, spawn: [], flying: true, immune: ['burning', 'poisoned', 'chilled'],
  };
}

/**
 * Base class for multi-phase bosses: attack state machine, phase transitions
 * with invulnerability windows, telegraphed hazards, retreat rules and a
 * staged death sequence.
 */
export abstract class Boss extends Enemy {
  readonly bdef: BossDef;
  phase = 1;
  attack = 'intro';
  attackT = 0;
  hazards: Hazard[] = [];
  /** Death sequence countdown (ticks). */
  dying = 0;
  /** Temporarily immune (phase transitions, burrowing). */
  shielded = 0;
  private fleeT = 0;
  protected lastAttack = '';
  /** Thresholds (fraction of life) at which phases 2, 3... begin. */
  protected phaseThresholds: number[] = [0.5];

  constructor(def: BossDef, x: number, y: number) {
    super(asEnemyDef(def), x, y);
    this.bdef = def;
    this.isBoss = true;
    this.despawnable = false;
    this.kbResist = 1;
    this.setCenter(x, y);
  }

  get lifeFrac(): number {
    return this.life / this.maxLife;
  }

  setAttack(a: string): void {
    this.lastAttack = this.attack;
    this.attack = a;
    this.attackT = 0;
  }

  /** Choose a different attack from a list. */
  protected pick(options: string[]): string {
    const pool = options.filter((o) => o !== this.lastAttack && o !== this.attack);
    const list = pool.length ? pool : options;
    return list[Math.floor(Math.random() * list.length)];
  }

  protected angleToPlayer(ctx: GameContext, fromX = this.cx, fromY = this.cy): number {
    return Math.atan2(ctx.player.cy - fromY, ctx.player.cx - fromX);
  }

  protected distToPlayer(ctx: GameContext): number {
    return Math.hypot(ctx.player.cx - this.cx, ctx.player.cy - this.cy);
  }

  protected fire(ctx: GameContext, id: string, x: number, y: number, angle: number, speed: number, dmgMul = 0.8): void {
    ctx.spawnProjectile(id, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, { damage: Math.round(this.damage * dmgMul), knockback: 4, friendly: false, owner: this });
  }

  protected ring(ctx: GameContext, id: string, n: number, speed: number, offset = 0, dmgMul = 0.7): void {
    for (let i = 0; i < n; i++) this.fire(ctx, id, this.cx, this.cy, offset + (i / n) * Math.PI * 2, speed, dmgMul);
  }

  /** Should the boss leave (player dead/far, wrong time)? */
  protected shouldFlee(ctx: GameContext): string | null {
    if (ctx.player.dead) return `${this.bdef.name} has claimed another victim.`;
    if (this.distToPlayer(ctx) > 16 * 160) return `${this.bdef.name} has lost interest.`;
    return null;
  }

  override hurt(ctx: GameContext, h: HitInfo): number {
    if (this.dying > 0 || this.fleeT > 0) return 0;
    if (this.shielded > 0) {
      if (ctx.tick % 10 === 0) ctx.text.add('Immune', this.cx, this.y, '#9aa0b0', 8, 25);
      return 0;
    }
    return super.hurt(ctx, { ...h, knockback: 0 });
  }

  override update(ctx: GameContext): void {
    this.age++;
    this.frameTime++;
    this.attackT++;
    if (this.dying > 0) {
      this.deathSequence(ctx);
      return;
    }
    if (this.fleeT > 0) {
      this.fleeT++;
      this.y -= 6;
      this.harmful = false;
      if (this.fleeT > 120) this.removed = true;
      return;
    }
    this.tickStatus(ctx, () => true);
    if (this.dead) return;
    if (this.shielded > 0) this.shielded--;
    const why = this.shouldFlee(ctx);
    if (why) {
      this.fleeT = 1;
      this.hazards = [];
      ctx.message(why, '#c0a0ff');
      return;
    }
    // Phase transitions.
    const next = 1 + this.phaseThresholds.filter((t) => this.lifeFrac <= t).length;
    if (next > this.phase) {
      this.phase = next;
      this.onPhase(ctx, next);
    }
    this.think(ctx);
    this.hazards = updateHazards(ctx, this.hazards);
    this.contact(ctx);
  }

  protected onPhase(ctx: GameContext, phase: number): void {
    this.shielded = 90;
    ctx.shake(0.5);
    ctx.audio.play('bossRoar');
    ctx.particles.emit(this.cx, this.cy, { count: 60, colors: this.bdef.colors, speed: [2, 7], life: [30, 60], glow: true, gravity: 0 });
    void phase;
  }

  protected abstract think(ctx: GameContext): void;
  protected abstract draw(g: CanvasRenderingContext2D, ctx: GameContext): void;

  protected override onHurt(ctx: GameContext): void {
    ctx.audio.play('enemyHurt', { x: this.cx, y: this.cy, pitch: 0.6 });
    ctx.particles.emit(this.cx, this.cy, { count: 4, color: this.bdef.colors[0], speed: [1, 3], life: [15, 30] });
  }

  protected override onDeath(ctx: GameContext): void {
    this.dying = 150;
    this.harmful = false;
    this.hazards = [];
    ctx.audio.play('bossDie', { x: this.cx, y: this.cy });
    for (const p of ctx.entities.projectiles) if (!p.friendly) p.removed = true;
  }

  private deathSequence(ctx: GameContext): void {
    this.dying--;
    this.vx *= 0.9;
    this.vy *= 0.9;
    if (this.dying % 6 === 0) {
      ctx.particles.emit(this.cx + (Math.random() - 0.5) * this.w, this.cy + (Math.random() - 0.5) * this.h, { count: 14, colors: this.bdef.colors, speed: [1, 4], glow: true, life: [20, 40], gravity: 0 });
      ctx.audio.play('explosion', { x: this.cx, y: this.cy, volume: 0.35, pitch: 0.8 + Math.random() * 0.5 });
    }
    ctx.shake(0.08);
    if (this.dying <= 0) {
      ctx.particles.emit(this.cx, this.cy, { count: 150, colors: [...this.bdef.colors, '#ffffff'], speed: [2, 10], life: [40, 90], glow: true, gravity: 0.03, jitter: this.w / 2 });
      ctx.shake(0.9);
      ctx.audio.play('explosion', { x: this.cx, y: this.cy, volume: 1, pitch: 0.5 });
      this.dropLoot(ctx);
      this.removed = true;
      ctx.bosses.onDefeated(ctx, this);
    }
  }

  override render(g: CanvasRenderingContext2D, ctx: GameContext): void {
    renderHazards(g, this.hazards, ctx.tick);
    g.save();
    if (this.fleeT > 0) g.globalAlpha = Math.max(0, 1 - this.fleeT / 120);
    if (this.dying > 0) {
      g.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      g.globalAlpha = Math.min(1, this.dying / 60 + 0.3);
    }
    if (this.hitFlash > 0 && this.hitFlash % 4 < 2) g.filter = 'brightness(1.8)';
    if (this.shielded > 0 && this.attack !== 'burrow' && this.attack !== 'intro') {
      g.globalAlpha *= 0.7 + Math.sin(ctx.tick * 0.5) * 0.3;
    }
    this.draw(g, ctx);
    g.restore();
  }
}
