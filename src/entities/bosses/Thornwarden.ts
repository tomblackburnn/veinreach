import { Boss } from './Boss';
import type { GameContext } from '../../core/context';
import { BOSS_MAP } from '../../data/bosses';
import { shade } from '../../utils/color';

/**
 * The Thornwarden — a hollowed forest guardian mask with vine limbs.
 * Attacks: thorn fans, telegraphed root spikes from the ground, seed bombs
 * that burst into thorns, thornling summons. Phase 2 (≤50%): spiral volleys
 * and telegraphed triple dashes. Retreats at dawn.
 */
export class Thornwarden extends Boss {
  private dashes = 0;
  private dashAngle = 0;

  constructor(x: number, y: number) {
    super(BOSS_MAP.get('thornwarden')!, x, y);
    this.noClip = true;
    this.noGravity = true;
    this.shielded = 90;
  }

  protected override shouldFlee(ctx: GameContext): string | null {
    if (ctx.time.isDay) return 'The Thornwarden sinks back into the soil as dawn breaks.';
    return super.shouldFlee(ctx);
  }

  private hoverTo(tx: number, ty: number, speed: number, inertia = 0.05): void {
    const dx = tx - this.cx;
    const dy = ty - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(speed, d * 0.05);
    this.vx += ((dx / d) * s - this.vx) * inertia;
    this.vy += ((dy / d) * s - this.vy) * inertia;
    this.x += this.vx;
    this.y += this.vy;
  }

  private groundY(ctx: GameContext, x: number, fromY: number): number {
    let ty = Math.floor(fromY / 16);
    const tx = Math.floor(x / 16);
    while (ty < ctx.world.height - 1 && !ctx.world.isSolid(tx, ty)) ty++;
    while (ty > 0 && ctx.world.isSolid(tx, ty - 1)) ty--;
    return ty * 16;
  }

  protected think(ctx: GameContext): void {
    const pl = this.target;
    const t = this.attackT;
    const p2 = this.phase >= 2;
    this.facing = pl.cx > this.cx ? 1 : -1;
    switch (this.attack) {
      case 'intro':
        this.y -= 2.2;
        if (t % 3 === 0) ctx.particles.emit(this.cx, this.bottom, { count: 4, colors: ['#6a8a3a', '#3a2a1a', '#b06adf'], speed: [1, 3], life: [20, 40] });
        ctx.shake(0.05);
        if (t > 90) {
          ctx.audio.play('bossRoar');
          this.setAttack('hover');
        }
        return;
      case 'hover':
        this.hoverTo(pl.cx + Math.sin(this.age * 0.02) * 140, pl.cy - 190, p2 ? 6 : 4.5);
        if (t > (p2 ? 60 : 90)) this.setAttack(this.pick(p2 ? ['volley', 'roots', 'seeds', 'summon', 'dash', 'dash'] : ['volley', 'roots', 'seeds', 'summon']));
        return;
      case 'volley': {
        this.hoverTo(pl.cx, pl.cy - 200, 2);
        if (p2) {
          if (t % 5 === 0 && t < 120) {
            for (let k = 0; k < 3; k++) this.fire(ctx, 'boss_thorn', this.cx, this.cy, t * 0.09 + (k * Math.PI * 2) / 3, 5, 0.6);
            if (t % 15 === 0) ctx.audio.play('plant', { x: this.cx, y: this.cy, pitch: 1.4 });
          }
          if (t > 140) this.setAttack('hover');
        } else {
          if (t % 25 === 0 && t <= 75) {
            const a = this.angleToPlayer(ctx);
            for (let i = -3; i <= 3; i++) this.fire(ctx, 'boss_thorn', this.cx, this.cy + 10, a + i * 0.14, 6, 0.65);
            ctx.audio.play('bossAttack', { x: this.cx, y: this.cy, pitch: 1.3 });
          }
          if (t > 100) this.setAttack('hover');
        }
        return;
      }
      case 'roots': {
        this.hoverTo(pl.cx, pl.cy - 220, 2.5);
        if (t === 1) {
          const n = p2 ? 9 : 6;
          const base = pl.cx - ((n - 1) / 2) * 56 + (Math.random() - 0.5) * 30;
          for (let i = 0; i < n; i++) {
            const x = base + i * 56;
            this.hazards.push({ kind: 'spike', x, y: this.groundY(ctx, x, pl.y), r: 90, warn: 55 + i * 3, active: 40, age: 0, damage: this.damage, color: '#b06adf' });
          }
          ctx.audio.play('charge', { x: pl.cx, y: pl.cy, pitch: 0.6 });
        }
        if (t === 60 && p2) {
          // A second, offset wave in phase 2.
          for (let i = 0; i < 6; i++) {
            const x = pl.cx - 140 + i * 56 + 28;
            this.hazards.push({ kind: 'spike', x, y: this.groundY(ctx, x, pl.y), r: 90, warn: 45, active: 35, age: 0, damage: this.damage, color: '#b06adf' });
          }
        }
        if (t > 130) this.setAttack('hover');
        return;
      }
      case 'seeds':
        this.hoverTo(pl.cx - this.facing * 120, pl.cy - 200, 3);
        if (t % 30 === 0 && t <= (p2 ? 90 : 60)) {
          const dx = pl.cx - this.cx;
          ctx.spawnProjectile('boss_seed', this.cx, this.cy, dx / 60 + (Math.random() - 0.5) * 2, -4, { damage: Math.round(this.damage * 0.7), knockback: 4, friendly: false, owner: this, lifeMul: 0.4 });
          ctx.audio.play('plant', { x: this.cx, y: this.cy, pitch: 0.6 });
        }
        if (t > 120) this.setAttack('hover');
        return;
      case 'summon': {
        this.hoverTo(pl.cx, pl.cy - 200, 2);
        if (t === 20) {
          const count = ctx.entities.enemies.filter((e) => e.def.id === 'thornling').length;
          const n = Math.min(p2 ? 3 : 2, 6 - count);
          for (let i = 0; i < n; i++) {
            const x = pl.cx + (i - n / 2) * 120 + 60;
            ctx.spawnEnemy('thornling', x, this.groundY(ctx, x, pl.y - 64));
            ctx.particles.emit(x, this.groundY(ctx, x, pl.y - 64), { count: 20, colors: ['#6a8a3a', '#b06adf'], speed: [1, 3], angle: -Math.PI / 2, spread: 0.8 });
          }
          ctx.audio.play('summon', { x: this.cx, y: this.cy, pitch: 0.5 });
        }
        if (t > 60) this.setAttack('hover');
        return;
      }
      case 'dash': {
        if (t === 1) this.dashes = 3;
        const cycle = 70;
        const ct = (t - 1) % cycle;
        if (ct === 0) {
          this.dashAngle = this.angleToPlayer(ctx);
          const L = 900;
          this.hazards.push({ kind: 'beam', x: this.cx, y: this.cy, x2: this.cx + Math.cos(this.dashAngle) * L, y2: this.cy + Math.sin(this.dashAngle) * L, width: 50, warn: 30, active: 0, age: 0, damage: 0, color: '#b06adf' });
          ctx.audio.play('charge', { x: this.cx, y: this.cy });
        }
        if (ct < 30) {
          this.vx *= 0.85;
          this.vy *= 0.85;
          this.x += this.vx;
          this.y += this.vy;
        } else if (ct < 60) {
          this.vx = Math.cos(this.dashAngle) * 15;
          this.vy = Math.sin(this.dashAngle) * 15;
          this.x += this.vx;
          this.y += this.vy;
          if (ct % 3 === 0) ctx.particles.emit(this.cx, this.cy, { count: 4, colors: ['#b06adf', '#6a8a3a'], speed: [0.5, 2], life: [15, 30], gravity: 0 });
          if (ct === 30) ctx.audio.play('swing', { x: this.cx, y: this.cy, pitch: 0.4, volume: 1 });
        } else {
          this.vx *= 0.8;
          this.vy *= 0.8;
          this.x += this.vx;
          this.y += this.vy;
        }
        if (ct === cycle - 1 && --this.dashes <= 0) this.setAttack('hover');
        return;
      }
    }
  }

  protected override onPhase(ctx: GameContext, phase: number): void {
    super.onPhase(ctx, phase);
    ctx.message('The Thornwarden’s bark splits, revealing a blighted heart!', '#c080ff');
  }

  protected draw(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const [moss, bark, blight, glow] = this.bdef.colors;
    const t = this.frameTime;
    const p2 = this.phase >= 2;
    g.translate(Math.round(this.cx), Math.round(this.cy));
    const sway = Math.sin(t * 0.04) * 0.05;
    g.rotate(sway);
    // Vine arms
    g.strokeStyle = shade(moss, 0.7);
    g.lineWidth = 5;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 34, 10);
      for (let i = 1; i <= 6; i++) g.lineTo(side * (34 + i * 7), 10 + i * 12 + Math.sin(t * 0.08 + i + side) * 8);
      g.stroke();
      g.fillStyle = blight;
      g.fillRect(side * 76 - 4, 82 + Math.sin(t * 0.08 + 6 + side) * 8, 8, 8);
    }
    // Crown of branches
    g.strokeStyle = bark;
    g.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * 12, -40);
      g.lineTo(i * 22, -70 - Math.abs(i) * -6);
      g.lineTo(i * 28 + (i >= 0 ? 8 : -8), -86 + Math.abs(i) * 6);
      g.stroke();
      g.fillStyle = i % 2 ? moss : shade(moss, 1.2);
      g.beginPath();
      g.arc(i * 28 + (i >= 0 ? 8 : -8), -88 + Math.abs(i) * 6, 10, 0, Math.PI * 2);
      g.fill();
    }
    // Mask body
    g.fillStyle = shade(bark, 0.7);
    g.beginPath();
    g.ellipse(0, 0, 46, 52, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = bark;
    g.beginPath();
    g.ellipse(0, -2, 42, 48, 0, 0, Math.PI * 2);
    g.fill();
    // Bark grain
    g.strokeStyle = shade(bark, 1.3);
    g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * 10, -44 + Math.abs(i) * 3);
      g.quadraticCurveTo(i * 13, 0, i * 9, 44 - Math.abs(i) * 3);
      g.stroke();
    }
    // Moss patches
    g.fillStyle = moss;
    g.fillRect(-36, -30, 18, 8);
    g.fillRect(20, 22, 16, 7);
    g.fillRect(-10, -48, 20, 6);
    // Eye sockets
    const eyeC = p2 ? blight : glow;
    for (const side of [-1, 1]) {
      g.fillStyle = '#120a08';
      g.beginPath();
      g.ellipse(side * 16, -8, 10, 13, side * 0.2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = eyeC;
      g.globalAlpha = 0.7 + Math.sin(t * 0.15) * 0.3;
      g.beginPath();
      g.arc(side * 16, -6, 4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    // Mouth
    g.fillStyle = '#120a08';
    g.beginPath();
    g.ellipse(0, 26, 14, this.attack === 'volley' ? 12 : 7, 0, 0, Math.PI * 2);
    g.fill();
    if (p2) {
      g.strokeStyle = blight;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-4, -46);
      g.lineTo(4, -20);
      g.lineTo(-6, 0);
      g.lineTo(6, 20);
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = blight;
      g.globalAlpha = 0.4 + Math.sin(t * 0.2) * 0.2;
      g.beginPath();
      g.arc(0, 0, 18, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    void ctx;
  }

  override light() {
    return { x: this.cx, y: this.cy, r: 0.4, g: 0.3, b: 0.5, radius: 10 };
  }
}
