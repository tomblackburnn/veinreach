import { fx } from '../utils/random';

export interface EmitOpts {
  count?: number;
  color?: string;
  colors?: string[];
  speed?: [number, number];
  /** Direction in radians; omit for all directions. */
  angle?: number;
  spread?: number;
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  glow?: boolean;
  /** Spawn jitter radius in px. */
  jitter?: number;
}

const MAX = 4000;

/**
 * Pooled particle system using struct-of-arrays storage. Particles are purely
 * cosmetic and never affect simulation, so they use non-seeded randomness.
 */
export class ParticleSystem {
  private x = new Float32Array(MAX);
  private y = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private glow = new Uint8Array(MAX);
  private color: string[] = new Array(MAX).fill('#fff');
  private count = 0;
  /** Global intensity (settings). */
  density = 1;

  get active(): number {
    return this.count;
  }

  emit(x: number, y: number, o: EmitOpts = {}): void {
    const n = Math.round((o.count ?? 8) * this.density);
    for (let k = 0; k < n; k++) {
      if (this.count >= MAX) return;
      const i = this.count++;
      const a = o.angle !== undefined ? o.angle + fx.range(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : fx.range(0, Math.PI * 2);
      const sp = fx.range(o.speed?.[0] ?? 0.5, o.speed?.[1] ?? 2.5);
      const j = o.jitter ?? 2;
      this.x[i] = x + fx.range(-j, j);
      this.y[i] = y + fx.range(-j, j);
      this.vx[i] = Math.cos(a) * sp;
      this.vy[i] = Math.sin(a) * sp;
      const l = fx.range(o.life?.[0] ?? 20, o.life?.[1] ?? 40);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.size[i] = fx.range(o.size?.[0] ?? 1, o.size?.[1] ?? 2.5);
      this.grav[i] = o.gravity ?? 0.12;
      this.drag[i] = o.drag ?? 0.96;
      this.glow[i] = o.glow ? 1 : 0;
      this.color[i] = o.colors ? fx.pick(o.colors) : o.color ?? '#ffffff';
    }
  }

  /** Common presets */
  dust(x: number, y: number, color: string, count = 6): void {
    this.emit(x, y, { count, color, speed: [0.5, 2], life: [15, 30], size: [1, 2.5], gravity: 0.15, jitter: 6 });
  }

  sparks(x: number, y: number, color: string, count = 10, angle?: number): void {
    this.emit(x, y, { count, color, speed: [1.5, 4.5], life: [10, 25], size: [1, 2], gravity: 0.1, glow: true, angle, spread: angle !== undefined ? 0.8 : undefined });
  }

  smoke(x: number, y: number, count = 6): void {
    this.emit(x, y, { count, colors: ['#555', '#666', '#444'], speed: [0.2, 0.8], angle: -Math.PI / 2, spread: 0.6, life: [40, 80], size: [2, 4], gravity: -0.02, drag: 0.98 });
  }

  splash(x: number, y: number, color: string): void {
    this.emit(x, y, { count: 12, color, speed: [1, 3.5], angle: -Math.PI / 2, spread: 0.9, life: [15, 30], size: [1, 2], gravity: 0.2 });
  }

  update(): void {
    let i = 0;
    while (i < this.count) {
      this.life[i]--;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      this.vx[i] *= this.drag[i];
      this.vy[i] = this.vy[i] * this.drag[i] + this.grav[i];
      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];
      i++;
    }
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last];
    this.y[i] = this.y[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.size[i] = this.size[last];
    this.grav[i] = this.grav[last];
    this.drag[i] = this.drag[last];
    this.glow[i] = this.glow[last];
    this.color[i] = this.color[last];
  }

  /** Draw in world space (ctx already transformed). */
  render(g: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number): void {
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.count; i++) {
        if (this.glow[i] !== pass) continue;
        const x = this.x[i];
        const y = this.y[i];
        if (x < left || x > right || y < top || y > bottom) continue;
        const t = this.life[i] / this.maxLife[i];
        g.globalAlpha = Math.min(1, t * 1.5);
        g.fillStyle = this.color[i];
        const s = this.size[i] * (0.5 + t * 0.5);
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  clear(): void {
    this.count = 0;
  }
}
