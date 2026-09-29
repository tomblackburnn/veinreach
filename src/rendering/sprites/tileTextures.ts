import { TileRegistry } from '../../world/TileRegistry';
import type { TextureSpec } from '../../world/tileTypes';
import { hash3 } from '../../utils/random';
import { shade, mix } from '../../utils/color';
import { Pix, type Canvas2D } from './pixel';

export const VARIANTS = 4;
const S = 16;

/** Deterministic per-pixel random for texture generation. */
const r = (x: number, y: number, v: number, salt: number) => hash3(x, y, v * 131 + salt, 911) / 4294967296;

function soil(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.base);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = r(x, y, v, salt);
      if (n < 0.12) p.px(x, y, t.dark ?? shade(t.base, 0.8));
      else if (n > 0.9) p.px(x, y, t.light ?? shade(t.base, 1.15));
    }
  }
  // Pebbles
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(r(i, 7, v, salt) * 13) + 1;
    const y = Math.floor(r(i, 9, v, salt) * 13) + 1;
    p.rect(x, y, 2, 2, t.dark ?? shade(t.base, 0.75));
    p.px(x, y, t.light ?? shade(t.base, 1.2));
  }
}

function stone(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.base);
  const dark = t.dark ?? shade(t.base, 0.8);
  const light = t.light ?? shade(t.base, 1.15);
  // Blotches
  for (let i = 0; i < 4; i++) {
    const cx = r(i, 1, v, salt) * S;
    const cy = r(i, 2, v, salt) * S;
    const rad = 1.5 + r(i, 3, v, salt) * 2.5;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < rad * rad) p.px(x, y, i % 2 ? dark : light);
      }
    }
  }
  // Crack
  let x = Math.floor(r(5, 5, v, salt) * S);
  let y = 0;
  const len = 4 + Math.floor(r(6, 6, v, salt) * 8);
  for (let i = 0; i < len; i++) {
    p.px(x, y, shade(dark, 0.85));
    y++;
    x += r(i, 8, v, salt) < 0.5 ? -1 : 1;
    if (x < 0 || x >= S) break;
  }
}

function sand(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.base);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = r(x, y, v, salt);
      if (n < 0.2) p.px(x, y, t.dark ?? shade(t.base, 0.88));
      else if (n > 0.85) p.px(x, y, t.light ?? shade(t.base, 1.1));
    }
  }
  // Wind ripples
  for (let row = 3; row < S; row += 5) {
    for (let x = 0; x < S; x++) if ((x + v * 3 + row) % 7 < 3) p.px(x, row + (x % 5 === 0 ? 1 : 0), t.dark ?? shade(t.base, 0.9));
  }
}

function ore(p: Pix, t: TextureSpec, v: number, salt: number): void {
  stone(p, { kind: 'stone', base: t.host ?? '#77777f', dark: t.dark, light: shade(t.host ?? '#77777f', 1.15) }, v, salt + 1);
  const n = 3 + Math.floor(r(0, 0, v, salt) * 2);
  for (let i = 0; i < n; i++) {
    const cx = 2 + Math.floor(r(i, 11, v, salt) * 11);
    const cy = 2 + Math.floor(r(i, 12, v, salt) * 11);
    p.rect(cx, cy, 3, 2, t.base);
    p.rect(cx + 1, cy - 1, 1, 1, t.base);
    p.px(cx, cy, t.light ?? shade(t.base, 1.3));
    p.px(cx + 2, cy + 1, shade(t.base, 0.7));
  }
}

function brick(p: Pix, t: TextureSpec, v: number, salt: number): void {
  const mortar = t.accent ?? shade(t.base, 0.6);
  p.rect(0, 0, S, S, mortar);
  const rows = [0, 8];
  rows.forEach((ry, i) => {
    const off = i % 2 === 0 ? 0 : 4;
    for (let bx = -8 + off; bx < S; bx += 8) {
      const x0 = Math.max(0, bx);
      const x1 = Math.min(S, bx + 7);
      if (x1 <= x0) continue;
      const tint = r(bx + 20, ry, v, salt) < 0.5 ? t.base : mix(t.base, t.dark ?? shade(t.base, 0.8), 0.4);
      p.rect(x0, ry, x1 - x0, 7, tint);
      p.rect(x0, ry, x1 - x0, 1, t.light ?? shade(t.base, 1.2));
      p.rect(x0, ry + 6, x1 - x0, 1, t.dark ?? shade(t.base, 0.8));
    }
  });
}

function planks(p: Pix, t: TextureSpec, v: number, salt: number): void {
  const dark = t.dark ?? shade(t.base, 0.75);
  for (let row = 0; row < 4; row++) {
    const tint = r(row, 1, v, salt) < 0.5 ? t.base : mix(t.base, t.light ?? shade(t.base, 1.1), 0.5);
    p.rect(0, row * 4, S, 4, tint);
    p.rect(0, row * 4 + 3, S, 1, dark);
    const seam = Math.floor(r(row, 2, v, salt) * 14) + 1;
    p.rect(seam, row * 4, 1, 3, dark);
    // Grain
    for (let x = 0; x < S; x++) if (r(x, row, v, salt + 5) < 0.12) p.px(x, row * 4 + 1, shade(tint, 0.9));
  }
}

function leaves(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.dark ?? shade(t.base, 0.8));
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r(i, 3, v, salt) * 14);
    const y = Math.floor(r(i, 4, v, salt) * 14);
    p.rect(x, y, 3, 2, t.base);
    p.px(x + 1, y, t.light ?? shade(t.base, 1.2));
  }
}

function crystal(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.base);
  const light = t.light ?? shade(t.base, 1.3);
  const dark = t.dark ?? shade(t.base, 0.75);
  for (let i = 0; i < 3; i++) {
    const x0 = Math.floor(r(i, 1, v, salt) * S);
    for (let k = 0; k < S; k++) {
      const x = x0 + k;
      if (x < S) p.px(x, k, i === 0 ? light : dark);
    }
  }
  p.px(Math.floor(r(9, 9, v, salt) * 14) + 1, Math.floor(r(8, 8, v, salt) * 14) + 1, '#ffffff');
}

function ice(p: Pix, t: TextureSpec, v: number, salt: number): void {
  p.rect(0, 0, S, S, t.base);
  const light = t.light ?? shade(t.base, 1.2);
  for (let k = 0; k < 6; k++) p.px(2 + k + (v % 3), 2 + k, light);
  for (let k = 0; k < 4; k++) p.px(9 + k, 8 + k, light);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (r(x, y, v, salt) < 0.05) p.px(x, y, t.dark ?? shade(t.base, 0.85));
}

function glass(p: Pix, t: TextureSpec): void {
  p.g.fillStyle = t.base;
  p.g.globalAlpha = 0.35;
  p.g.fillRect(0, 0, S, S);
  p.g.globalAlpha = 1;
  p.box(0, 0, S, S, t.dark ?? shade(t.base, 0.8));
  p.line(3, 11, 7, 7, t.light ?? '#ffffff');
  p.line(5, 12, 10, 7, t.light ?? '#ffffff');
}

function ash(p: Pix, t: TextureSpec, v: number, salt: number): void {
  soil(p, t, v, salt);
  for (let i = 0; i < 3; i++) p.px(Math.floor(r(i, 20, v, salt) * S), Math.floor(r(i, 21, v, salt) * S), '#8a3a1a');
}

export function paintTexture(p: Pix, t: TextureSpec, v: number, salt: number): void {
  switch (t.kind) {
    case 'soil':
    case 'grass':
    case 'moss':
      soil(p, t, v, salt);
      break;
    case 'stone':
      stone(p, t, v, salt);
      break;
    case 'sand':
      sand(p, t, v, salt);
      break;
    case 'ore':
      ore(p, t, v, salt);
      break;
    case 'brick':
      brick(p, t, v, salt);
      break;
    case 'planks':
      planks(p, t, v, salt);
      break;
    case 'leaves':
      leaves(p, t, v, salt);
      break;
    case 'crystal':
      crystal(p, t, v, salt);
      break;
    case 'ice':
      ice(p, t, v, salt);
      break;
    case 'glass':
      glass(p, t);
      break;
    case 'ash':
      ash(p, t, v, salt);
      break;
    case 'sprite':
      break;
  }
}

/** Cache of generated tile & wall textures. */
class TileTextureCache {
  private tiles = new Map<number, Canvas2D[]>();
  private walls = new Map<number, Canvas2D[]>();
  private grass = new Map<number, { top: Canvas2D; side: Canvas2D }>();

  tile(id: number, variant: number): Canvas2D | null {
    const def = TileRegistry.get(id);
    if (def.texture.kind === 'sprite') return null;
    let arr = this.tiles.get(id);
    if (!arr) {
      arr = [];
      for (let v = 0; v < VARIANTS; v++) {
        const p = new Pix(S, S);
        paintTexture(p, def.texture, v, id * 17);
        arr.push(p.canvas);
      }
      this.tiles.set(id, arr);
    }
    return arr[variant % VARIANTS];
  }

  wall(id: number, variant: number): Canvas2D | null {
    if (id === 0) return null;
    let arr = this.walls.get(id);
    if (!arr) {
      const def = TileRegistry.wall(id);
      arr = [];
      for (let v = 0; v < VARIANTS; v++) {
        const p = new Pix(S, S);
        paintTexture(p, def.texture, v, id * 29 + 5);
        // Walls are recessed: darken.
        p.g.fillStyle = 'rgba(0,0,0,0.38)';
        p.g.fillRect(0, 0, S, S);
        arr.push(p.canvas);
      }
      this.walls.set(id, arr);
    }
    return arr[variant % VARIANTS];
  }

  /** Grass fringe overlays for exposed top and side faces. */
  grassOverlay(id: number): { top: Canvas2D; side: Canvas2D } {
    let o = this.grass.get(id);
    if (!o) {
      const col = TileRegistry.get(id).texture.accent ?? '#4fa33b';
      const top = new Pix(S, 8);
      top.rect(0, 0, S, 4, col);
      for (let x = 0; x < S; x++) {
        const d = (hash3(x, 1, id, 3) % 3) + 1;
        top.rect(x, 4, 1, d, col);
        if (hash3(x, 2, id, 3) % 4 === 0) top.px(x, 0, shade(col, 1.25));
        top.px(x, 3 + d, shade(col, 0.7));
      }
      const side = new Pix(4, S);
      for (let y = 0; y < S; y++) {
        const d = (hash3(y, 5, id, 3) % 2) + 2;
        side.rect(0, y, d, 1, col);
      }
      o = { top: top.canvas, side: side.canvas };
      this.grass.set(id, o);
    }
    return o;
  }
}

export const TileTextures = new TileTextureCache();
