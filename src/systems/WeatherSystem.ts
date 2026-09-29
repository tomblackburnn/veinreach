import type { GameContext } from '../core/context';
import type { WeatherKind } from '../world/WorldState';
import { detectBiome } from '../biomes/BiomeDetector';

interface Drop {
  x: number;
  y: number;
  v: number;
  s: number;
}

/**
 * Global weather that is *expressed* per biome: rain falls as snow in the
 * Taiga and as a sandstorm in the Dunes. Storms add lightning and thunder.
 */
export class WeatherSystem {
  kind: WeatherKind = 'clear';
  remaining = 60 * 60 * 3;
  intensity = 0;
  wind = 0.3;
  private drops: Drop[] = [];
  private flash = 0;
  /** What is actually shown at the player's location. */
  local: WeatherKind = 'clear';

  set(kind: WeatherKind, ticks: number): void {
    this.kind = kind;
    this.remaining = ticks;
  }

  load(s: { kind: WeatherKind; remaining: number; intensity: number }): void {
    this.kind = s.kind;
    this.remaining = s.remaining;
    this.intensity = s.intensity;
  }

  serialize() {
    return { kind: this.kind, remaining: this.remaining, intensity: this.intensity };
  }

  update(ctx: GameContext): void {
    if (--this.remaining <= 0) {
      const r = Math.random();
      this.kind = this.kind !== 'clear' ? 'clear' : r < 0.55 ? 'rain' : r < 0.8 ? 'storm' : 'clear';
      this.remaining = 60 * 60 * (2 + Math.random() * 5);
    }
    const target = this.kind === 'clear' ? 0 : this.kind === 'storm' || this.kind === 'veilstorm' ? 1 : 0.7;
    this.intensity += (target - this.intensity) * 0.005;
    this.wind += ((this.kind === 'storm' ? 1.5 : 0.3) * Math.sin(ctx.tick * 0.0005) - this.wind) * 0.002;
    // Local expression by biome.
    if (ctx.tick % 60 === 0) {
      const p = ctx.player;
      const zone = ctx.world.zoneAt(p.tileY);
      const biome = zone === 'surface' || zone === 'sky' ? detectBiome(ctx.world, p.tileX, p.tileY) : 'underground';
      if (this.kind === 'clear' || biome === 'underground') this.local = 'clear';
      else if (this.kind === 'veilstorm') this.local = 'veilstorm';
      else if (biome === 'taiga') this.local = 'snow';
      else if (biome === 'dunes') this.local = 'sandstorm';
      else this.local = this.kind;
    }
    if ((this.local === 'storm' || this.local === 'veilstorm') && Math.random() < 0.002 * this.intensity) {
      this.flash = 10;
      setTimeout(() => ctx.audio.play('thunder', { volume: 0.9 }), 300 + Math.random() * 900);
    }
    if (this.flash > 0) this.flash--;
    const surfaceFactor = this.surfaceFactor(ctx);
    const rain = this.local === 'rain' || this.local === 'storm' || this.local === 'veilstorm' ? this.intensity * surfaceFactor : 0;
    const wind = (this.local === 'sandstorm' || this.local === 'storm' ? this.intensity : 0.1) * surfaceFactor;
    if (ctx.tick % 30 === 0) ctx.audio.setAmbience({ rain, wind });
  }

  private surfaceFactor(ctx: GameContext): number {
    const depth = ctx.player.tileY - ctx.world.layers.undergroundY;
    return Math.max(0, Math.min(1, 1 - depth / 20));
  }

  /** Screen-space precipitation. */
  render(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const W = ctx.camera.viewW;
    const H = ctx.camera.viewH;
    const f = this.surfaceFactor(ctx) * this.intensity;
    if (this.flash > 0) {
      g.fillStyle = `rgba(230,230,255,${(this.flash / 10) * 0.5})`;
      g.fillRect(0, 0, W, H);
    }
    if (f < 0.02 || this.local === 'clear') {
      this.drops.length = 0;
      return;
    }
    const want = Math.floor((this.local === 'snow' ? 260 : this.local === 'sandstorm' ? 320 : 380) * f * ctx.particles.density);
    while (this.drops.length < want) this.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.8, s: Math.random() });
    if (this.drops.length > want) this.drops.length = want;
    const camDX = ctx.camera.x;
    g.save();
    switch (this.local) {
      case 'snow':
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (const d of this.drops) {
          d.y += d.v * 1.4;
          d.x += this.wind * 0.8 + Math.sin(d.y * 0.02 + d.s * 10) * 0.6;
          this.wrap(d, W, H);
          const s = d.s > 0.7 ? 3 : 2;
          g.fillRect(d.x, d.y, s, s);
        }
        break;
      case 'sandstorm':
        g.fillStyle = `rgba(220,190,120,${0.18 * f})`;
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(230,200,130,0.7)';
        for (const d of this.drops) {
          d.x += 8 * d.v + this.wind * 3;
          d.y += Math.sin(d.x * 0.01 + d.s * 6) * 0.8 + 0.3;
          this.wrap(d, W, H);
          g.fillRect(d.x, d.y, 3 + d.s * 5, 1);
        }
        break;
      default: {
        const veil = this.local === 'veilstorm';
        g.strokeStyle = veil ? 'rgba(200,140,255,0.55)' : 'rgba(170,190,230,0.55)';
        g.lineWidth = 1;
        g.beginPath();
        const slant = this.wind * 2.5;
        for (const d of this.drops) {
          d.y += 14 * d.v;
          d.x += slant;
          this.wrap(d, W, H);
          g.moveTo(d.x, d.y);
          g.lineTo(d.x - slant * 1.5, d.y - 10 * d.v);
        }
        g.stroke();
        if (veil) {
          g.fillStyle = `rgba(60,10,90,${0.12 * f})`;
          g.fillRect(0, 0, W, H);
        }
      }
    }
    g.restore();
    void camDX;
  }

  private wrap(d: Drop, W: number, H: number): void {
    if (d.y > H) {
      d.y -= H + 20;
      d.x = Math.random() * W;
    }
    if (d.x > W + 20) d.x -= W + 40;
    if (d.x < -20) d.x += W + 40;
  }
}
