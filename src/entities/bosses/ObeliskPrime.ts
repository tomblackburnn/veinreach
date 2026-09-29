import { Boss } from './Boss';
import type { GameContext } from '../../core/context';
import { BOSS_MAP } from '../../data/bosses';
import type { Projectile } from '../Projectile';
import { shade } from '../../utils/color';

const SHARDS = 6;

/**
 * Obelisk Prime, Warden of the Seal. A floating construct with orbiting
 * shards (which also hurt on contact).
 * Phase 1: shard rings, bullet spirals, homing orbs, a telegraphed sweeping
 *          laser followed by an OVERHEAT window (defense drops to 0).
 * Phase 2 (≤60%): adds Shard Storm (a closing cage of shards around the player).
 * Phase 3 (≤25%): cross-lasers that rotate around the core, faster spirals.
 * Its destruction breaks the Seal (world transformation).
 */
export class ObeliskPrime extends Boss {
  private orbit = 0;
  private shardsOut = false;
  private side = 1;
  private cage: Projectile[] = [];

  constructor(x: number, y: number) {
    super(BOSS_MAP.get('obelisk')!, x, y);
    this.noClip = true;
    this.noGravity = true;
    this.shielded = 110;
    this.phaseThresholds = [0.6, 0.25];
  }

  private moveTo(tx: number, ty: number, speed: number): void {
    const dx = tx - this.cx;
    const dy = ty - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const s = Math.min(speed, d * 0.06);
    this.vx += ((dx / d) * s - this.vx) * 0.06;
    this.vy += ((dy / d) * s - this.vy) * 0.06;
    this.x += this.vx;
    this.y += this.vy;
  }

  shardPositions(): [number, number][] {
    if (this.shardsOut) return [];
    const out: [number, number][] = [];
    for (let i = 0; i < SHARDS; i++) {
      const a = this.orbit + (i / SHARDS) * Math.PI * 2;
      out.push([this.cx + Math.cos(a) * 62, this.cy + Math.sin(a) * 30]);
    }
    return out;
  }

  protected think(ctx: GameContext): void {
    const pl = ctx.player;
    const t = this.attackT;
    this.orbit += this.attack === 'overheat' ? 0.01 : 0.035 + this.phase * 0.01;
    // Orbiting shard contact damage.
    for (const [sx, sy] of this.shardPositions()) {
      if (!pl.dead && Math.abs(pl.cx - sx) < 14 && Math.abs(pl.cy - sy) < 26) pl.hurt(ctx, { damage: Math.round(this.damage * 0.7), knockback: 6, dirX: Math.sign(pl.cx - this.cx) || 1, immunity: 40 });
    }
    switch (this.attack) {
      case 'intro':
        this.y -= 1.2;
        if (t % 4 === 0) ctx.particles.emit(this.cx, this.cy, { count: 3, colors: ['#6fe0d0', '#d4fff8'], speed: [1, 3], glow: true, gravity: 0 });
        if (t > 110) {
          ctx.audio.play('bossRoar', { pitch: 1.5 });
          this.setAttack('drift');
        }
        return;
      case 'drift':
        if (t === 1) this.side = -this.side;
        this.moveTo(pl.cx + this.side * 280, pl.cy - 70, 5);
        if (t > (this.phase >= 3 ? 50 : 80)) {
          const opts = ['ring', 'spiral', this.phase >= 3 ? 'crossLaser' : 'laser', 'orbs'];
          if (this.phase >= 2) opts.push('shardStorm');
          this.setAttack(this.pick(opts));
        }
        return;
      case 'ring': {
        this.moveTo(pl.cx + this.side * 260, pl.cy - 80, 1.5);
        const n = this.phase >= 3 ? 24 : 16;
        if (t === 1 || t === 30 || t === 60) {
          this.ring(ctx, 'boss_shard', n, 4.2, t * 0.02 + (t === 30 ? Math.PI / n : 0), 0.6);
          ctx.audio.play('crystal', { x: this.cx, y: this.cy });
        }
        if (t > 100) this.setAttack('drift');
        return;
      }
      case 'spiral': {
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx;
        this.y += this.vy;
        const arms = this.phase >= 3 ? 3 : 2;
        const every = this.phase >= 3 ? 3 : 4;
        if (t % every === 0 && t < 160) {
          for (let k = 0; k < arms; k++) this.fire(ctx, 'boss_shard', this.cx, this.cy, t * 0.11 + (k * Math.PI * 2) / arms, 3.6, 0.55);
          if (t % 12 === 0) ctx.audio.play('crystal', { x: this.cx, y: this.cy, volume: 0.4, pitch: 1.5 });
        }
        if (t > 180) this.setAttack('drift');
        return;
      }
      case 'orbs':
        this.moveTo(pl.cx + this.side * 260, pl.cy - 100, 2);
        if (t % 18 === 0 && t <= 54) {
          this.fire(ctx, 'boss_orb', this.cx, this.cy, this.angleToPlayer(ctx) + (Math.random() - 0.5) * 1.5, 3.5, 0.75);
          ctx.audio.play('magic', { x: this.cx, y: this.cy, pitch: 0.6 });
        }
        if (t > 90) this.setAttack('drift');
        return;
      case 'laser': {
        this.vx *= 0.9;
        this.vy *= 0.9;
        if (t === 1) {
          const base = this.angleToPlayer(ctx);
          const sweep = (Math.random() < 0.5 ? -1 : 1) * 0.7;
          const L = 1100;
          this.hazards.push({
            kind: 'beam', x: this.cx, y: this.cy, x2: 0, y2: 0, width: 26, warn: 60, active: 70, age: 0, damage: this.damage, color: '#6fe0d0',
            step: (h) => {
              const k = h.age <= h.warn ? 0 : (h.age - h.warn) / h.active;
              const a = base - sweep / 2 + sweep * k;
              h.x = this.cx;
              h.y = this.cy;
              h.x2 = this.cx + Math.cos(a) * L;
              h.y2 = this.cy + Math.sin(a) * L;
            },
          });
          ctx.audio.play('charge', { x: this.cx, y: this.cy });
        }
        if (t > 60 && t % 4 === 0) ctx.shake(0.06);
        if (t > 135) this.setAttack('overheat');
        return;
      }
      case 'crossLaser': {
        this.vx *= 0.9;
        this.vy *= 0.9;
        if (t === 1) {
          const start = Math.random() * Math.PI;
          const dir = Math.random() < 0.5 ? -1 : 1;
          for (let k = 0; k < 4; k++) {
            const L = 1100;
            this.hazards.push({
              kind: 'beam', x: this.cx, y: this.cy, x2: 0, y2: 0, width: 22, warn: 70, active: 160, age: 0, damage: this.damage, color: '#9ff5ff',
              step: (h) => {
                const a = start + (k * Math.PI) / 2 + (h.age > h.warn ? (h.age - h.warn) * 0.011 * dir : 0);
                h.x = this.cx;
                h.y = this.cy;
                h.x2 = this.cx + Math.cos(a) * L;
                h.y2 = this.cy + Math.sin(a) * L;
              },
            });
          }
          ctx.audio.play('charge', { x: this.cx, y: this.cy, pitch: 0.7 });
          ctx.message('Obelisk Prime channels the Seal’s full power!', '#9ff5ff');
        }
        if (t > 240) this.setAttack('overheat');
        return;
      }
      case 'overheat':
        this.defense = 0;
        this.vy = 0.4;
        this.vx *= 0.9;
        this.y += this.vy;
        if (t === 1) ctx.message('Obelisk Prime is overheating — strike the core!', '#ffb070');
        if (t % 4 === 0) ctx.particles.smoke(this.cx + (Math.random() - 0.5) * 30, this.y);
        if (t > 150) {
          this.defense = this.bdef.defense;
          this.setAttack('drift');
        }
        return;
      case 'shardStorm': {
        this.moveTo(pl.cx, pl.cy - 260, 3);
        if (t === 1) {
          this.shardsOut = true;
          this.cage = [];
          const n = 14;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const pr = ctx.spawnProjectile('boss_shard', pl.cx + Math.cos(a) * 260, pl.cy + Math.sin(a) * 260, 0, 0, { damage: Math.round(this.damage * 0.6), knockback: 4, friendly: false, owner: this, lifeMul: 0.6 });
            if (pr) this.cage.push(pr);
            ctx.particles.emit(pl.cx + Math.cos(a) * 260, pl.cy + Math.sin(a) * 260, { count: 6, color: '#9ff5ff', glow: true, gravity: 0 });
          }
          ctx.audio.play('crystal', { x: pl.cx, y: pl.cy, pitch: 0.7 });
        }
        if (t === 50) {
          const tx = pl.cx;
          const ty = pl.cy;
          for (const pr of this.cage) {
            const a = Math.atan2(ty - pr.cy, tx - pr.cx);
            pr.vx = Math.cos(a) * 6;
            pr.vy = Math.sin(a) * 6;
          }
          ctx.audio.play('laser', { x: tx, y: ty, pitch: 1.5 });
        }
        if (t > 110) {
          this.shardsOut = false;
          this.setAttack('drift');
        }
        return;
      }
    }
  }

  protected override onPhase(ctx: GameContext, phase: number): void {
    super.onPhase(ctx, phase);
    this.hazards = [];
    this.defense = this.bdef.defense;
    this.setAttack('drift');
    ctx.message(phase === 2 ? 'The Obelisk’s runes flare brighter!' : 'The Seal begins to crack!', '#9ff5ff');
  }

  protected draw(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const [stone, rune, core, beam] = this.bdef.colors;
    const t = this.frameTime;
    const hot = this.attack === 'overheat';
    const open = hot ? Math.min(10, this.attackT * 0.5) : 0;
    const shards = this.shardPositions();
    const drawShard = (x: number, y: number, behind: boolean) => {
      g.fillStyle = behind ? shade(beam, 0.6) : beam;
      g.beginPath();
      g.moveTo(x, y - 14);
      g.lineTo(x + 6, y);
      g.lineTo(x, y + 14);
      g.lineTo(x - 6, y);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(x - 1, y - 8, 2, 8);
    };
    for (let i = 0; i < shards.length; i++) {
      const a = this.orbit + (i / SHARDS) * Math.PI * 2;
      if (Math.sin(a) < 0) drawShard(shards[i][0], shards[i][1], true);
    }
    g.save();
    g.translate(Math.round(this.cx), Math.round(this.cy + Math.sin(t * 0.05) * 3));
    // Two halves of the obelisk that part when overheating.
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * open, 0);
      g.fillStyle = shade(stone, 0.7);
      g.beginPath();
      g.moveTo(0, -56);
      g.lineTo(side * 26, -34);
      g.lineTo(side * 22, 50);
      g.lineTo(0, 56);
      g.fill();
      g.fillStyle = stone;
      g.beginPath();
      g.moveTo(0, -52);
      g.lineTo(side * 22, -32);
      g.lineTo(side * 18, 46);
      g.lineTo(0, 52);
      g.fill();
      // Runes
      g.fillStyle = hot ? '#ff8a4a' : rune;
      g.globalAlpha = 0.6 + Math.sin(t * 0.1 + side) * 0.4;
      for (let k = 0; k < 5; k++) g.fillRect(side * 10 - 2, -36 + k * 16, 4, 8);
      g.fillRect(side * 16 - 1, -20, 2, 30);
      g.globalAlpha = 1;
      g.restore();
    }
    // Core
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = hot ? '#ff6a2a' : rune;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(0, 0, 18 + Math.sin(t * 0.2) * 3, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = hot ? '#ffd070' : core;
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(7, 0);
    g.lineTo(0, 10);
    g.lineTo(-7, 0);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // Phase 3 cracks
    if (this.phase >= 3) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-6, -40);
      g.lineTo(4, -18);
      g.lineTo(-3, 20);
      g.lineTo(8, 42);
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < shards.length; i++) {
      const a = this.orbit + (i / SHARDS) * Math.PI * 2;
      if (Math.sin(a) >= 0) drawShard(shards[i][0], shards[i][1], false);
    }
    void ctx;
  }

  override light() {
    return this.attack === 'overheat' ? { x: this.cx, y: this.cy, r: 0.9, g: 0.4, b: 0.1, radius: 12 } : { x: this.cx, y: this.cy, r: 0.3, g: 0.8, b: 0.8, radius: 12 };
  }
}
