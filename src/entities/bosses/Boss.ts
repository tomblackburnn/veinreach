import { Enemy } from '../enemies/Enemy';
import type { GameContext } from '../../core/context';
import type { BossDef } from '../../data/bosses';
import type { EnemyDef } from '../../data/enemies';
import type { HitInfo } from '../Actor';
import { updateHazards, renderHazards, type Hazard } from './hazards';
import { nearestPlayer } from '../targeting';
import type { BossNet, HazardNet } from '../../multiplayer/protocol';

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
    return Math.atan2(this.target.cy - fromY, this.target.cx - fromX);
  }

  protected distToPlayer(ctx: GameContext): number {
    return Math.hypot(this.target.cx - this.cx, this.target.cy - this.cy);
  }

  protected fire(ctx: GameContext, id: string, x: number, y: number, angle: number, speed: number, dmgMul = 0.8): void {
    ctx.spawnProjectile(id, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, { damage: Math.round(this.damage * dmgMul), knockback: 4, friendly: false, owner: this });
  }

  protected ring(ctx: GameContext, id: string, n: number, speed: number, offset = 0, dmgMul = 0.7): void {
    for (let i = 0; i < n; i++) this.fire(ctx, id, this.cx, this.cy, offset + (i / n) * Math.PI * 2, speed, dmgMul);
  }

  /** Should the boss leave (player dead/far, wrong time)? */
  protected shouldFlee(ctx: GameContext): string | null {
    if (this.target.dead) return `${this.bdef.name} has claimed ${ctx.entities.remotes.length ? 'its victims' : 'another victim'}.`;
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
    if (this.puppet) {
      this.puppetBossUpdate(ctx);
      return;
    }
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
    this.target = nearestPlayer(ctx, this.cx, this.cy);
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
    this.localCollisions(ctx);
    this.contact(ctx);
  }

  /** Boss-specific damage to the local player (checked on every player's game). */
  protected localCollisions(_ctx: GameContext): void {}

  // ---- Multiplayer mirrors (see multiplayer/MobSync) ----

  /** A mirror of another player's boss: follow snapshots, and hurt our player with its body and hazards. */
  private puppetBossUpdate(ctx: GameContext): void {
    this.age++;
    this.frameTime++;
    this.attackT++;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.dying > 0) {
      this.deathSequence(ctx);
      return;
    }
    if (this.shielded > 0) this.shielded--;
    this.puppetMotion();
    if (this.fleeT > 0) {
      this.harmful = false;
      return;
    }
    this.target = nearestPlayer(ctx, this.cx, this.cy);
    this.onPuppetTick(ctx);
    this.hazards = updateHazards(ctx, this.hazards);
    this.localCollisions(ctx);
    this.contact(ctx);
  }

  /** Per-boss upkeep for mirrors (e.g. rebuilding the Serpent's body). */
  protected onPuppetTick(_ctx: GameContext): void {}

  /** Extra per-boss state other games need to draw it. */
  protected netExtra(): Record<string, number | boolean> | undefined {
    return undefined;
  }

  protected applyNetExtra(_ex: Record<string, number | boolean>): void {}

  netState(): BossNet {
    const hz: HazardNet[] = this.hazards.map((h) => ({
      k: h.kind, x: Math.round(h.x), y: Math.round(h.y), x2: h.x2 !== undefined ? Math.round(h.x2) : undefined, y2: h.y2 !== undefined ? Math.round(h.y2) : undefined,
      r: h.r, w: h.width, wa: h.warn, ac: h.active, ag: h.age, d: h.damage, c: h.color, pm: h.permanent ? 1 : undefined,
    }));
    return { ph: this.phase, at: this.attack, aT: this.attackT, sh: this.shielded, dy: this.dying, fl: this.fleeT || undefined, hz, ex: this.netExtra() };
  }

  applyNetState(b: BossNet): void {
    if (typeof b.ph === 'number') this.phase = b.ph;
    if (typeof b.at === 'string' && b.at !== this.attack) {
      this.lastAttack = this.attack;
      this.attack = b.at.slice(0, 24);
    }
    if (typeof b.aT === 'number') this.attackT = b.aT;
    if (typeof b.sh === 'number') this.shielded = b.sh;
    this.fleeT = typeof b.fl === 'number' ? b.fl : 0;
    if (Array.isArray(b.hz)) {
      this.hazards = b.hz.slice(0, 64).map((h) => ({
        kind: h.k, x: h.x, y: h.y, x2: h.x2, y2: h.y2, r: h.r, width: h.w, warn: h.wa, active: h.ac, age: h.ag, damage: h.d, color: typeof h.c === 'string' ? h.c : '#ff4040', permanent: h.pm === 1,
      }));
    }
    if (b.ex) this.applyNetExtra(b.ex);
  }

  /** The owner reported the kill: play the death sequence here too. */
  startPuppetDeath(ctx: GameContext): void {
    if (this.dying > 0) return;
    this.dead = true;
    this.dying = 150;
    this.harmful = false;
    this.hazards = [];
    ctx.audio.play('bossDie', { x: this.cx, y: this.cy });
    for (const p of ctx.entities.projectiles) if (!p.friendly) p.removed = true;
  }

  /** Everyone who fought (or was nearby) gets their own boss loot. */
  private tookPart(ctx: GameContext): boolean {
    const p = ctx.player;
    return this.localDamage > 0 || Math.hypot(p.cx - this.cx, p.cy - this.cy) < 16 * 150;
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
    ctx.mp?.enemyDied(this);
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
      if (!this.puppet || this.tookPart(ctx)) this.dropLoot(ctx);
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
