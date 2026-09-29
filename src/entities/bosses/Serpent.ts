import { Boss } from './Boss';
import { Enemy } from '../enemies/Enemy';
import type { GameContext } from '../../core/context';
import { BOSS_MAP } from '../../data/bosses';
import { WormBodyAI } from '../enemies/ai/worm';
import type { HitInfo } from '../Actor';
import type { EnemyDef } from '../../data/enemies';
import { angleLerp } from '../../utils/math';
import { shade } from '../../utils/color';

const SEGMENTS = 24;
const SPACING = 26;

class SerpentBodyAI extends WormBodyAI {
  constructor(
    prev: Enemy,
    private index: number,
    private owner: Serpent,
  ) {
    super(prev, SPACING);
  }

  render(g: CanvasRenderingContext2D, e: Enemy): void {
    const [scale, belly, dark, glow] = this.owner.bdef.colors;
    const tail = this.index >= SEGMENTS - 1;
    const taper = 1 - Math.max(0, this.index - SEGMENTS + 6) / 8;
    g.save();
    g.translate(Math.round(e.cx), Math.round(e.cy));
    g.rotate(e.mem.rot ?? 0);
    if (e.hitFlash > 0 && e.hitFlash % 4 < 2) g.filter = 'brightness(1.8)';
    const r = 18 * taper;
    g.fillStyle = shade(scale, 0.6);
    g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = scale;
    g.fillRect(-r + 2, -r + 1, r * 2 - 4, r * 2 - 2);
    g.fillStyle = belly;
    g.fillRect(-r + 2, r * 0.3, r * 2 - 4, r * 0.6);
    g.fillStyle = dark;
    g.fillRect(-2, -r, 4, r * 2);
    // Dorsal spine
    g.fillStyle = shade(dark, 1.3);
    g.beginPath();
    g.moveTo(-6, -r);
    g.lineTo(0, -r - 8 * taper);
    g.lineTo(6, -r);
    g.fill();
    if (this.owner.phase >= 2) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = glow;
      g.globalAlpha = 0.35 + Math.sin(e.age * 0.2 + this.index) * 0.2;
      g.fillRect(-r + 4, -3, r * 2 - 8, 6);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    if (tail) {
      g.fillStyle = scale;
      g.beginPath();
      g.moveTo(-r, -r);
      g.lineTo(-r - 22, 0);
      g.lineTo(-r, r);
      g.fill();
    }
    g.restore();
  }
}

/**
 * Nhal'Zyra, the Emberwyrm — a segmented serpent that swims freely through
 * terrain. Body segments share the head's health.
 * Attacks: relentless chase, orbiting ember barrages fired from its body,
 * telegraphed sky dives, fire breath. Phase 2 (≤50%): enraged speed and a
 * meteor rain during orbits.
 */
export class Serpent extends Boss {
  readonly segments: Enemy[] = [];
  private heading = Math.PI / 2;
  private speed = 7;

  constructor(x: number, y: number) {
    super(BOSS_MAP.get('serpent')!, x, y);
    this.noClip = true;
    this.noGravity = true;
    this.shielded = 90;
  }

  protected override shouldFlee(ctx: GameContext): string | null {
    return super.shouldFlee(ctx);
  }

  private spawnSegments(ctx: GameContext): void {
    const def: EnemyDef = { ...this.def, id: 'serpent_segment', w: 32, h: 32, life: 1, loot: 'e_gloop' };
    let prev: Enemy = this;
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = new Enemy(def, this.cx, this.cy + (i + 1) * SPACING);
      seg.setCenter(this.cx, this.cy + (i + 1) * SPACING);
      seg.head = this;
      seg.ai = new SerpentBodyAI(prev, i, this);
      seg.isBoss = true;
      seg.despawnable = false;
      seg.noClip = true;
      seg.noGravity = true;
      seg.damage = Math.round(this.damage * 0.6);
      seg.defense = this.defense + 10;
      ctx.entities.add(seg);
      this.segments.push(seg);
      prev = seg;
    }
  }

  override hurtFromSegment(ctx: GameContext, h: HitInfo, seg: Enemy): number {
    if (this.shielded > 0 || this.dying > 0) return 0;
    return super.hurtFromSegment(ctx, { ...h, damage: h.damage * 0.85 }, seg);
  }

  private steer(tx: number, ty: number, turn: number): void {
    const want = Math.atan2(ty - this.cy, tx - this.cx);
    this.heading = angleLerp(this.heading, want, turn);
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;
    this.x += this.vx;
    this.y += this.vy;
  }

  protected think(ctx: GameContext): void {
    if (!this.segments.length) this.spawnSegments(ctx);
    const pl = ctx.player;
    const t = this.attackT;
    const p2 = this.phase >= 2;
    const base = p2 ? 9.5 : 7.5;
    this.facing = 1;
    this.mem.rot = this.heading;
    if (this.age % 40 === 0) ctx.audio.play('soil', { x: this.cx, y: this.cy, volume: 0.25, pitch: 0.4 });
    switch (this.attack) {
      case 'intro':
        this.speed = 9;
        this.steer(pl.cx, pl.cy, 0.02);
        if (t === 30) ctx.audio.play('bossRoar', { pitch: 0.7 });
        if (t > 90) this.setAttack('chase');
        return;
      case 'chase':
        this.speed = base;
        this.steer(pl.cx, pl.cy, p2 ? 0.055 : 0.045);
        if (t > (p2 ? 170 : 220)) this.setAttack(this.pick(['loop', 'dive', 'breath']));
        return;
      case 'loop': {
        this.speed = base * 0.9;
        const a = Math.atan2(this.cy - pl.cy, this.cx - pl.cx) + 0.5;
        this.steer(pl.cx + Math.cos(a) * 380, pl.cy + Math.sin(a) * 380, 0.08);
        if (t % (p2 ? 12 : 18) === 0 && this.segments.length) {
          const s = this.segments[Math.floor(Math.random() * this.segments.length)];
          const ang = Math.atan2(pl.cy - s.cy, pl.cx - s.cx);
          ctx.spawnProjectile('boss_ember', s.cx, s.cy, Math.cos(ang) * 4, Math.sin(ang) * 4, { damage: Math.round(this.damage * 0.55), knockback: 3, friendly: false, owner: this, onHit: { buff: 'burning', seconds: 3, chance: 0.5 } });
        }
        if (p2 && t % 10 === 0) {
          const x = pl.cx + (Math.random() - 0.5) * 900;
          ctx.spawnProjectile('boss_ember', x, pl.cy - 500, (Math.random() - 0.5) * 2, 7, { damage: Math.round(this.damage * 0.5), knockback: 3, friendly: false, owner: this });
        }
        if (t > 220) this.setAttack('chase');
        return;
      }
      case 'dive': {
        if (t < 60) {
          this.speed = 12;
          this.steer(pl.cx + 40, pl.cy - 700, 0.09);
          if (t === 30) {
            this.hazards.push({ kind: 'column', x: pl.cx, y: pl.cy, width: 70, warn: 40, active: 0, age: 0, damage: 0, color: '#ff6a2a' });
            ctx.audio.play('charge', { x: pl.cx, y: pl.cy, pitch: 0.5 });
          }
          return;
        }
        if (t === 60) {
          this.heading = Math.atan2(pl.cy - this.cy, pl.cx - this.cx);
          ctx.audio.play('bossRoar', { pitch: 1.1 });
        }
        this.speed = 17;
        this.vx = Math.cos(this.heading) * this.speed;
        this.vy = Math.sin(this.heading) * this.speed;
        this.x += this.vx;
        this.y += this.vy;
        if (t % 2 === 0) ctx.particles.emit(this.cx, this.cy, { count: 3, colors: ['#ff6a2a', '#ffe070'], speed: [0.5, 2], glow: true, gravity: 0 });
        if (t > 115) this.setAttack(p2 && Math.random() < 0.5 ? 'dive' : 'chase');
        return;
      }
      case 'breath': {
        this.speed = t < 30 ? 5 : 2.2;
        this.steer(pl.cx, pl.cy, 0.06);
        if (t >= 30 && t < 100 && t % 3 === 0) {
          const a = this.heading + (Math.random() - 0.5) * 0.45;
          ctx.spawnProjectile('boss_flame', this.cx + Math.cos(this.heading) * 24, this.cy + Math.sin(this.heading) * 24, Math.cos(a) * 7.5, Math.sin(a) * 7.5, { damage: Math.round(this.damage * 0.5), knockback: 2, friendly: false, owner: this, onHit: { buff: 'burning', seconds: 4, chance: 0.7 } });
          if (t % 12 === 0) ctx.audio.play('explosion', { x: this.cx, y: this.cy, volume: 0.25, pitch: 1.8 });
        }
        if (t > 120) this.setAttack('chase');
        return;
      }
    }
  }

  protected override onPhase(ctx: GameContext, phase: number): void {
    super.onPhase(ctx, phase);
    ctx.message('Nhal’Zyra’s scales blaze white-hot!', '#ff8a3a');
  }

  protected override onDeath(ctx: GameContext): void {
    super.onDeath(ctx);
    for (const s of this.segments) s.removed = true;
    for (const s of this.segments) ctx.particles.emit(s.cx, s.cy, { count: 12, colors: this.bdef.colors, speed: [1, 4], glow: true });
  }

  protected draw(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const [scale, belly, dark, glow] = this.bdef.colors;
    const breathing = this.attack === 'breath' && this.attackT >= 30;
    g.translate(Math.round(this.cx), Math.round(this.cy));
    g.rotate(this.heading);
    const jaw = breathing ? 10 : 3 + Math.sin(this.age * 0.1) * 2;
    // Lower jaw
    g.fillStyle = shade(scale, 0.8);
    g.beginPath();
    g.moveTo(-16, 6);
    g.lineTo(34, 8 + jaw);
    g.lineTo(-10, 20);
    g.fill();
    // Skull
    g.fillStyle = shade(scale, 0.6);
    g.fillRect(-24, -22, 42, 40);
    g.fillStyle = scale;
    g.beginPath();
    g.moveTo(-22, -20);
    g.lineTo(38, -6 - jaw * 0.3);
    g.lineTo(30, 6);
    g.lineTo(-22, 16);
    g.fill();
    g.fillStyle = belly;
    g.fillRect(-10, 4, 36, 4);
    // Horns
    g.fillStyle = dark;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(-14, s * 12);
      g.lineTo(-44, s * 28);
      g.lineTo(-10, s * 4);
      g.fill();
    }
    // Eye
    g.fillStyle = glow;
    g.fillRect(8, -12, 7, 5);
    g.fillStyle = '#ffffff';
    g.fillRect(11, -11, 2, 3);
    // Teeth
    g.fillStyle = '#fff4d0';
    for (let i = 0; i < 4; i++) g.fillRect(10 + i * 6, 2, 2, 4);
    if (breathing) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = '#ffb040';
      g.globalAlpha = 0.6;
      g.beginPath();
      g.arc(36, 6, 10 + Math.sin(this.age) * 3, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    void ctx;
  }

  override light() {
    return { x: this.cx, y: this.cy, r: 1, g: 0.5, b: 0.15, radius: 12 };
  }
}
