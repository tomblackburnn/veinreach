import { Entity } from './Entity';
import type { GameContext } from '../core/context';
import { BuffSet } from '../systems/BuffSystem';
import { rollDamage, knockbackVelocity } from '../combat/damage';
import type { DamageClass } from '../items/types';

export type Team = 'player' | 'enemy' | 'npc';

export interface HitInfo {
  /** Damage before the target's defense (attacker bonuses already applied). */
  damage: number;
  knockback: number;
  /** Direction of knockback (-1 left, 1 right). */
  dirX: number;
  critChance?: number;
  kind?: DamageClass | 'contact' | 'environment' | 'dot';
  source?: Entity | null;
  buff?: { buff: string; seconds: number; chance: number };
  ignoreDefense?: boolean;
  /** Invulnerability ticks granted to the target (players). */
  immunity?: number;
  /** Suppress the floating damage number. */
  silent?: boolean;
}

/** An entity with health, defense, buffs and a hurt/death lifecycle. */
export abstract class Actor extends Entity {
  life = 100;
  maxLife = 100;
  defense = 0;
  immune = 0;
  hitFlash = 0;
  kbResist = 0;
  dead = false;
  readonly buffs = new BuffSet();
  abstract readonly team: Team;

  /** Hook: modify final damage (e.g. player damage reduction). */
  protected modifyIncoming(amount: number): number {
    return amount;
  }

  /** Central damage entry point. Returns damage dealt (0 if ignored). */
  hurt(ctx: GameContext, h: HitInfo): number {
    if (this.dead || this.immune > 0) return 0;
    const roll = h.ignoreDefense ? { amount: Math.max(1, Math.round(h.damage)), crit: false } : rollDamage(h.damage, 0, h.critChance ?? 0, this.defense);
    const amount = this.modifyIncoming(roll.amount);
    this.life -= amount;
    this.hitFlash = 8;
    if (h.immunity) this.immune = h.immunity;
    const kb = knockbackVelocity(h.knockback, this.kbResist);
    if (kb > 0) {
      this.vx = h.dirX * kb;
      this.vy = Math.min(this.vy, -kb * 0.55);
    }
    if (h.buff && Math.random() < h.buff.chance) this.buffs.add(h.buff.buff, h.buff.seconds * 60);
    if (!h.silent) ctx.text.damage(amount, this.cx, this.y - 4, roll.crit, this.team === 'player');
    this.onHurt(ctx, amount, h, roll.crit);
    if (this.life <= 0) {
      this.life = 0;
      this.dead = true;
      this.onDeath(ctx, h);
    }
    return amount;
  }

  heal(ctx: GameContext, amount: number, show = true): void {
    if (this.dead) return;
    const before = this.life;
    this.life = Math.min(this.maxLife, this.life + amount);
    const d = Math.round(this.life - before);
    if (show && d > 0) ctx.text.add(`+${d}`, this.cx, this.y - 6, '#5aff7a', 10);
  }

  /** Tick immunity, flash and damage-over-time. Call from subclass update. */
  protected tickStatus(ctx: GameContext, immuneTo: (buffId: string) => boolean): void {
    if (this.immune > 0) this.immune--;
    if (this.hitFlash > 0) this.hitFlash--;
    const dot = this.buffs.tick((def) => immuneTo(def.id));
    if (dot > 0 && !this.dead) {
      this.dotAcc += dot;
      if (this.dotAcc >= 1) {
        const n = Math.floor(this.dotAcc);
        this.dotAcc -= n;
        this.life -= n;
        if (ctx.tick % 20 === 0) ctx.text.add(String(n * 20), this.cx, this.y, '#c080ff', 8, 30);
        if (this.life <= 0) {
          this.life = 0;
          this.dead = true;
          this.onDeath(ctx, { damage: n, knockback: 0, dirX: 0, kind: 'dot' });
        }
      }
    }
    if (ctx.tick % 6 === 0) {
      for (const { def } of this.buffs.list()) {
        if (def.particle) ctx.particles.emit(this.cx, this.cy, { count: 1, color: def.particle, speed: [0.2, 0.8], angle: -Math.PI / 2, spread: 0.8, life: [15, 30], jitter: this.w / 2, glow: true, gravity: -0.02 });
      }
    }
  }
  private dotAcc = 0;

  protected abstract onHurt(ctx: GameContext, amount: number, h: HitInfo, crit: boolean): void;
  protected abstract onDeath(ctx: GameContext, h: HitInfo): void;
}
