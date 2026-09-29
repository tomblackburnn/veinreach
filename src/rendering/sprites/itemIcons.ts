import { Pix, type Canvas2D } from './pixel';
import { shade } from '../../utils/color';
import { TileTextures } from './tileTextures';
import { ObjectSprites } from './objectSprites';
import { TileRegistry } from '../../world/TileRegistry';
import { ItemRegistry } from '../../items/ItemRegistry';
import type { IconSpec } from '../../items/types';

/**
 * Procedural 16×16 item icons built from templates + palettes. Weapons are
 * drawn diagonally with the grip at bottom-left so they can be rotated around
 * that corner when swung.
 */
type Tpl = (p: Pix, c: string[]) => void;

const OUT = '#1a1420';

function diagonalBlade(p: Pix, len: number, width: number, blade: string, hilt: string, guard = true): void {
  const light = shade(blade, 1.3);
  const dark = shade(blade, 0.7);
  for (let i = 0; i < len; i++) {
    const x = 4 + i;
    const y = 11 - i;
    for (let w = 0; w < width; w++) p.px(x + w, y + w - Math.floor(width / 2) + 1, w === 0 ? light : w === width - 1 ? dark : blade);
  }
  p.px(4 + len, 11 - len, light);
  if (guard) p.line(2, 10, 6, 14, shade(hilt, 1.2)).px(1, 9, shade(hilt, 1.2));
  p.line(1, 14, 3, 12, hilt).px(0, 15, shade(hilt, 0.8));
}

const T: Record<string, Tpl> = {
  bar: (p, [c]) => {
    for (let y = 0; y < 5; y++) p.rect(2 + y, 6 + y, 11, 1, y === 0 ? shade(c, 1.35) : y === 4 ? shade(c, 0.65) : c);
    p.rect(3, 6, 3, 1, '#ffffff');
  },
  gel: (p, [c]) => {
    p.disc(8, 10, 5, shade(c, 0.8)).disc(8, 9, 4.5, c).rect(5, 6, 2, 2, shade(c, 1.4));
  },
  bone: (p, [c]) => {
    p.line(3, 12, 12, 3, c).line(4, 12, 12, 4, c).disc(3, 13, 1.5, c).disc(12, 3, 1.5, c).line(3, 13, 12, 4, shade(c, 0.8));
  },
  silk: (p, [c]) => {
    p.disc(8, 8, 5, c).line(4, 6, 12, 10, shade(c, 0.8)).line(4, 10, 12, 6, shade(c, 0.8)).line(12, 12, 15, 15, c);
  },
  shard: (p, [c, c2]) => {
    for (let y = 0; y < 12; y++) {
      const w = y < 6 ? y : 12 - y;
      p.rect(8 - w / 2, 2 + y, w + 1, 1, y < 6 ? c : shade(c, 0.75));
    }
    p.line(8, 3, 8, 12, c2 ?? '#ffffff');
  },
  scale: (p, [c, c2]) => {
    p.disc(8, 8, 6, shade(c, 0.7)).disc(8, 7, 5, c).line(4, 9, 8, 5, c2 ?? shade(c, 1.3)).line(8, 5, 12, 9, c2 ?? shade(c, 1.3));
  },
  fang: (p, [c, c2]) => {
    for (let y = 0; y < 12; y++) p.rect(5 + y / 3, 2 + y, Math.max(1, 6 - y / 2), 1, y < 3 ? c2 ?? c : c);
  },
  orb: (p, [c, c2]) => {
    p.disc(8, 8, 6, c2 ?? shade(c, 0.6)).disc(8, 8, 5, c).disc(6, 6, 2, shade(c, 1.5)).px(5, 5, '#ffffff');
  },
  dust: (p, [c]) => {
    for (let i = 0; i < 10; i++) p.rect(3 + ((i * 7) % 10), 4 + ((i * 5) % 9), 2, 2, i % 2 ? c : shade(c, 1.4));
  },
  core: (p, [c, c2]) => {
    p.rect(3, 3, 10, 10, c2).box(3, 3, 10, 10, shade(c2, 1.5)).disc(8, 8, 3, c).px(7, 7, '#ffffff');
  },
  wood: (p, [c, c2]) => {
    p.rect(2, 5, 12, 7, c2).rect(2, 5, 12, 1, shade(c2, 1.3)).disc(13, 8, 3, shade(c2, 1.2)).disc(13, 8, 1, c);
    p.rect(4, 3, 3, 2, c).rect(6, 2, 2, 2, c);
  },
  star: (p, [c, c2]) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 3 : 7;
      pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]);
    }
    p.g.fillStyle = c;
    p.g.beginPath();
    pts.forEach(([x, y], i) => (i ? p.g.lineTo(x, y) : p.g.moveTo(x, y)));
    p.g.closePath();
    p.g.fill();
    p.disc(8, 8, 1.5, c2 ?? '#ffffff');
  },
  pickaxe: (p, [head, handle]) => {
    p.line(3, 13, 11, 5, handle).line(4, 13, 12, 5, shade(handle, 0.8));
    for (let i = 0; i < 9; i++) {
      const x = 5 + i;
      const y = 1 + Math.round(Math.abs(i - 4) * 0.6);
      p.rect(x, y, 1, 2, i === 4 ? shade(head, 1.3) : head);
    }
    p.px(4, 3, shade(head, 0.7)).px(14, 3, shade(head, 0.7)).rect(9, 3, 2, 2, shade(head, 0.8));
  },
  axe: (p, [head, handle]) => {
    p.line(3, 14, 11, 4, handle).line(4, 14, 12, 4, shade(handle, 0.8));
    p.rect(9, 1, 5, 7, head).rect(13, 2, 2, 5, shade(head, 1.3)).rect(9, 1, 5, 1, shade(head, 1.2)).rect(9, 7, 5, 1, shade(head, 0.7));
  },
  hammer: (p, [head, handle]) => {
    p.line(3, 14, 10, 6, handle).line(4, 14, 11, 6, shade(handle, 0.8));
    p.rect(7, 1, 8, 6, head).rect(7, 1, 8, 1, shade(head, 1.3)).rect(7, 6, 8, 1, shade(head, 0.7)).box(7, 1, 8, 6, shade(head, 0.6));
  },
  sword: (p, [blade, hilt]) => diagonalBlade(p, 9, 2, blade, hilt),
  broadsword: (p, [blade, hilt]) => diagonalBlade(p, 10, 3, blade, hilt),
  greatsword: (p, [blade, hilt]) => {
    diagonalBlade(p, 11, 4, blade, hilt);
    p.px(15, 0, shade(blade, 1.4));
  },
  spear: (p, [head, shaft]) => {
    p.line(0, 15, 11, 4, shaft).line(1, 15, 12, 4, shade(shaft, 0.8));
    for (let i = 0; i < 5; i++) p.rect(10 + i, 1 + (4 - i), 2, 2, i > 2 ? shade(head, 1.3) : head);
  },
  boomerang: (p, [c, c2]) => {
    p.line(2, 4, 8, 12, c).line(3, 4, 9, 12, c).line(8, 12, 14, 4, c).line(8, 11, 13, 4, c2 ?? shade(c, 0.7));
    p.line(2, 3, 5, 3, shade(c, 1.3));
  },
  bow: (p, [wood, string]) => {
    for (let i = 0; i < 13; i++) {
      const a = (i / 12) * Math.PI;
      p.rect(3 + Math.sin(a) * 7, 1 + i, 2, 1, i === 6 ? shade(wood, 0.7) : wood);
    }
    p.line(3, 1, 3, 13, string);
  },
  crossbow: (p, [c, c2]) => {
    p.rect(2, 7, 12, 3, c2).rect(2, 7, 12, 1, shade(c2, 1.3));
    for (let i = 0; i < 11; i++) p.px(9 + Math.sin((i / 10) * Math.PI) * 3, 2 + i, c);
    p.line(9, 2, 9, 12, '#e8e8e8').rect(1, 9, 3, 4, shade(c2, 0.8));
  },
  gun: (p, [metal, wood]) => {
    p.rect(3, 5, 12, 3, metal).rect(3, 5, 12, 1, shade(metal, 1.3)).rect(14, 4, 1, 1, metal);
    p.rect(1, 7, 6, 3, wood).rect(1, 9, 3, 4, wood).rect(7, 8, 2, 3, shade(metal, 0.7));
  },
  wand: (p, [wood, gem]) => {
    p.line(2, 14, 11, 5, wood).line(3, 14, 12, 5, shade(wood, 0.8));
    p.disc(12, 4, 2.5, gem).px(11, 3, '#ffffff');
  },
  staff: (p, [gem, wood]) => {
    p.line(1, 15, 11, 5, wood).line(2, 15, 12, 5, shade(wood, 0.8));
    p.box(10, 1, 5, 5, shade(wood, 1.2)).disc(12, 3, 2, gem).px(12, 2, '#ffffff');
  },
  tome: (p, [c, c2]) => {
    p.rect(3, 2, 10, 12, c2).rect(4, 2, 9, 11, c).rect(4, 12, 9, 2, '#e8dcc0').rect(3, 2, 1, 12, shade(c2, 0.7));
    p.disc(8, 7, 2, shade(c, 1.5)).px(8, 7, '#ffffff');
  },
  helmet: (p, [c, trim]) => {
    p.rect(3, 3, 10, 9, c).rect(3, 3, 10, 2, shade(c, 1.3)).rect(3, 10, 10, 2, trim).rect(5, 7, 6, 2, '#1a1420').rect(7, 1, 2, 3, trim);
  },
  chestplate: (p, [c, trim]) => {
    p.rect(3, 3, 10, 11, c).rect(1, 3, 3, 5, shade(c, 0.85)).rect(12, 3, 3, 5, shade(c, 0.85));
    p.rect(3, 3, 10, 1, shade(c, 1.3)).rect(7, 4, 2, 9, trim).rect(3, 13, 10, 1, shade(c, 0.7));
  },
  greaves: (p, [c, trim]) => {
    p.rect(3, 2, 10, 3, trim).rect(3, 5, 4, 9, c).rect(9, 5, 4, 9, c).rect(3, 5, 1, 9, shade(c, 1.3)).rect(9, 5, 1, 9, shade(c, 1.3));
    p.rect(2, 13, 5, 2, shade(c, 0.7)).rect(9, 13, 5, 2, shade(c, 0.7));
  },
  potion: (p, [c]) => {
    p.rect(6, 1, 4, 2, '#a4713f').rect(6, 3, 4, 3, '#bfe6f0');
    p.disc(8, 10, 5, '#bfe6f0').disc(8, 10.5, 4, c).rect(5, 8, 2, 2, shade(c, 1.5)).px(6, 7, '#ffffff');
  },
  bowl: (p, [c, bowl]) => {
    p.rect(2, 8, 12, 2, c).rect(3, 7, 10, 1, shade(c, 1.3));
    p.rect(2, 10, 12, 2, bowl).rect(3, 12, 10, 1, bowl).rect(4, 13, 8, 1, shade(bowl, 0.7));
  },
  mushroom: (p, [cap, stem]) => {
    p.rect(6, 8, 4, 6, stem).rect(2, 4, 12, 5, cap).rect(4, 3, 8, 1, cap).px(5, 5, '#ffffff').px(10, 6, '#ffffff');
  },
  heart: (p, [c, c2]) => {
    p.disc(5, 6, 3, c).disc(11, 6, 3, c);
    for (let y = 6; y < 14; y++) p.rect(2 + (y - 6), y, 12 - (y - 6) * 2, 1, c);
    p.rect(4, 4, 2, 2, c2 ?? '#ffffff');
  },
  coin: (p, [c, c2]) => {
    p.disc(8, 8, 6, c2).disc(8, 8, 5, c).rect(7, 5, 2, 6, c2).px(6, 5, shade(c, 1.4));
  },
  boots: (p, [c, trim]) => {
    p.rect(4, 2, 5, 10, c).rect(4, 11, 10, 3, c).rect(4, 2, 5, 2, trim).rect(4, 14, 10, 1, shade(c, 0.6)).rect(5, 4, 1, 7, shade(c, 1.3));
  },
  charm: (p, [c, c2]) => {
    p.line(4, 1, 8, 5, '#c0c0c8').line(12, 1, 8, 5, '#c0c0c8');
    p.disc(8, 10, 4, c).disc(8, 10, 2, c2).px(7, 9, '#ffffff');
  },
  amulet: (p, [c, c2]) => {
    p.line(3, 1, 8, 7, c2).line(13, 1, 8, 7, c2);
    for (let y = 0; y < 7; y++) p.rect(8 - (3 - Math.abs(y - 3)), 7 + y, (3 - Math.abs(y - 3)) * 2 + 1, 1, c);
  },
  ring: (p, [c, gem]) => {
    p.disc(8, 10, 4.5, c).disc(8, 10, 2.5, 'rgba(0,0,0,0)');
    p.g.clearRect(6, 8, 5, 5);
    p.disc(8, 4, 2.5, gem).px(7, 3, '#ffffff');
  },
  lens: (p, [frame, glass]) => {
    p.disc(7, 7, 5, frame).disc(7, 7, 3.5, glass).px(5, 5, '#ffffff').line(10, 10, 14, 14, frame);
  },
  sash: (p, [c, c2]) => {
    p.line(2, 3, 13, 12, c).line(2, 4, 12, 12, c).line(3, 3, 13, 11, c).rect(6, 6, 4, 3, c2).line(12, 12, 14, 15, c);
  },
  glove: (p, [c, c2]) => {
    p.rect(4, 5, 8, 9, c).rect(4, 2, 2, 4, c).rect(6, 1, 2, 5, c).rect(8, 1, 2, 5, c).rect(10, 3, 2, 3, c).rect(12, 7, 2, 3, c);
    p.rect(4, 12, 8, 2, c2);
  },
  shield: (p, [c, trim]) => {
    for (let y = 0; y < 13; y++) {
      const w = y < 8 ? 12 : 12 - (y - 7) * 2;
      p.rect(8 - w / 2, 1 + y, w, 1, y === 0 ? shade(c, 1.3) : c);
    }
    p.rect(7, 2, 2, 11, trim).rect(3, 6, 10, 2, trim);
  },
  lantern: (p, [c, c2]) => {
    p.rect(6, 1, 4, 2, '#5d6474').rect(4, 3, 8, 10, '#5d6474').rect(5, 4, 6, 8, c).rect(6, 5, 2, 3, c2 ?? '#ffffff').rect(5, 13, 6, 2, '#5d6474');
  },
  compass: (p, [c, c2]) => {
    p.disc(8, 8, 6, shade(c, 0.7)).disc(8, 8, 5, c).disc(8, 8, 4, '#e8e8e0').line(8, 4, 8, 8, c2).line(8, 8, 8, 12, '#3a3a3a');
  },
  bucket: (p, [c, liquid]) => {
    p.rect(3, 5, 10, 9, c).rect(4, 14, 8, 1, shade(c, 0.7)).box(3, 5, 10, 9, shade(c, 0.6));
    if (liquid) p.rect(4, 6, 8, 3, liquid);
    p.line(3, 5, 8, 1, '#5d6474').line(8, 1, 13, 5, '#5d6474');
  },
  arrow: (p, [head, fletch]) => {
    p.line(2, 13, 12, 3, '#a4713f').rect(11, 2, 3, 3, head).px(14, 1, head).rect(1, 12, 3, 3, fletch);
  },
  bullet: (p, [c]) => {
    for (let i = 0; i < 3; i++) p.rect(3 + i * 4, 6, 3, 6, c).rect(3 + i * 4, 5, 3, 1, shade(c, 1.3)).rect(3 + i * 4, 11, 3, 1, '#c0a050');
  },
  lure: (p, [c, c2]) => {
    p.disc(8, 9, 5, c2).disc(8, 8, 4, c);
    for (let i = 0; i < 4; i++) p.line(5 + i * 2, 12, 4 + i * 2, 15, c2);
    p.px(6, 7, '#1a1420').px(10, 7, '#1a1420').line(8, 1, 8, 4, '#c0c0c8');
  },
  seed: (p, [c, c2]) => {
    p.disc(8, 9, 5, c2).disc(8, 8, 4, c).line(8, 4, 10, 1, '#3f8f33').line(8, 12, 6, 15, c2).px(6, 6, '#e0b0ff');
  },
  prism: (p, [c, c2]) => {
    for (let y = 0; y < 12; y++) p.rect(8 - y / 2, 2 + y, y + 1, 1, y % 3 === 0 ? c2 : c);
    p.line(2, 13, 14, 13, shade(c, 0.6));
  },
  chalice: (p, [c, c2]) => {
    p.rect(3, 2, 10, 5, c2).rect(4, 7, 8, 1, c2).rect(7, 8, 2, 4, c2).rect(4, 12, 8, 2, c2).rect(4, 2, 8, 2, c).px(6, 1, c).px(10, 0, c);
  },
  sigil: (p, [c, c2]) => {
    p.disc(8, 8, 7, c2).disc(8, 8, 5.5, '#1a1420');
    T.star(p, [c, '#ffffff']);
  },
  horn: (p, [c, c2]) => {
    for (let i = 0; i < 12; i++) p.rect(2 + i, 10 - i / 3 - (i > 8 ? i - 8 : 0), 2, 2 + i / 3, i % 4 === 0 ? c2 : c);
  },
  flower: (p, [c, c2]) => {
    p.line(8, 15, 8, 7, '#3f8f33');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.disc(8 + Math.cos(a) * 3, 5 + Math.sin(a) * 3, 2, c);
    }
    p.disc(8, 5, 1.5, c2);
  },
  flame: (p, [c]) => {
    for (let y = 0; y < 12; y++) {
      const w = Math.sin((y / 12) * Math.PI) * 8;
      p.rect(8 - w / 2, 3 + y, w, 1, y > 6 ? c : shade(c, 1.3));
    }
    p.rect(7, 10, 2, 3, '#ffe070');
  },
  drop: (p, [c]) => {
    for (let y = 0; y < 11; y++) {
      const w = y < 5 ? y * 1.2 : 10 - (y - 5) * 0.8;
      p.rect(8 - w / 2, 3 + y, w, 1, c);
    }
    p.px(6, 9, '#ffffff');
  },
  snowflake: (p, [c]) => {
    p.line(8, 1, 8, 15, c).line(2, 4, 14, 12, c).line(2, 12, 14, 4, c).disc(8, 8, 1.5, '#ffffff');
  },
  unknown: (p) => {
    p.rect(3, 3, 10, 10, '#ff00ff').rect(3, 3, 5, 5, '#000').rect(8, 8, 5, 5, '#000');
  },
};

function outline(p: Pix): void {
  // Add a 1px dark outline around opaque pixels for readability.
  const img = p.g.getImageData(0, 0, p.w, p.h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h && d[(y * p.w + x) * 4 + 3] > 40;
  const marks: [number, number][] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
  p.g.fillStyle = 'rgba(20,14,28,0.55)';
  for (const [x, y] of marks) p.g.fillRect(x, y, 1, 1);
}

function buildIcon(spec: IconSpec): Canvas2D {
  if (spec.t === 'tile' && spec.tile) {
    const id = TileRegistry.id(spec.tile);
    const tex = TileTextures.tile(id, 0);
    const p = new Pix(16, 16);
    if (tex) {
      p.g.drawImage(tex, 2, 2, 12, 12);
      p.box(2, 2, 12, 12, 'rgba(0,0,0,0.35)');
      if (TileRegistry.get(id).texture.kind === 'grass') p.rect(2, 2, 12, 3, TileRegistry.get(id).texture.accent ?? '#4fa33b');
    } else {
      const spr = ObjectSprites.get(spec.tile, 0);
      if (spr) drawFit(p, spr);
    }
    return p.canvas;
  }
  if (spec.t === 'wall' && spec.wall) {
    const tex = TileTextures.wall(TileRegistry.wallId(spec.wall), 0);
    const p = new Pix(16, 16);
    if (tex) {
      p.g.drawImage(tex, 1, 1, 14, 14);
      p.g.drawImage(tex, 1, 1, 14, 14);
      p.box(1, 1, 14, 14, 'rgba(0,0,0,0.5)');
    }
    return p.canvas;
  }
  if (spec.t === 'object' && spec.tile) {
    const spr = ObjectSprites.get(spec.tile, 0);
    const size = spr ? Math.max(spr.width, spr.height) : 16;
    const p = new Pix(Math.max(16, size), Math.max(16, size));
    if (spr) p.g.drawImage(spr, Math.floor((p.w - spr.width) / 2), Math.floor((p.h - spr.height) / 2));
    return p.canvas;
  }
  const p = new Pix(16, 16);
  const tpl = T[spec.t] ?? T.unknown;
  try {
    tpl(p, spec.c ?? ['#cccccc', '#888888']);
  } catch (err) {
    console.warn('[icons] failed to draw', spec, err);
    T.unknown(p, []);
  }
  outline(p);
  void OUT;
  return p.canvas;
}

function drawFit(p: Pix, spr: Canvas2D): void {
  const s = Math.min(16 / spr.width, 16 / spr.height, 1);
  const w = spr.width * s;
  const h = spr.height * s;
  p.g.drawImage(spr, (16 - w) / 2, (16 - h) / 2, w, h);
}

const iconCache = new Map<string, Canvas2D>();
const urlCache = new Map<string, string>();

/** Icon canvas for an item id (cached). */
export function itemIcon(id: string): Canvas2D {
  let c = iconCache.get(id);
  if (!c) {
    c = buildIcon(ItemRegistry.get(id).icon);
    iconCache.set(id, c);
  }
  return c;
}

/** Data URL for use in DOM <img>/CSS. */
export function itemIconUrl(id: string): string {
  let u = urlCache.get(id);
  if (!u) {
    u = itemIcon(id).toDataURL();
    urlCache.set(id, u);
  }
  return u;
}

/** Arbitrary spec (buff icons etc). */
const specCache = new Map<string, string>();
export function iconUrlFromSpec(spec: IconSpec): string {
  const k = JSON.stringify(spec);
  let u = specCache.get(k);
  if (!u) {
    u = buildIcon(spec).toDataURL();
    specCache.set(k, u);
  }
  return u;
}
