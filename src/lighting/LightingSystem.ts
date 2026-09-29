import type { World } from '../world/World';
import { TileRegistry, LIQUID } from '../world/TileRegistry';
import type { LightSource } from '../entities/Entity';
import { hexToRgb } from '../utils/color';

const MARGIN = 14;
const DECAY_AIR = 0.9;
const DECAY_SOLID = 0.6;
const DECAY_WATER = 0.8;

/**
 * Tile-resolution RGB light propagation over the visible region.
 * Uses separable forward/backward sweeps (cheap, O(cells)) instead of per-pixel
 * lighting; the resulting lightmap is upscaled with smoothing and multiplied
 * over the scene.
 */
export class LightingSystem {
  private gw = 0;
  private gh = 0;
  private r = new Float32Array(0);
  private g = new Float32Array(0);
  private b = new Float32Array(0);
  private dr = new Float32Array(0);
  private dg = new Float32Array(0);
  private db = new Float32Array(0);
  x0 = 0;
  y0 = 0;
  readonly canvas: HTMLCanvasElement | null;
  private cctx: CanvasRenderingContext2D | null;
  private img: ImageData | null = null;
  fullbright = false;
  /** Called for each newly-explored tile (minimap). */
  onExplore: ((x: number, y: number) => void) | null = null;

  constructor() {
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    this.cctx = this.canvas ? this.canvas.getContext('2d') : null;
  }

  private ensure(w: number, h: number): void {
    if (w === this.gw && h === this.gh) return;
    this.gw = w;
    this.gh = h;
    const n = w * h;
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.dr = new Float32Array(n);
    this.dg = new Float32Array(n);
    this.db = new Float32Array(n);
    if (this.canvas && this.cctx) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.img = this.cctx.createImageData(w, h);
    }
  }

  /** Light level (0..1, max channel) at a tile — used for gameplay (spawning in darkness). */
  levelAt(tx: number, ty: number): number {
    const x = tx - this.x0;
    const y = ty - this.y0;
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return 0;
    const i = y * this.gw + x;
    return Math.max(this.r[i], this.g[i], this.b[i]);
  }

  /** RGB light at a tile (0..1 each), or null outside the computed area. */
  colorAt(tx: number, ty: number): [number, number, number] | null {
    const x = tx - this.x0;
    const y = ty - this.y0;
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return null;
    const i = y * this.gw + x;
    return [this.r[i], this.g[i], this.b[i]];
  }

  compute(world: World, left: number, top: number, right: number, bottom: number, sky: { r: number; g: number; b: number }, lights: LightSource[], opts: { nightVision: boolean; ambient?: [number, number, number] }): void {
    const x0 = Math.floor(left / 16) - MARGIN;
    const y0 = Math.floor(top / 16) - MARGIN;
    const x1 = Math.ceil(right / 16) + MARGIN;
    const y1 = Math.ceil(bottom / 16) + MARGIN;
    const gw = x1 - x0;
    const gh = y1 - y0;
    this.ensure(gw, gh);
    this.x0 = x0;
    this.y0 = y0;
    const { r, g, b, dr, dg, db } = this;
    const L = world.layers;
    const uw = L.underworldY;
    const emits = TileRegistry.emits;
    const opaque = TileRegistry.opaque;
    const tinted = TileRegistry.tinted;
    const prism = TileRegistry.tryId('prism_glass') ?? -1;

    // Seed
    for (let gy = 0; gy < gh; gy++) {
      const ty = y0 + gy;
      for (let gx = 0; gx < gw; gx++) {
        const tx = x0 + gx;
        const i = gy * gw + gx;
        let lr = 0;
        let lg = 0;
        let lb = 0;
        let dec = DECAY_AIR;
        if (!world.inBounds(tx, ty)) {
          dec = DECAY_SOLID;
          if (ty < 0) {
            lr = sky.r;
            lg = sky.g;
            lb = sky.b;
          }
        } else {
          const fg = world.getFg(tx, ty);
          if (opaque[fg]) dec = DECAY_SOLID;
          const liq = world.getLiquid(tx, ty);
          if (liq > 0) {
            if (world.getLiquidType(tx, ty) === LIQUID.lava) {
              const k = liq / 255;
              lr = 0.95 * k;
              lg = 0.45 * k;
              lb = 0.12 * k;
            } else dec = Math.min(dec, DECAY_WATER);
          }
          const skyTop = world.skyTop[tx];
          if (ty <= skyTop || (ty < L.undergroundY && !opaque[fg] && world.getWall(tx, ty) === 0)) {
            lr = Math.max(lr, sky.r);
            lg = Math.max(lg, sky.g);
            lb = Math.max(lb, sky.b);
          } else if (ty >= uw && !opaque[fg]) {
            lr = Math.max(lr, 0.16);
            lg = Math.max(lg, 0.06);
            lb = Math.max(lb, 0.03);
          }
          if (emits[fg]) {
            lr = Math.max(lr, TileRegistry.lightR[fg]);
            lg = Math.max(lg, TileRegistry.lightG[fg]);
            lb = Math.max(lb, TileRegistry.lightB[fg]);
          }
          if (tinted[fg]) {
            // Stained glass filters whatever passes through (including its own skylight).
            const [kr, kg, kb] = fg === prism ? prismTint(tx, ty) : [TileRegistry.tintR[fg], TileRegistry.tintG[fg], TileRegistry.tintB[fg]];
            lr *= kr;
            lg *= kg;
            lb *= kb;
            r[i] = lr;
            g[i] = lg;
            b[i] = lb;
            dr[i] = dec * kr;
            dg[i] = dec * kg;
            db[i] = dec * kb;
            continue;
          }
        }
        r[i] = lr;
        g[i] = lg;
        b[i] = lb;
        dr[i] = dg[i] = db[i] = dec;
      }
    }
    for (const s of lights) {
      const gx = Math.floor(s.x / 16) - x0;
      const gy = Math.floor(s.y / 16) - y0;
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
      const i = gy * gw + gx;
      const k = Math.min(1.3, 0.55 + s.radius * 0.06);
      r[i] = Math.max(r[i], s.r * k);
      g[i] = Math.max(g[i], s.g * k);
      b[i] = Math.max(b[i], s.b * k);
    }

    // Propagate
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < gh; y++) {
        const row = y * gw;
        for (let x = 1; x < gw; x++) this.spread(row + x, row + x - 1);
        for (let x = gw - 2; x >= 0; x--) this.spread(row + x, row + x + 1);
      }
      for (let x = 0; x < gw; x++) {
        for (let y = 1; y < gh; y++) this.spread(y * gw + x, (y - 1) * gw + x);
        for (let y = gh - 2; y >= 0; y--) this.spread(y * gw + x, (y + 1) * gw + x);
      }
    }

    const amb = opts.ambient ?? [0, 0, 0];
    const nv = opts.nightVision ? 0.28 : 0;
    // Exploration + output image.
    const data = this.img?.data;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const i = gy * gw + gx;
        let lr = Math.max(r[i], amb[0], nv);
        let lg = Math.max(g[i], amb[1], nv);
        let lb = Math.max(b[i], amb[2], nv * 1.1);
        if (this.fullbright) lr = lg = lb = 1;
        r[i] = lr;
        g[i] = lg;
        b[i] = lb;
        if (lr + lg + lb > 0.25 && this.onExplore) {
          const tx = x0 + gx;
          const ty = y0 + gy;
          if (world.markExplored(tx, ty)) this.onExplore(tx, ty);
        }
        if (data) {
          const o = i * 4;
          data[o] = lr >= 1 ? 255 : lr * 255;
          data[o + 1] = lg >= 1 ? 255 : lg * 255;
          data[o + 2] = lb >= 1 ? 255 : lb * 255;
          data[o + 3] = 255;
        }
      }
    }
    if (this.img && this.cctx) this.cctx.putImageData(this.img, 0, 0);
  }

  private spread(i: number, from: number): void {
    const r = this.r[from] * this.dr[i];
    const g = this.g[from] * this.dg[i];
    const b = this.b[from] * this.db[i];
    if (r > this.r[i]) this.r[i] = r;
    if (g > this.g[i]) this.g[i] = g;
    if (b > this.b[i]) this.b[i] = b;
  }

  /** Multiply the lightmap over the world (ctx in world space). */
  render(ctx: CanvasRenderingContext2D, smooth: boolean): void {
    if (!this.canvas || this.fullbright) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(this.canvas, this.x0 * 16, this.y0 * 16, this.gw * 16, this.gh * 16);
    ctx.restore();
  }
}

/** Prism glass tints light by position, so a pane casts a rainbow. */
const PRISM: [number, number, number][] = [
  [1, 0.4, 0.4],
  [1, 0.72, 0.3],
  [0.95, 1, 0.35],
  [0.4, 1, 0.5],
  [0.4, 0.65, 1],
  [0.75, 0.45, 1],
];
export function prismTint(x: number, y: number): [number, number, number] {
  return PRISM[(((x + y) % 6) + 6) % 6];
}

export function skyLight(daylight: number, tint?: string): { r: number; g: number; b: number } {
  const night = [0.07, 0.09, 0.17];
  const day = tint ? hexToRgb(tint).map((v) => v / 255) : [1, 1, 1];
  const k = daylight;
  return { r: night[0] + (day[0] - night[0]) * k, g: night[1] + (day[1] - night[1]) * k, b: night[2] + (day[2] - night[2]) * k };
}
