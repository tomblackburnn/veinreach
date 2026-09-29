import { BIOMES, type BiomeKey, type BackgroundKind } from '../data/biomes';
import type { Camera } from '../engine/Camera';
import type { TimeSystem } from '../systems/TimeSystem';
import { makeCanvas, ctx2d, type Canvas2D } from './sprites/pixel';
import { Noise2D } from '../utils/noise';
import { shade, mix } from '../utils/color';
import { Rng } from '../utils/random';

const LAYER_W = 1024;
const LAYER_H = 320;

interface Layers {
  far: Canvas2D;
  mid: Canvas2D;
  near: Canvas2D;
}

const noise = new Noise2D(1337);

function ridge(g: CanvasRenderingContext2D, color: string, base: number, amp: number, freq: number, seed: number, jag = 0): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 4) {
    // Seamless horizontally: sample noise on a circle.
    const a = (x / LAYER_W) * Math.PI * 2;
    const n = noise.fbm(Math.cos(a) * freq + seed, Math.sin(a) * freq + seed, 4);
    const j = jag ? (Math.abs(((x / 4) % 8) - 4) - 2) * jag : 0;
    g.lineTo(x, base - n * amp + j);
  }
  g.lineTo(LAYER_W, LAYER_H);
  g.closePath();
  g.fill();
}

function scatter(g: CanvasRenderingContext2D, count: number, seed: number, draw: (x: number, rng: Rng) => void): void {
  const rng = new Rng(seed);
  for (let i = 0; i < count; i++) draw(rng.range(0, LAYER_W), rng);
}

/** Procedurally paint the three parallax layers for a background kind. */
function paint(kind: BackgroundKind, cols: [string, string, string]): Layers {
  const make = () => {
    const c = makeCanvas(LAYER_W, LAYER_H);
    return { c, g: ctx2d(c) };
  };
  const far = make();
  const mid = make();
  const near = make();
  const [c0, c1, c2] = cols;
  switch (kind) {
    case 'dunes':
      ridge(far.g, c0, 190, 50, 1.2, 3);
      ridge(mid.g, c1, 230, 40, 1.8, 7);
      ridge(near.g, c2, 270, 30, 2.5, 11);
      scatter(near.g, 6, 5, (x, r) => {
        const h = r.range(20, 40);
        near.g.fillStyle = shade(c2, 0.7);
        near.g.fillRect(x, 260 - h, 6, h + 20);
        near.g.fillRect(x - 6, 250 - h * 0.6, 6, 4);
        near.g.fillRect(x - 6, 240 - h * 0.6, 3, 12);
      });
      break;
    case 'pines':
      ridge(far.g, c0, 150, 90, 1.4, 1, 3);
      ridge(mid.g, c1, 220, 40, 2, 4);
      scatter(mid.g, 40, 9, (x, r) => pine(mid.g, x, 215 - r.range(0, 30), r.range(30, 60), shade(c1, 0.8)));
      ridge(near.g, c2, 275, 20, 3, 8);
      scatter(near.g, 30, 21, (x, r) => pine(near.g, x, 272 - r.range(0, 10), r.range(50, 90), c2));
      break;
    case 'mire':
      ridge(far.g, c0, 210, 30, 1.2, 2);
      ridge(mid.g, c1, 240, 20, 2, 6);
      scatter(mid.g, 18, 3, (x, r) => deadTree(mid.g, x, 240, r.range(40, 80), shade(c1, 0.8)));
      ridge(near.g, c2, 280, 12, 3, 9);
      scatter(near.g, 12, 13, (x, r) => deadTree(near.g, x, 280, r.range(60, 110), c2));
      break;
    case 'sea':
      far.g.fillStyle = c1;
      far.g.fillRect(0, 230, LAYER_W, LAYER_H);
      far.g.fillStyle = shade(c1, 1.2);
      for (let y = 235; y < LAYER_H; y += 8) for (let x = (y * 7) % 40; x < LAYER_W; x += 40) far.g.fillRect(x, y, 16, 1);
      ridge(mid.g, c2, 290, 10, 2, 5);
      break;
    case 'cave':
    case 'keep':
      ridge(far.g, c0, 120, 60, 2, 1);
      ridge(mid.g, c1, 180, 70, 2.5, 5, 2);
      ridge(near.g, c2, 240, 60, 3, 9, 3);
      if (kind === 'keep') scatter(far.g, 6, 4, (x, r) => tower(far.g, x, 200, r.range(80, 140), shade(c0, 0.8)));
      break;
    case 'mushroom':
      ridge(far.g, c0, 120, 50, 2, 3);
      scatter(mid.g, 14, 8, (x, r) => mushroom(mid.g, x, 260, r.range(60, 120), c1, '#2a8aa0'));
      scatter(near.g, 10, 12, (x, r) => mushroom(near.g, x, 300, r.range(80, 150), c2, '#45c8d8'));
      break;
    case 'crystal':
      ridge(far.g, c0, 140, 50, 2, 3);
      scatter(mid.g, 26, 8, (x, r) => crystal(mid.g, x, 280, r.range(40, 120), shade(c1, 1.3)));
      scatter(near.g, 18, 11, (x, r) => crystal(near.g, x, 320, r.range(60, 160), shade(c2, 1.6)));
      break;
    case 'hellscape':
      ridge(far.g, c0, 170, 90, 1.6, 2, 4);
      ridge(mid.g, c1, 230, 60, 2.2, 6, 3);
      scatter(mid.g, 8, 3, (x, r) => tower(mid.g, x, 230, r.range(60, 120), shade(c1, 0.7)));
      ridge(near.g, c2, 285, 30, 3, 10, 2);
      break;
    case 'shards':
      ridge(far.g, c0, 170, 60, 1.6, 4);
      scatter(mid.g, 22, 7, (x, r) => crystal(mid.g, x, 260, r.range(60, 140), shade(c1, 1.4)));
      ridge(near.g, c2, 280, 20, 3, 8);
      scatter(near.g, 12, 17, (x, r) => crystal(near.g, x, 290, r.range(60, 120), '#b04fe0'));
      break;
    default: // hills
      ridge(far.g, c0, 180, 70, 1.2, 1);
      ridge(mid.g, c1, 230, 45, 1.8, 4);
      scatter(mid.g, 30, 5, (x, r) => roundTree(mid.g, x, 230 - r.range(0, 25), r.range(14, 24), shade(c1, 0.85)));
      ridge(near.g, c2, 270, 30, 2.4, 9);
      scatter(near.g, 22, 7, (x, r) => roundTree(near.g, x, 268 - r.range(0, 12), r.range(20, 34), c2));
  }
  return { far: far.c, mid: mid.c, near: near.c };
}

function pine(g: CanvasRenderingContext2D, x: number, base: number, h: number, c: string): void {
  g.fillStyle = c;
  for (let i = 0; i < h; i += 2) {
    const w = (i / h) * h * 0.45;
    g.fillRect(x - w / 2, base - h + i, w, 2);
  }
  g.fillRect(x - 2, base, 4, 10);
}

function roundTree(g: CanvasRenderingContext2D, x: number, base: number, r: number, c: string): void {
  g.fillStyle = shade(c, 0.8);
  g.fillRect(x - 2, base - r * 0.3, 4, r * 1.4);
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, base - r, r, 0, Math.PI * 2);
  g.arc(x - r * 0.7, base - r * 0.6, r * 0.7, 0, Math.PI * 2);
  g.arc(x + r * 0.7, base - r * 0.6, r * 0.7, 0, Math.PI * 2);
  g.fill();
}

function deadTree(g: CanvasRenderingContext2D, x: number, base: number, h: number, c: string): void {
  g.strokeStyle = c;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x, base - h);
  g.moveTo(x, base - h * 0.6);
  g.lineTo(x - h * 0.3, base - h * 0.9);
  g.moveTo(x, base - h * 0.75);
  g.lineTo(x + h * 0.25, base - h);
  g.stroke();
}

function tower(g: CanvasRenderingContext2D, x: number, base: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x - 12, base - h, 24, h + 100);
  for (let i = 0; i < 4; i++) g.fillRect(x - 14 + i * 8, base - h - 8, 5, 8);
  g.fillStyle = 'rgba(255,160,60,0.35)';
  for (let y = base - h + 20; y < base; y += 30) g.fillRect(x - 3, y, 6, 10);
}

function mushroom(g: CanvasRenderingContext2D, x: number, base: number, h: number, c: string, glow: string): void {
  g.fillStyle = shade(c, 1.3);
  g.fillRect(x - 5, base - h, 10, h);
  g.fillStyle = c;
  g.beginPath();
  g.ellipse(x, base - h, h * 0.45, h * 0.2, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = glow;
  for (let i = 0; i < 5; i++) g.fillRect(x - h * 0.3 + i * h * 0.15, base - h - h * 0.08, 3, 3);
}

function crystal(g: CanvasRenderingContext2D, x: number, base: number, h: number, c: string): void {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x - h * 0.12, base);
  g.lineTo(x, base - h);
  g.lineTo(x + h * 0.12, base);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.moveTo(x - h * 0.03, base);
  g.lineTo(x, base - h);
  g.lineTo(x + h * 0.02, base);
  g.fill();
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  speed: number;
  canvas: Canvas2D;
}

/** Sky, celestial bodies, clouds and biome parallax layers (screen space). */
export class BackgroundRenderer {
  private cache = new Map<string, Layers>();
  private stars: [number, number, number][] = [];
  private clouds: Cloud[] = [];
  private current: BiomeKey = 'meadow';
  private previous: BiomeKey = 'meadow';
  private blend = 1;
  wind = 0.3;

  constructor() {
    const rng = new Rng(99);
    for (let i = 0; i < 220; i++) this.stars.push([rng.next(), rng.next() * 0.7, rng.range(0.4, 1)]);
    for (let i = 0; i < 12; i++) this.clouds.push(this.makeCloud(rng, rng.range(0, 1)));
  }

  private makeCloud(rng: Rng, x: number): Cloud {
    const w = rng.int(60, 160);
    const h = Math.round(w * 0.35);
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const r = rng.range(h * 0.3, h * 0.5);
      g.beginPath();
      g.arc(rng.range(r, w - r), rng.range(h * 0.45, h - r), r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(200,210,230,0.6)';
    g.fillRect(0, h - 4, w, 4);
    return { x, y: rng.range(0.03, 0.3), w, speed: rng.range(0.5, 1.2), canvas: c };
  }

  private layers(key: BiomeKey): Layers {
    let l = this.cache.get(key);
    if (!l) {
      const b = BIOMES[key];
      l = paint(b.background, b.bgColors);
      this.cache.set(key, l);
    }
    return l;
  }

  setBiome(b: BiomeKey): void {
    if (b === this.current) return;
    this.previous = this.current;
    this.current = b;
    this.blend = 0;
  }

  render(g: CanvasRenderingContext2D, cam: Camera, time: TimeSystem, surfaceY: number, underworldY: number, dark: { r: number; g: number; b: number }, eventTint: string | null): void {
    const W = cam.viewW;
    const H = cam.viewH;
    this.blend = Math.min(1, this.blend + 0.02);
    // Depth factor: 0 at surface, 1 deep underground.
    const camTileY = cam.y / 16;
    const underground = Math.max(0, Math.min(1, (camTileY - (surfaceY + 20)) / 30));
    const hellish = camTileY > underworldY - 30 ? Math.min(1, (camTileY - (underworldY - 30)) / 30) : 0;

    // Sky gradient
    let [top, bot] = time.skyColors();
    const tint = BIOMES[this.current].skyTint;
    if (tint) {
      top = mix(top, shade(tint, 0.6), 0.2);
      bot = mix(bot, tint, 0.25);
    }
    if (eventTint) {
      top = mix(top, eventTint, 0.45);
      bot = mix(bot, eventTint, 0.35);
    }
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    if (underground < 1) {
      g.save();
      g.globalAlpha = 1 - underground;
      // Stars
      const dl = time.daylight;
      if (dl < 0.8) {
        g.fillStyle = '#ffffff';
        for (const [sx, sy, b] of this.stars) {
          const tw = 0.6 + Math.sin(performance.now() * 0.002 + sx * 100) * 0.4;
          g.globalAlpha = (1 - underground) * (1 - dl / 0.8) * b * tw;
          g.fillRect(((sx * W * 1.5 - cam.x * 0.02) % W + W) % W, sy * H, 2, 2);
        }
        g.globalAlpha = 1 - underground;
      }
      // Sun and moon on an arc.
      const cp = time.celestialProgress();
      const arc = (p: number) => [W * 0.1 + p * W * 0.8, H * 0.55 - Math.sin(p * Math.PI) * H * 0.45] as const;
      if (time.hour > 4.5 && time.hour < 19.5) {
        const [sx, sy] = arc(cp.sun);
        g.fillStyle = 'rgba(255,240,180,0.25)';
        g.beginPath();
        g.arc(sx, sy, 38, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff4c0';
        g.fillRect(sx - 16, sy - 16, 32, 32);
        g.fillStyle = '#ffe070';
        g.fillRect(sx - 12, sy - 12, 24, 24);
      } else {
        const [mx, my] = arc(cp.moon);
        g.fillStyle = eventTint ? '#e0a0ff' : '#e8ecf8';
        g.beginPath();
        g.arc(mx, my, 16, 0, Math.PI * 2);
        g.fill();
        const phase = time.moonPhase;
        if (phase !== 4) {
          g.fillStyle = top;
          g.beginPath();
          g.arc(mx + (phase < 4 ? -1 : 1) * (32 - Math.abs(phase - 4) * 7), my, 16, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Clouds
      const cloudShade = Math.max(0.25, time.daylight);
      for (const c of this.clouds) {
        c.x += (this.wind * c.speed * 0.0003);
        if (c.x > 1.2) c.x -= 1.4;
        if (c.x < -0.2) c.x += 1.4;
        g.globalAlpha = (1 - underground) * 0.85;
        g.filter = cloudShade < 1 ? `brightness(${cloudShade})` : 'none';
        g.drawImage(c.canvas, c.x * W - cam.x * 0.03 % W, c.y * H - Math.max(0, (cam.y / 16 - surfaceY) * 0.5));
      }
      g.filter = 'none';
      g.globalAlpha = 1 - underground;
      // Parallax layers
      this.drawBiomeLayers(g, cam, surfaceY, this.previous, 1 - this.blend, 1 - underground);
      this.drawBiomeLayers(g, cam, surfaceY, this.current, this.blend, 1 - underground);
      // Night darkening of the scenery.
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${Math.round(Math.max(0.25, dark.r) * 255)},${Math.round(Math.max(0.28, dark.g) * 255)},${Math.round(Math.max(0.35, dark.b) * 255)})`;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (underground > 0) {
      g.save();
      g.globalAlpha = underground;
      const cave = hellish > 0.5 ? 'emberdeep' : this.current === 'emberdeep' || this.current === 'sporeglow' || this.current === 'glimmer' || this.current === 'keep' || this.current === 'shardblight' ? this.current : 'underground';
      const b = BIOMES[cave];
      g.fillStyle = shade(b.bgColors[2], 0.6);
      g.fillRect(0, 0, W, H);
      const L = this.layers(cave);
      const s = 2;
      const draw = (c: Canvas2D, f: number, yOff: number) => {
        const w = c.width * s;
        const off = ((-cam.x * f) % w + w) % w;
        const y = H - c.height * s + yOff + ((-cam.y * f * 0.5) % 200);
        for (let x = off - w; x < W; x += w) g.drawImage(c, x, y, w, c.height * s);
      };
      g.globalAlpha = underground * 0.5;
      draw(L.far, 0.1, 40);
      g.globalAlpha = underground * 0.65;
      draw(L.mid, 0.2, 80);
      g.restore();
    }
  }

  private drawBiomeLayers(g: CanvasRenderingContext2D, cam: Camera, surfaceY: number, key: BiomeKey, alpha: number, depthAlpha: number): void {
    if (alpha <= 0.01) return;
    const L = this.layers(key);
    const W = cam.viewW;
    const H = cam.viewH;
    const scale = 2;
    const horizon = (surfaceY * 16 - cam.y) * cam.zoom;
    const layers: [Canvas2D, number, number][] = [
      [L.far, 0.08, 0.15],
      [L.mid, 0.18, 0.3],
      [L.near, 0.32, 0.45],
    ];
    for (const [c, fx, fy] of layers) {
      const w = c.width * scale;
      const h = c.height * scale;
      const off = ((-cam.x * fx * cam.zoom) % w + w) % w;
      const y = H * 0.5 + horizon * fy - h * 0.72 + 60;
      g.globalAlpha = alpha * depthAlpha;
      for (let x = off - w; x < W; x += w) g.drawImage(c, Math.floor(x), Math.floor(y), w, h);
      // Fill below the layer so no sky shows through.
      const last = c === L.near;
      if (last && y + h < H) {
        g.fillStyle = BIOMES[key].bgColors[2];
        g.fillRect(0, y + h - 1, W, H - (y + h) + 1);
      }
    }
    g.globalAlpha = 1;
  }
}
