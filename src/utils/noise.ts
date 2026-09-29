/**
 * Seeded 2D gradient (Perlin-style) noise plus fractal helpers.
 * Output of `perlin2` is roughly in [-1, 1].
 */
import { Rng } from './random';

export class Noise2D {
  private perm: Uint8Array;
  private gx: Float32Array;
  private gy: Float32Array;

  constructor(seed: number) {
    const rng = new Rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.gx = new Float32Array(256);
    this.gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const a = rng.next() * Math.PI * 2;
      this.gx[i] = Math.cos(a);
      this.gy[i] = Math.sin(a);
    }
  }

  perlin2(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    const d00 = this.gx[aa] * xf + this.gy[aa] * yf;
    const d10 = this.gx[ba] * (xf - 1) + this.gy[ba] * yf;
    const d01 = this.gx[ab] * xf + this.gy[ab] * (yf - 1);
    const d11 = this.gx[bb] * (xf - 1) + this.gy[bb] * (yf - 1);
    const u = fade(xf);
    const v = fade(yf);
    const x1 = d00 + u * (d10 - d00);
    const x2 = d01 + u * (d11 - d01);
    return (x1 + v * (x2 - x1)) * 1.41421356;
  }

  perlin1(x: number): number {
    return this.perlin2(x, 0.5);
  }

  /** Fractal Brownian motion. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.perlin2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  /** Ridged noise in [0,1]; values near 1 form thin ridges — good for tunnels. */
  ridged(x: number, y: number, octaves = 3): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.perlin2(x * freq, y * freq));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
