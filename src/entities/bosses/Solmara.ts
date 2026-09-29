import { Boss } from './Boss';
import type { GameContext } from '../../core/context';
import { BOSS_MAP } from '../../data/bosses';
import type { Hazard } from './hazards';

/**
 * Solmara, the Unmade Star — final boss.
 * Phase 1: star bursts, star-wisp summons, telegraphed teleport dashes.
 * Phase 2 (≤66%): an arena ring locks the fight in place; adds rotating
 *   cross-lasers and meteor rain.
 * Phase 3 (≤33%): Solmara anchors at the arena centre and unleashes a
 *   supernova bullet-hell, followed by an EXHAUSTED window (defense 0).
 */
export class Solmara extends Boss {
  private arena: Hazard | null = null;
  private ax = 0;
  private ay = 0;
  private dashN = 0;
  private dashTarget: [number, number] = [0, 0];
  private dashAngle = 0;

  constructor(x: number, y: number) {
    super(BOSS_MAP.get('solmara')!, x, y);
    this.noClip = true;
    this.noGravity = true;
    this.shielded = 170;
    this.phaseThresholds = [0.66, 0.33];
  }

  protected override shouldFlee(ctx: GameContext): string | null {
    if (ctx.time.isDay) return 'Solmara fades as the sun rises... for now.';
    return super.shouldFlee(ctx);
  }

  private moveTo(tx: number, ty: number, speed: number, inertia = 0.06): void {
    const dx = tx - this.cx;
    const dy = ty - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(speed, d * 0.07);
    this.vx += ((dx / d) * s - this.vx) * inertia;
    this.vy += ((dy / d) * s - this.vy) * inertia;
    this.x += this.vx;
    this.y += this.vy;
  }

  private nextAttack(): string {
    if (this.phase === 1) return this.pick(['starburst', 'wisps', 'dashes', 'starburst']);
    if (this.phase === 2) return this.pick(['starburst', 'crossLaser', 'meteors', 'dashes', 'wisps']);
    return this.pick(['supernova', 'meteors', 'dashes', 'crossLaser']);
  }

  protected think(ctx: GameContext): void {
    const pl = ctx.player;
    const t = this.attackT;
    this.facing = pl.cx > this.cx ? 1 : -1;
    switch (this.attack) {
      case 'intro':
        this.y += 2.5;
        if (t % 2 === 0) ctx.particles.emit(this.cx, this.cy, { count: 4, colors: ['#fff0a0', '#ff8ae6', '#ffffff'], speed: [1, 4], glow: true, gravity: 0 });
        if (t === 1) ctx.ui.banner('A star falls from the heavens...', undefined, '#ffe8a0');
        if (t > 150) {
          ctx.audio.play('bossRoar', { pitch: 1.6 });
          ctx.shake(0.6);
          this.setAttack('float');
        }
        return;
      case 'float': {
        const cx = this.arena ? this.ax : pl.cx;
        const cy = this.arena ? this.ay - 120 : pl.cy - 200;
        this.moveTo(cx + Math.sin(this.age * 0.025) * 180, cy + Math.cos(this.age * 0.04) * 30, 6);
        if (t > (this.phase >= 3 ? 40 : 70)) this.setAttack(this.nextAttack());
        return;
      }
      case 'starburst': {
        this.moveTo(pl.cx, pl.cy - 220, 2);
        const rings = this.phase >= 2 ? 5 : 4;
        if (t % 20 === 1 && t < rings * 20) {
          this.ring(ctx, 'boss_star', this.phase >= 2 ? 18 : 14, 3.4 + (t / 20) * 0.3, t * 0.05, 0.55);
          ctx.audio.play('crystal', { x: this.cx, y: this.cy, pitch: 0.8 });
        }
        if (t > rings * 20 + 40) this.setAttack('float');
        return;
      }
      case 'wisps':
        this.moveTo(pl.cx, pl.cy - 240, 2);
        if (t === 20) {
          const have = ctx.entities.enemies.filter((e) => e.def.id === 'star_wisp').length;
          for (let i = 0; i < Math.min(3, 6 - have); i++) {
            const a = (i / 3) * Math.PI * 2;
            const e = ctx.spawnEnemy('star_wisp', this.cx + Math.cos(a) * 60, this.cy + Math.sin(a) * 60);
            if (e) e.despawnable = false;
          }
          ctx.audio.play('summon', { x: this.cx, y: this.cy, pitch: 1.3 });
        }
        if (t > 60) this.setAttack('float');
        return;
      case 'dashes': {
        if (t === 1) this.dashN = this.phase >= 3 ? 4 : 3;
        const cycle = 58;
        const ct = (t - 1) % cycle;
        if (ct === 0) {
          const a = Math.random() * Math.PI * 2;
          this.dashTarget = [pl.cx + Math.cos(a) * 320, pl.cy + Math.sin(a) * 200 - 80];
          this.hazards.push({ kind: 'burst', x: this.dashTarget[0], y: this.dashTarget[1], r: 50, warn: 24, active: 4, age: 0, damage: Math.round(this.damage * 0.8), color: '#ff8ae6' });
        }
        if (ct === 24) {
          ctx.particles.emit(this.cx, this.cy, { count: 20, colors: ['#fff0a0', '#ffffff'], speed: [1, 3], glow: true, gravity: 0 });
          this.setCenter(this.dashTarget[0], this.dashTarget[1]);
          this.dashAngle = this.angleToPlayer(ctx);
          ctx.audio.play('teleport', { x: this.cx, y: this.cy });
          this.hazards.push({ kind: 'beam', x: this.cx, y: this.cy, x2: this.cx + Math.cos(this.dashAngle) * 700, y2: this.cy + Math.sin(this.dashAngle) * 700, width: 60, warn: 12, active: 0, age: 0, damage: 0, color: '#fff0a0' });
        }
        if (ct > 36 && ct < 54) {
          this.x += Math.cos(this.dashAngle) * 18;
          this.y += Math.sin(this.dashAngle) * 18;
          if (ct % 2 === 0) this.fire(ctx, 'boss_star', this.cx, this.cy, this.dashAngle + Math.PI / 2, 1.5, 0.45);
        }
        if (ct === cycle - 1 && --this.dashN <= 0) this.setAttack('float');
        return;
      }
      case 'crossLaser': {
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.x += this.vx;
        this.y += this.vy;
        if (t === 1) {
          const start = this.angleToPlayer(ctx) + Math.PI / 4;
          const dir = Math.random() < 0.5 ? 1 : -1;
          const beams = this.phase >= 3 ? 6 : 4;
          for (let k = 0; k < beams; k++) {
            this.hazards.push({
              kind: 'beam', x: 0, y: 0, x2: 0, y2: 0, width: 24, warn: 60, active: 170, age: 0, damage: this.damage, color: '#ff8ae6',
              step: (h) => {
                const a = start + (k * Math.PI * 2) / beams + (h.age > h.warn ? (h.age - h.warn) * 0.013 * dir : 0);
                h.x = this.cx;
                h.y = this.cy;
                h.x2 = this.cx + Math.cos(a) * 1200;
                h.y2 = this.cy + Math.sin(a) * 1200;
              },
            });
          }
          ctx.audio.play('charge', { x: this.cx, y: this.cy, pitch: 1.2 });
        }
        if (t > 240) this.setAttack('float');
        return;
      }
      case 'meteors': {
        this.moveTo(pl.cx, pl.cy - 260, 3);
        if (t % (this.phase >= 3 ? 5 : 7) === 0 && t < 150) {
          const cx = this.arena ? this.ax : pl.cx;
          const x = cx + (Math.random() - 0.5) * 1100;
          this.hazards.push({ kind: 'column', x, y: pl.cy, width: 22, warn: 26, active: 0, age: 0, damage: 0, color: '#fff0a0' });
          ctx.spawnProjectile('boss_star', x, pl.cy - 560, (Math.random() - 0.5), 9, { damage: Math.round(this.damage * 0.6), knockback: 4, friendly: false, owner: this, lifeMul: 0.3 });
        }
        if (t > 190) this.setAttack('float');
        return;
      }
      case 'supernova': {
        const tx = this.arena ? this.ax : pl.cx;
        const ty = this.arena ? this.ay - 60 : pl.cy - 160;
        this.moveTo(tx, ty, 4, 0.1);
        if (t === 1) {
          ctx.message('Solmara gathers the light of a dying star!', '#ffe8a0');
          ctx.audio.play('charge', { x: this.cx, y: this.cy, pitch: 0.4 });
        }
        if (t > 60 && t < 300) {
          if (t % 4 === 0) for (let k = 0; k < 3; k++) this.fire(ctx, 'boss_star', this.cx, this.cy, t * 0.07 + (k * Math.PI * 2) / 3, 3.2, 0.5);
          if (t % 60 === 0) this.ring(ctx, 'boss_void', 20, 2.6, t * 0.1, 0.6);
          if (t % 20 === 0) ctx.shake(0.1);
        }
        if (t > 320) this.setAttack('exhausted');
        return;
      }
      case 'exhausted':
        this.defense = 0;
        this.vx *= 0.9;
        this.vy = 0.6;
        this.x += this.vx;
        this.y += this.vy;
        if (t === 1) ctx.message('Solmara’s light gutters — she is exhausted!', '#ffb070');
        if (t > 170) {
          this.defense = this.bdef.defense;
          this.setAttack('float');
        }
        return;
    }
  }

  protected override onPhase(ctx: GameContext, phase: number): void {
    super.onPhase(ctx, phase);
    this.shielded = 150;
    this.hazards = this.arena ? [this.arena] : [];
    this.defense = this.bdef.defense;
    if (phase === 2) {
      this.ax = ctx.player.cx;
      this.ay = ctx.player.cy;
      this.arena = { kind: 'ring', x: this.ax, y: this.ay, r: 620, warn: 90, active: 0, age: 0, damage: Math.round(this.damage * 0.5), color: '#ff8ae6', permanent: true };
      this.hazards.push(this.arena);
      ctx.ui.banner('Solmara’s light fractures!', 'The heavens close in around you.', '#ff8ae6');
    } else {
      ctx.ui.banner('Solmara becomes a supernova!', 'Survive the light.', '#fff0a0');
    }
    this.setAttack('float');
  }

  protected draw(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const [gold, pink, cyan] = this.bdef.colors;
    const t = this.frameTime;
    const tired = this.attack === 'exhausted';
    g.translate(Math.round(this.cx), Math.round(this.cy + Math.sin(t * 0.05) * 4));
    // Aura
    g.globalCompositeOperation = 'lighter';
    const grd = g.createRadialGradient(0, 0, 4, 0, 0, 90);
    grd.addColorStop(0, tired ? 'rgba(255,200,150,0.35)' : 'rgba(255,240,180,0.6)');
    grd.addColorStop(1, 'rgba(255,140,230,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, 90, 0, Math.PI * 2);
    g.fill();
    // Wings of light
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const flap = Math.sin(t * 0.06 + k) * 0.15;
        g.save();
        g.rotate(s * (0.5 + k * 0.35 + flap));
        g.fillStyle = k === 1 ? pink : cyan;
        g.globalAlpha = 0.5 - k * 0.1;
        g.beginPath();
        g.moveTo(0, -10);
        g.lineTo(s * 70, -40 - k * 10);
        g.lineTo(s * 40, 0);
        g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // Halo rings
    g.strokeStyle = gold;
    g.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      g.save();
      g.rotate(t * (k ? -0.02 : 0.03));
      g.beginPath();
      g.ellipse(0, -46, 26 + k * 8, 8 + k * 3, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    // Body
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.moveTo(0, -34);
    g.quadraticCurveTo(18, -10, 12, 38);
    g.lineTo(-12, 38);
    g.quadraticCurveTo(-18, -10, 0, -34);
    g.fill();
    g.fillStyle = gold;
    g.fillRect(-10, -6, 20, 4);
    g.fillRect(-2, -4, 4, 40);
    // Face mask
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, -30, 11, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = tired ? '#8a6a8a' : pink;
    g.fillRect(-6, -32, 4, 2);
    g.fillRect(2, -32, 4, 2);
    if (this.phase >= 3) {
      g.strokeStyle = pink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-4, -42);
      g.lineTo(2, -24);
      g.lineTo(-3, 0);
      g.lineTo(5, 30);
      g.stroke();
    }
    void ctx;
  }

  override light() {
    return { x: this.cx, y: this.cy, r: 1, g: 0.95, b: 0.9, radius: 16 };
  }
}
