import type { World } from '../world/World';
import { TileRegistry } from '../world/TileRegistry';
import { hourglassHalfWidth } from './sprites/objectSprites';
import { hash3 } from '../utils/random';

const S = 16;

/** World conditions animated decorations react to. */
export interface DecorEnv {
  tick: number;
  /** Signed wind strength (weather). */
  wind: number;
  hour: number;
  moonPhase: number;
}

/** Keys of decorations with per-frame animation, drawn once at their origin. */
export const ANIMATED_DECOR = ['wind_chime', 'weathervane', 'pennant', 'hanging_lantern', 'wisp_jar', 'fountain', 'gloop_lamp', 'hourglass', 'orrery'] as const;
type DecorKey = (typeof ANIMATED_DECOR)[number];

/**
 * Is (x,y) out in the open air? Decorations near an open, wall-less cell
 * feel the real wind; indoors they only drift gently.
 */
export function exposedToWind(world: World, x: number, y: number, h: number): boolean {
  for (let yy = y; yy < y + h; yy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx;
      if (!world.inBounds(xx, yy)) continue;
      if (world.getWall(xx, yy) === 0 && !world.isSolid(xx, yy)) return true;
    }
  }
  return false;
}

/** Effective sway input for a decoration: real wind outdoors, a faint draught indoors. */
function localWind(world: World, x: number, y: number, h: number, env: DecorEnv): number {
  return exposedToWind(world, x, y, h) ? env.wind : env.wind * 0.12;
}

/** Draw a hanging strand of pixels whose bottom is displaced by `dx`. */
function strand(g: CanvasRenderingContext2D, x: number, y: number, len: number, dx: number, color: string, w = 1): void {
  g.fillStyle = color;
  for (let i = 0; i < len; i++) g.fillRect(Math.round(x + (dx * i) / len), y + i, w, 1);
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

const PENNANT_COLOURS = [
  ['#d05a5a', '#f5cf3c'],
  ['#3e7ad0', '#e8dcc0'],
  ['#4fa33b', '#ffffff'],
  ['#e8a23a', '#7a2a30'],
  ['#8a4fd0', '#f5cf3c'],
  ['#e85d9a', '#ffffff'],
];

const painters: Record<DecorKey, (g: CanvasRenderingContext2D, world: World, ox: number, oy: number, env: DecorEnv) => void> = {
  wind_chime: (g, world, ox, oy, env) => {
    const x = ox * S;
    const y = oy * S;
    const wind = localWind(world, ox, oy, 2, env);
    const gust = Math.abs(wind);
    const tubes: [number, number, string][] = [[3, 14, '#d8b060'], [6, 18, '#e8c878'], [10, 16, '#c9a24a'], [13, 12, '#e0c070']];
    tubes.forEach(([tx, len, c], i) => {
      const sway = Math.sin(env.tick * (0.05 + i * 0.013) + ox * 1.7 + i * 2) * (0.6 + gust * 3) + wind * 3;
      strand(g, x + tx, y + 4, 4, sway * 0.3, '#8a7a60');
      strand(g, x + tx - 1, y + 8, len, sway, c, 2);
    });
    const clap = Math.sin(env.tick * 0.07 + ox) * (0.5 + gust * 2.5) + wind * 2;
    strand(g, x + 8, y + 4, 16, clap, '#8a7a60');
    rect(g, x + 6 + clap, y + 20, 4, 4, '#b07a48');
    rect(g, x + 6 + clap, y + 20, 4, 1, '#d8a060');
  },
  weathervane: (g, world, ox, oy, env) => {
    const cx = ox * S + 8;
    const cy = oy * S + 4;
    const wind = localWind(world, ox, oy, 3, env);
    // The arrow points downwind; turning is shown by foreshortening its length.
    const wobble = Math.sin(env.tick * 0.09 + ox) * Math.min(0.5, Math.abs(wind) * 0.8);
    const dir = Math.cos((wind >= 0 ? 0 : Math.PI) + wobble);
    const len = 7 * dir;
    g.fillStyle = '#e0c070';
    for (let i = -7; i <= 7; i++) g.fillRect(Math.round(cx + (len * i) / 7), cy, 1, 1);
    const tip = cx + len;
    const tail = cx - len;
    g.fillStyle = '#f0d890';
    g.fillRect(Math.round(tip - Math.sign(len)), cy - 1, 1, 3);
    g.fillRect(Math.round(tip - Math.sign(len) * 2), cy - 2, 1, 5);
    g.fillStyle = '#b8434a';
    g.fillRect(Math.round(tail), cy - 3, Math.max(1, Math.round(Math.abs(len) * 0.4)) * (len >= 0 ? 1 : -1), 3);
    g.fillRect(Math.round(tail), cy + 1, Math.max(1, Math.round(Math.abs(len) * 0.4)) * (len >= 0 ? 1 : -1), 3);
  },
  pennant: (g, world, ox, oy, env) => {
    const x = ox * S;
    const y = oy * S + 2;
    const wind = localWind(world, ox, oy, 3, env);
    const [base, stripe] = PENNANT_COLOURS[hash3(ox, oy, 11) % PENNANT_COLOURS.length];
    const len = 40;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      const flutter = Math.sin(env.tick * (0.1 + Math.abs(wind) * 0.12) + i * 0.22 + ox) * (0.8 + Math.abs(wind) * 3) * k;
      const off = flutter + wind * 10 * k;
      const w = Math.max(1, Math.round(12 * (1 - k)));
      const col = i % 10 < 2 ? stripe : base;
      rect(g, x + 8 - w / 2 + off, y + i, w, 1, col);
    }
  },
  hanging_lantern: (g, world, ox, oy, env) => {
    const x = ox * S + 8;
    const y = oy * S + 2;
    const wind = localWind(world, ox, oy, 2, env);
    const sway = Math.sin(env.tick * 0.04 + ox * 1.3) * (0.7 + Math.abs(wind) * 2) + wind * 2;
    strand(g, x, y, 10, sway * 0.5, '#5d6474');
    const lx = x + sway * 0.55 - 4;
    const ly = y + 10;
    rect(g, lx + 1, ly, 6, 2, '#5d6474');
    rect(g, lx, ly + 2, 8, 12, '#3a3040');
    rect(g, lx + 1, ly + 3, 6, 10, '#ffcf70');
    rect(g, lx + 2, ly + 4, 4, 8, '#fff2c0');
    rect(g, lx + 3, ly + 3, 2, 10, '#3a3040');
    rect(g, lx + 1, ly + 14, 6, 2, '#5d6474');
  },
  wisp_jar: (g, _world, ox, oy, env) => {
    const cx = ox * S + 8;
    const cy = oy * S + 10;
    for (let i = 0; i < 3; i++) {
      const t = env.tick * (0.03 + i * 0.011) + i * 2.1 + ox;
      const x = cx + Math.sin(t) * 3 - 0.5;
      const y = cy + Math.sin(t * 1.7 + i) * 3 - 0.5;
      const pulse = 0.6 + Math.sin(env.tick * 0.15 + i * 3) * 0.4;
      g.globalAlpha = 0.35 * pulse;
      rect(g, x - 1, y - 1, 3, 3, '#8ff0ff');
      g.globalAlpha = 1;
      rect(g, x, y, 1, 1, pulse > 0.5 ? '#ffffff' : '#bff8ff');
    }
  },
  fountain: (g, _world, ox, oy, env) => {
    const x0 = ox * S;
    const y0 = oy * S;
    const t = env.tick;
    // Spout plume.
    const plume = 3 + Math.sin(t * 0.3) * 1;
    rect(g, x0 + 23, y0 + 2 - plume, 2, plume + 2, '#8ac0ff');
    // Arcs from the upper bowl into the basin on both sides.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const k = ((t * 0.02 + i / 7) % 1 + 1) % 1;
        const px = x0 + 24 + side * (12 + k * 16);
        const py = y0 + 10 + k * k * 26 - k * 6;
        g.globalAlpha = 0.85 - k * 0.3;
        rect(g, px, py, 2, 2, k < 0.5 ? '#bfe0ff' : '#6aa8f0');
      }
    }
    g.globalAlpha = 1;
    // Ripples where the water lands.
    for (const side of [-1, 1]) {
      const r = (t * 0.1) % 4;
      rect(g, x0 + 24 + side * 28 - r, y0 + 37, 1 + r * 2, 1, '#d0ecff');
    }
    // Shimmer on the basin surface.
    for (let i = 0; i < 4; i++) {
      const sx = x0 + 4 + ((t * 0.3 + i * 11) % 40);
      rect(g, sx, y0 + 38, 2, 1, 'rgba(220,240,255,0.7)');
    }
  },
  gloop_lamp: (g, _world, ox, oy, env) => {
    const x = ox * S + 5;
    const top = oy * S + 5;
    const bottom = oy * S + 23;
    const blobs: [number, number, number][] = [[0.011, 0, 3], [0.008, 2.4, 2], [0.014, 4.1, 2]];
    // Gel pool at the bottom.
    rect(g, x, bottom - 1, 6, 3, '#6ad04a');
    blobs.forEach(([speed, phase, r], i) => {
      const k = (Math.sin(env.tick * speed + phase + ox) + 1) / 2;
      const by = bottom - 2 - k * (bottom - top - 4);
      const bx = x + 1 + ((i * 2 + Math.round(Math.sin(env.tick * 0.02 + i) * 1)) % 4 + 4) % 4;
      rect(g, bx, by, r, r + 1, '#8ae86a');
      rect(g, bx, by, 1, 1, '#d8ffc0');
    });
  },
  hourglass: (g, _world, ox, oy, env) => {
    const x0 = ox * S;
    const y0 = oy * S;
    // Turns over at 06:00 and 18:00; sand runs through each half of the day.
    const k = (((env.hour - 6) % 12) + 12) % 12 / 12;
    const topRows = Math.round((1 - k) * 6);
    const botRows = Math.round(k * 6);
    g.fillStyle = '#e0c070';
    for (let r = 0; r < topRows; r++) {
      const y = 15 - r;
      const hw = hourglassHalfWidth(y);
      g.fillRect(x0 + 8 - hw, y0 + y, hw * 2, 1);
    }
    for (let r = 0; r < botRows; r++) {
      const y = 28 - r;
      const hw = hourglassHalfWidth(y);
      g.fillRect(x0 + 8 - hw, y0 + y, hw * 2, 1);
    }
    if (topRows > 0) {
      g.fillStyle = '#f0d890';
      const end = 28 - botRows;
      for (let y = 16; y <= end; y++) if ((y + (env.tick >> 2)) % 3 !== 0) g.fillRect(x0 + 8, y0 + y, 1, 1);
    }
  },
  orrery: (g, _world, ox, oy, env) => {
    const cx = ox * S + 24;
    const cy = oy * S + 24;
    const t = env.tick * 0.01;
    // Orbits.
    g.fillStyle = 'rgba(200,170,90,0.45)';
    for (const r of [8, 13, 19]) {
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.4), 1, 1);
      }
    }
    // Sun.
    const pulse = 0.5 + Math.sin(env.tick * 0.05) * 0.5;
    g.globalAlpha = 0.3 + pulse * 0.2;
    rect(g, cx - 4, cy - 4, 9, 9, '#ffd060');
    g.globalAlpha = 1;
    rect(g, cx - 2, cy - 2, 5, 5, '#ffcf40');
    rect(g, cx - 1, cy - 2, 2, 1, '#fff2a8');
    // Planets on brass arms (behind the sun when on the far side of the orbit).
    const planets: [number, number, string, number][] = [[8, 1.6, '#c07a4a', 2], [13, 1.0, '#4a8ae0', 3], [19, 0.55, '#b070ff', 3]];
    for (const [r, speed, col, size] of planets) {
      const ang = t * speed + r;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r * 0.4;
      rect(g, px - size / 2, py - size / 2, size, size, col);
      rect(g, px - size / 2, py - size / 2, 1, 1, '#ffffff');
    }
    // Moon dial: tonight's phase (0 new → 4 full → back).
    const mx = ox * S + 24;
    const my = oy * S + 5;
    const lit = 1 - Math.abs(env.moonPhase - 4) / 4; // 0..1
    rect(g, mx - 3, my - 3, 7, 7, '#e8e4d0');
    const shadow = Math.round((1 - lit) * 7);
    if (shadow > 0) rect(g, env.moonPhase < 4 ? mx - 3 : mx + 4 - shadow, my - 3, shadow, 7, '#2a2440');
  },
};

/** Numeric tile ids of animated decorations, resolved once. */
let animatedIds: Map<number, DecorKey> | null = null;
export function animatedDecor(): Map<number, DecorKey> {
  if (!animatedIds) {
    animatedIds = new Map();
    for (const key of ANIMATED_DECOR) {
      const id = TileRegistry.tryId(key);
      if (id !== undefined) animatedIds.set(id, key);
    }
  }
  return animatedIds;
}

export function renderDecor(g: CanvasRenderingContext2D, world: World, key: DecorKey, ox: number, oy: number, env: DecorEnv): void {
  painters[key](g, world, ox, oy, env);
}
