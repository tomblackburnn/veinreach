import { Pix, type Canvas2D } from './pixel';
import { shade } from '../../utils/color';
import { hash3 } from '../../utils/random';

/**
 * Pixel-art sprites for furniture, plants and other 'sprite' tiles.
 * Each painter draws the WHOLE object (w×h tiles); tile renderers blit
 * the sub-rectangle for each cell so objects work across chunk borders.
 */
type Painter = (p: Pix, variant: number) => void;

const WOOD = '#a4713f';
const WOOD_D = '#7d532b';
const WOOD_DD = '#5a3a1e';
const WOOD_L = '#c08a55';
const IRON = '#8a93a3';
const IRON_D = '#5d6474';
const IRON_L = '#c0c8d4';

const TREE_BARK: Record<number, [string, string]> = {
  0: ['#6b4526', '#4e321b'], // oak
  1: ['#5a3a24', '#3e2818'], // pine
  2: ['#9a7a4a', '#7a5a34'], // palm
  3: ['#4e4048', '#3a2e36'], // dead/blight
  4: ['#d8d0c0', '#b0a898'], // mushroom stem
  5: ['#5a3a7a', '#3a2454'], // shard
};

const painters: Record<string, { size: [number, number]; paint: Painter }> = {
  platform: {
    size: [1, 1],
    paint: (p) => {
      p.rect(0, 0, 16, 4, WOOD).rect(0, 0, 16, 1, WOOD_L).rect(0, 3, 16, 1, WOOD_D);
      p.rect(2, 4, 2, 2, WOOD_D).rect(12, 4, 2, 2, WOOD_D);
    },
  },
  door_closed: {
    size: [1, 3],
    paint: (p) => {
      p.rect(2, 0, 12, 48, WOOD).box(2, 0, 12, 48, WOOD_DD);
      for (let y = 4; y < 46; y += 7) p.rect(3, y, 10, 1, WOOD_D);
      p.rect(4, 2, 1, 44, WOOD_L);
      p.rect(10, 22, 2, 3, IRON_D).px(10, 22, IRON_L);
      p.rect(3, 6, 3, 2, IRON_D).rect(3, 40, 3, 2, IRON_D);
    },
  },
  door_open: {
    size: [1, 3],
    paint: (p) => {
      p.rect(0, 0, 5, 48, WOOD_D).rect(0, 0, 1, 48, WOOD_DD).rect(4, 0, 1, 48, WOOD_DD);
      for (let y = 4; y < 46; y += 7) p.rect(1, y, 3, 1, WOOD_DD);
      p.rect(0, 6, 2, 2, IRON_D).rect(0, 40, 2, 2, IRON_D);
    },
  },
  torch: {
    size: [1, 1],
    paint: (p) => {
      p.rect(7, 6, 2, 9, WOOD_D).px(7, 6, WOOD_L);
      p.rect(6, 4, 4, 3, '#3a2a1a');
    },
  },
  workbench: {
    size: [2, 1],
    paint: (p) => {
      p.rect(0, 1, 32, 4, WOOD).rect(0, 1, 32, 1, WOOD_L).rect(0, 4, 32, 1, WOOD_DD);
      p.rect(2, 5, 3, 11, WOOD_D).rect(27, 5, 3, 11, WOOD_D);
      p.rect(5, 10, 22, 2, WOOD_D);
      p.rect(8, 0, 6, 1, IRON).rect(20, -1, 2, 2, '#888');
    },
  },
  furnace: {
    size: [2, 2],
    paint: (p) => {
      p.rect(2, 4, 28, 28, '#6b6b73');
      for (let y = 4; y < 32; y += 5) for (let x = 2 + ((y / 5) % 2) * 3; x < 30; x += 7) p.rect(x, y, 6, 4, '#7c7c85').px(x, y, '#9a9aa3');
      p.rect(10, 16, 12, 12, '#1a1010').rect(11, 17, 10, 10, '#3a1a0a');
      p.rect(12, 22, 8, 5, '#ff7a2a').rect(13, 21, 6, 2, '#ffb040').rect(14, 24, 4, 2, '#ffe070');
      p.rect(12, 0, 8, 5, '#5a5a63').rect(13, 0, 6, 1, '#444');
    },
  },
  anvil: {
    size: [2, 1],
    paint: (p) => {
      p.rect(2, 1, 28, 5, IRON).rect(2, 1, 28, 1, IRON_L).rect(0, 2, 4, 3, IRON).rect(28, 2, 4, 2, IRON);
      p.rect(10, 6, 12, 5, IRON_D).rect(6, 11, 20, 5, IRON_D).rect(6, 11, 20, 1, IRON);
    },
  },
  alembic: {
    size: [2, 2],
    paint: (p) => {
      p.rect(0, 16, 32, 4, WOOD).rect(0, 16, 32, 1, WOOD_L);
      p.rect(2, 20, 3, 12, WOOD_D).rect(27, 20, 3, 12, WOOD_D);
      p.disc(10, 10, 5, '#bfe6f0').disc(10, 11, 4, '#b06adf').px(8, 8, '#ffffff');
      p.rect(9, 2, 3, 4, '#bfe6f0').line(11, 3, 22, 6, '#bfe6f0');
      p.rect(20, 7, 6, 9, '#bfe6f0').rect(21, 11, 4, 5, '#6ad04a');
    },
  },
  runescribe: {
    size: [3, 2],
    paint: (p) => {
      p.rect(0, 14, 48, 4, '#3a2a4a').rect(0, 14, 48, 1, '#5a4a6a');
      p.rect(2, 18, 4, 14, '#2a1a3a').rect(42, 18, 4, 14, '#2a1a3a');
      p.rect(8, 9, 16, 5, '#e8dcc0').rect(8, 9, 16, 1, '#fff8e0').rect(15, 9, 2, 5, '#b8a888');
      for (let i = 0; i < 4; i++) p.px(10 + i * 3, 11, '#3e4f8a');
      p.rect(30, 6, 3, 8, '#e8dcc0').rect(30, 3, 3, 3, '#6fe0d0');
      p.disc(40, 9, 4, '#3e4f8a').disc(40, 9, 2, '#8fe0ff');
    },
  },
  aetherforge: {
    size: [3, 2],
    paint: (p) => {
      p.rect(2, 8, 44, 24, '#2a3a4a').box(2, 8, 44, 24, '#5dd5e8');
      p.rect(14, 14, 20, 14, '#0a1a24').rect(16, 16, 16, 10, '#5dd5e8').rect(19, 18, 10, 6, '#d4fff8');
      p.rect(6, 0, 6, 8, '#3a4a5a').rect(36, 0, 6, 8, '#3a4a5a').px(8, 0, '#9ff5ff').px(38, 0, '#9ff5ff');
      for (let x = 4; x < 44; x += 6) p.px(x, 30, '#9ff5ff');
    },
  },
  starloom: {
    size: [3, 3],
    paint: (p) => {
      p.rect(4, 4, 3, 44, '#3a2a4a').rect(41, 4, 3, 44, '#3a2a4a').rect(4, 4, 40, 3, '#5a4a6a');
      p.rect(2, 44, 44, 4, '#2a1a3a');
      for (let x = 9; x < 40; x += 3) p.rect(x, 8, 1, 30, x % 2 ? '#ff8ae6' : '#fff0a0');
      p.disc(24, 24, 5, '#fff0fc').disc(24, 24, 3, '#ff8ae6');
      p.rect(8, 38, 32, 4, '#5a4a6a');
    },
  },
  chest: {
    size: [2, 2],
    paint: (p) => {
      p.rect(1, 6, 30, 26, '#9b6a35').rect(1, 6, 30, 10, '#b07a3f');
      p.rect(1, 15, 30, 2, '#6a4520').box(1, 6, 30, 26, '#4a2f14');
      p.rect(1, 6, 30, 2, '#c88f4f');
      p.rect(5, 6, 3, 26, '#d4a441').rect(24, 6, 3, 26, '#d4a441');
      p.rect(13, 13, 6, 7, '#d4a441').rect(15, 16, 2, 2, '#3a2a10');
    },
  },
  table: {
    size: [3, 2],
    paint: (p) => {
      p.rect(0, 10, 48, 4, WOOD).rect(0, 10, 48, 1, WOOD_L).rect(0, 13, 48, 1, WOOD_DD);
      p.rect(3, 14, 3, 18, WOOD_D).rect(42, 14, 3, 18, WOOD_D);
      p.rect(20, 6, 4, 4, '#e8dcc0').rect(28, 7, 6, 3, '#c0c0c8');
    },
  },
  chair: {
    size: [1, 2],
    paint: (p) => {
      p.rect(3, 2, 3, 30, WOOD_D).rect(3, 16, 11, 3, WOOD).rect(3, 16, 11, 1, WOOD_L);
      p.rect(11, 19, 3, 13, WOOD_D).rect(3, 4, 2, 12, WOOD);
      p.rect(3, 6, 3, 2, WOOD_DD).rect(3, 11, 3, 2, WOOD_DD);
    },
  },
  bookcase: {
    size: [3, 4],
    paint: (p) => {
      p.rect(1, 0, 46, 64, WOOD_D).box(1, 0, 46, 64, WOOD_DD);
      const colors = ['#b8434a', '#3e4f8a', '#4fa33b', '#d4a441', '#7a5a8c', '#e8dcc0'];
      for (let shelf = 0; shelf < 4; shelf++) {
        const y = 3 + shelf * 15;
        p.rect(3, y + 11, 42, 2, WOOD);
        for (let x = 4; x < 44; ) {
          const w = 2 + (hash3(x, shelf, 1) % 3);
          const h = 7 + (hash3(x, shelf, 2) % 4);
          p.rect(x, y + 11 - h, w, h, colors[hash3(x, shelf, 3) % colors.length]);
          x += w + (hash3(x, shelf, 4) % 3 === 0 ? 2 : 0);
        }
      }
    },
  },
  lamp: {
    size: [1, 3],
    paint: (p) => {
      p.rect(4, 44, 8, 4, IRON_D).rect(7, 12, 2, 32, IRON_D);
      p.rect(2, 2, 12, 11, '#fff2b0').box(2, 2, 12, 11, '#c0a050').rect(3, 3, 10, 2, '#ffffff');
      p.rect(4, 0, 8, 2, IRON_D);
    },
  },
  bed: {
    size: [4, 2],
    paint: (p) => {
      p.rect(0, 2, 5, 30, WOOD_D).rect(59, 10, 5, 22, WOOD_D);
      p.rect(4, 16, 56, 8, WOOD).rect(4, 16, 56, 1, WOOD_L);
      p.rect(5, 10, 54, 7, '#b8434a').rect(5, 10, 54, 2, '#d8636a');
      p.rect(6, 7, 12, 5, '#f0f0f0').rect(6, 7, 12, 1, '#ffffff');
      p.rect(4, 24, 3, 8, WOOD_DD).rect(57, 24, 3, 8, WOOD_DD);
    },
  },
  campfire: {
    size: [3, 2],
    paint: (p) => {
      p.rect(8, 26, 32, 5, WOOD_D).rect(12, 24, 24, 4, WOOD);
      p.line(10, 30, 38, 22, WOOD_DD).line(10, 22, 38, 30, WOOD_DD);
      for (let i = 0; i < 6; i++) p.rect(4 + i * 7, 29, 5, 3, '#6b6b73');
    },
  },
  tallgrass: {
    size: [1, 1],
    paint: (p, v) => {
      const cols = ['#4fa33b', '#5cb847', '#3f8f33', '#6ab04a', '#8d5aa8'];
      const col = cols[v % cols.length];
      for (let i = 0; i < 5; i++) {
        const x = 2 + i * 3;
        const h = 5 + (hash3(i, v, 7) % 8);
        p.line(x, 15, x + ((i + v) % 3) - 1, 16 - h, i % 2 ? col : shade(col, 0.8));
      }
    },
  },
  flower: {
    size: [1, 1],
    paint: (p, v) => {
      const petals = ['#e85d9a', '#f5cf3c', '#8fb0ff', '#ffffff'];
      const c = petals[v % petals.length];
      p.line(8, 15, 8, 6, '#3f8f33').px(7, 11, '#4fa33b').px(9, 9, '#4fa33b');
      p.rect(6, 3, 5, 5, c).px(6, 3, 'rgba(0,0,0,0)').rect(8, 5, 1, 1, '#f5cf3c');
    },
  },
  cactus: {
    size: [1, 1],
    paint: (p, v) => {
      p.rect(4, 0, 8, 16, '#3f8a4a').rect(5, 0, 2, 16, '#58a862').rect(10, 0, 2, 16, '#2e6a38');
      for (let y = 2; y < 16; y += 4) p.px(3, y, '#e8e0a0').px(12, y + 2, '#e8e0a0');
      if (v === 1) p.rect(4, 0, 8, 2, '#2e6a38').rect(6, -1, 4, 2, '#e85d9a');
    },
  },
  trunk: {
    size: [1, 1],
    paint: (p, v) => {
      const [bark, dark] = TREE_BARK[v] ?? TREE_BARK[0];
      const w = v === 4 ? 8 : 10;
      const x0 = (16 - w) / 2;
      p.rect(x0, 0, w, 16, bark).rect(x0, 0, 2, 16, shade(bark, 1.15)).rect(x0 + w - 2, 0, 2, 16, dark);
      p.rect(x0 + 3, 4, 1, 5, dark).rect(x0 + 5, 10, 1, 4, dark);
      if (v === 3) p.px(x0 + 4, 6, '#8d5aa8');
    },
  },
  treetop: {
    size: [1, 1],
    paint: (p, v) => painters.trunk.paint(p, v),
  },
  sapling: {
    size: [1, 1],
    paint: (p) => {
      p.line(8, 15, 8, 6, '#6b4526').rect(5, 4, 4, 3, '#4fa33b').rect(8, 6, 4, 3, '#5cb847');
    },
  },
  glowshroom: {
    size: [1, 1],
    paint: (p, v) => {
      const h = 6 + (v % 3) * 2;
      p.rect(7, 16 - h, 2, h, '#d8e8f0');
      p.rect(3, 13 - h, 10, 4, '#45c8d8').rect(4, 12 - h, 8, 1, '#8ff0ff').px(6, 14 - h, '#ffffff').px(10, 13 - h, '#ffffff');
    },
  },
  emberbloom: {
    size: [1, 1],
    paint: (p) => {
      p.line(8, 15, 8, 7, '#5a2a1a').px(7, 11, '#8a3a1a');
      p.disc(8, 5, 3, '#ff7a2a').disc(8, 5, 1.5, '#ffe070');
    },
  },
  vine: {
    size: [1, 1],
    paint: (p) => {
      p.line(8, 0, 7, 8, '#3d8a2f').line(7, 8, 8, 16, '#3d8a2f');
      p.rect(5, 4, 3, 2, '#4fa33b').rect(9, 10, 3, 2, '#4fa33b');
    },
  },
  stalactite: {
    size: [1, 1],
    paint: (p, v) => {
      const c = v === 1 ? '#8fc4ea' : '#77777f';
      for (let y = 0; y < 13; y++) {
        const w = Math.max(1, Math.round(8 * (1 - y / 13)));
        p.rect(8 - w / 2, y, w, 1, y < 2 ? shade(c, 1.1) : c);
      }
      p.px(7, 3, shade(c, 1.3));
    },
  },
  pot: {
    size: [2, 2],
    paint: (p) => {
      p.disc(16, 19, 11, '#a35a45').disc(15, 17, 8, '#b96d56');
      p.rect(10, 4, 12, 5, '#a35a45').rect(9, 3, 14, 2, '#834634');
      p.rect(6, 18, 20, 2, '#e8c890').rect(8, 22, 16, 1, '#834634');
      p.rect(8, 29, 16, 3, '#834634');
    },
  },
  vital_crystal: {
    size: [2, 2],
    paint: (p) => {
      p.rect(8, 26, 16, 6, '#5a5a63').rect(6, 30, 20, 2, '#44444c');
      // Heart-shaped crystal
      p.disc(12, 12, 5, '#ff3b5c').disc(20, 12, 5, '#ff3b5c');
      for (let y = 12; y < 26; y++) {
        const w = Math.max(0, 20 - (y - 12) * 1.5);
        p.rect(16 - w / 2, y, w, 1, '#ff3b5c');
      }
      p.disc(11, 11, 2, '#ffb0c0').px(10, 10, '#ffffff');
    },
  },
  crystal_cluster: {
    size: [1, 1],
    paint: (p, v) => {
      const flip = v === 1;
      const y0 = (y: number) => (flip ? 15 - y : y);
      const cols = ['#8ff0ff', '#6fe0d0', '#d4fff8'];
      [
        [4, 8],
        [8, 13],
        [12, 6],
      ].forEach(([x, h], i) => {
        for (let y = 0; y < h; y++) {
          const w = y > h - 3 ? 1 : 3;
          p.rect(x - Math.floor(w / 2), y0(15 - y), w, 1, cols[i]);
        }
      });
      p.px(8, y0(6), '#ffffff');
    },
  },
  thornbrush: {
    size: [1, 1],
    paint: (p) => {
      for (let i = 0; i < 6; i++) p.line(8, 15, 2 + i * 2.4, 5 + (i % 3) * 2, i % 2 ? '#7b4e93' : '#5a3a70');
      p.px(3, 6, '#e0b0ff').px(12, 5, '#e0b0ff').px(8, 3, '#e0b0ff');
    },
  },
  rope: {
    size: [1, 1],
    paint: (p) => {
      for (let y = 0; y < 16; y++) p.rect(7, y, 2, 1, y % 3 === 0 ? '#8a7048' : '#b89a64');
    },
  },
  cobweb: {
    size: [1, 1],
    paint: (p) => {
      const c = 'rgba(230,230,240,0.7)';
      p.line(0, 0, 15, 15, c).line(15, 0, 0, 15, c).line(8, 0, 8, 15, c).line(0, 8, 15, 8, c);
      p.box(3, 3, 10, 10, 'rgba(230,230,240,0.45)');
    },
  },
  bone_pile: {
    size: [1, 1],
    paint: (p) => {
      p.rect(2, 12, 12, 2, '#e6dcc4').rect(1, 11, 2, 4, '#f4ecd8').rect(13, 11, 2, 4, '#f4ecd8');
      p.disc(8, 10, 3, '#e6dcc4').px(7, 10, '#3a3020').px(9, 10, '#3a3020');
    },
  },
};

class ObjectSpriteCache {
  private cache = new Map<string, Canvas2D>();

  has(key: string): boolean {
    return key in painters;
  }

  size(key: string): [number, number] {
    return painters[key]?.size ?? [1, 1];
  }

  get(key: string, variant = 0): Canvas2D | null {
    const def = painters[key];
    if (!def) return null;
    const ck = `${key}:${variant}`;
    let c = this.cache.get(ck);
    if (!c) {
      const p = new Pix(def.size[0] * 16, def.size[1] * 16);
      def.paint(p, variant);
      c = p.canvas;
      this.cache.set(ck, c);
    }
    return c;
  }
}

export const ObjectSprites = new ObjectSpriteCache();

/** Tree crowns: larger canopy sprites drawn above treetop tiles. Returns canvas + anchor. */
const crownCache = new Map<number, Canvas2D>();
export function treeCrown(kind: number): Canvas2D {
  let c = crownCache.get(kind);
  if (c) return c;
  const p = new Pix(64, 64);
  const blob = (cx: number, cy: number, r: number, base: string, light: string, dark: string) => {
    p.disc(cx, cy + 1, r, dark);
    p.disc(cx, cy, r, base);
    p.disc(cx - r * 0.35, cy - r * 0.35, r * 0.45, light);
  };
  switch (kind) {
    case 1: // pine
      for (let i = 0; i < 5; i++) {
        const y = 8 + i * 10;
        const w = 10 + i * 8;
        for (let k = 0; k < 10; k++) p.rect(32 - (w * (k / 10)) / 2, y + k, w * (k / 10), 1, k < 3 ? '#e8f0f8' : i % 2 ? '#2a5a3a' : '#2f6a42');
      }
      p.rect(30, 58, 4, 6, '#5a3a24');
      break;
    case 2: // palm
      for (let a = 0; a < 6; a++) {
        const ang = Math.PI + (a / 5) * Math.PI;
        for (let t = 0; t < 22; t++) {
          const x = 32 + Math.cos(ang) * t;
          const y = 40 + Math.sin(ang) * t * 0.6 + (t * t) / 40;
          p.rect(x, y, 3, 2, t > 16 ? '#5cb847' : '#3f8f33');
        }
      }
      p.disc(32, 40, 3, '#7a5a34');
      break;
    case 3: // dead blight tree
      p.line(32, 63, 32, 30, '#4e4048').line(32, 40, 18, 24, '#4e4048').line(32, 36, 46, 20, '#4e4048').line(18, 24, 12, 26, '#4e4048').line(46, 20, 52, 14, '#4e4048');
      p.line(33, 63, 33, 30, '#3a2e36').line(32, 30, 28, 18, '#4e4048');
      [[18, 24], [46, 20], [28, 18], [52, 14]].forEach(([x, y]) => p.disc(x, y, 3, '#7b4e93'));
      break;
    case 4: // giant glowing mushroom
      p.rect(28, 36, 8, 28, '#d8d0c0');
      for (let y = 0; y < 18; y++) {
        const w = 56 - Math.abs(y - 12) * 2.5;
        p.rect(32 - w / 2, 20 + y, w, 1, y < 4 ? '#8ff0ff' : y > 14 ? '#2a8aa0' : '#45c8d8');
      }
      [[20, 26], [40, 28], [30, 24], [48, 32], [14, 31]].forEach(([x, y]) => p.disc(x, y, 1.5, '#d4fff8'));
      break;
    case 5: // shard tree
      for (let i = 0; i < 7; i++) {
        const x = 14 + ((i * 37) % 36);
        const h = 12 + ((i * 13) % 16);
        for (let y = 0; y < h; y++) p.rect(x - (h - y) / 6, 48 - y, ((h - y) / 3) | 1, 1, i % 2 ? '#b04fe0' : '#d05cff');
      }
      break;
    default: // oak
      blob(32, 30, 18, '#3d8a2f', '#58a846', '#2a6a20');
      blob(18, 38, 12, '#3d8a2f', '#58a846', '#2a6a20');
      blob(46, 38, 12, '#3d8a2f', '#58a846', '#2a6a20');
      blob(32, 44, 12, '#357a28', '#4f9a3e', '#245a1a');
      p.rect(30, 50, 4, 14, '#6b4526');
  }
  crownCache.set(kind, p.canvas);
  return p.canvas;
}
