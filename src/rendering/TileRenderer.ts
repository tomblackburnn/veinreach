import { CHUNK_SIZE, CHUNK_PX, TILE_SIZE as S } from '../core/config';
import type { World } from '../world/World';
import type { Chunk } from '../world/Chunk';
import { TileRegistry, T, LIQUID } from '../world/TileRegistry';
import { TileTextures, VARIANTS } from './sprites/tileTextures';
import { ObjectSprites, treeCrown } from './sprites/objectSprites';
import { makeCanvas, ctx2d, Pix, type Canvas2D } from './sprites/pixel';
import { hash3 } from '../utils/random';

interface CacheEntry {
  canvas: Canvas2D;
  g: CanvasRenderingContext2D;
  used: number;
}

const MAX_CACHES = 96;

/** Crack overlay stages (drawn over tiles being mined). */
let cracks: Canvas2D[] | null = null;
function crackSprites(): Canvas2D[] {
  if (cracks) return cracks;
  cracks = [];
  for (let s = 0; s < 4; s++) {
    const p = new Pix(16, 16);
    const n = 2 + s * 2;
    for (let i = 0; i < n; i++) {
      let x = 8;
      let y = 8;
      const dx = Math.cos((i / n) * Math.PI * 2 + s);
      const dy = Math.sin((i / n) * Math.PI * 2 + s);
      for (let k = 0; k < 3 + s * 2; k++) {
        p.px(x, y, 'rgba(20,10,10,0.75)');
        x += Math.round(dx + (hash3(i, k, s) % 3) - 1) * 0.8;
        y += Math.round(dy + (hash3(k, i, s) % 3) - 1) * 0.8;
      }
    }
    cracks.push(p.canvas);
  }
  return cracks;
}

/**
 * Renders tiles through per-chunk cached canvases. Only chunks overlapping the
 * view are drawn; caches are rebuilt when a chunk is dirty and evicted LRU,
 * which is how chunks are "loaded/unloaded" for rendering.
 */
export class TileRenderer {
  private caches = new Map<number, CacheEntry>();
  private frame = 0;
  rebuiltThisFrame = 0;

  get cachedChunks(): number {
    return this.caches.size;
  }

  invalidateAll(): void {
    this.caches.clear();
  }

  render(g: CanvasRenderingContext2D, world: World, l: number, t: number, r: number, b: number): void {
    this.frame++;
    this.rebuiltThisFrame = 0;
    const cx0 = Math.max(0, Math.floor(l / CHUNK_PX));
    const cy0 = Math.max(0, Math.floor(t / CHUNK_PX));
    const cx1 = Math.min(world.chunksX - 1, Math.floor(r / CHUNK_PX));
    const cy1 = Math.min(world.chunksY - 1, Math.floor(b / CHUNK_PX));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = world.getChunk(cx, cy)!;
        const key = cy * world.chunksX + cx;
        let e = this.caches.get(key);
        if (!e || chunk.renderDirty) {
          // Budget rebuilds per frame so big edits don't stall; stale caches are still drawn.
          if (!e || this.rebuiltThisFrame < 6) {
            e = this.build(world, chunk, e);
            this.caches.set(key, e);
            chunk.renderDirty = false;
            this.rebuiltThisFrame++;
          }
        }
        e.used = this.frame;
        g.drawImage(e.canvas, cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
    if (this.caches.size > MAX_CACHES) {
      const entries = [...this.caches.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < entries.length - MAX_CACHES; i++) this.caches.delete(entries[i][0]);
    }
  }

  private build(world: World, chunk: Chunk, reuse?: CacheEntry): CacheEntry {
    const canvas = reuse?.canvas ?? makeCanvas(CHUNK_PX, CHUNK_PX);
    const g = reuse?.g ?? ctx2d(canvas);
    g.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
    const bx = chunk.cx * CHUNK_SIZE;
    const by = chunk.cy * CHUNK_SIZE;
    const solid = TileRegistry.solid;
    const opaque = TileRegistry.opaque;
    // Walls
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = ly * CHUNK_SIZE + lx;
        const wall = chunk.wall[i];
        if (!wall || opaque[chunk.fg[i]]) continue;
        const tx = bx + lx;
        const ty = by + ly;
        const tex = TileTextures.wall(wall, hash3(tx, ty, 1) % VARIANTS);
        if (tex) g.drawImage(tex, lx * S, ly * S);
        // Soft shadow where a wall meets empty background above/left.
        if (world.getWall(tx, ty - 1) === 0) {
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(lx * S, ly * S, S, 2);
        }
      }
    }
    // Foreground
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const i = ly * CHUNK_SIZE + lx;
        const id = chunk.fg[i];
        if (!id) continue;
        const tx = bx + lx;
        const ty = by + ly;
        const def = TileRegistry.get(id);
        const px = lx * S;
        const py = ly * S;
        if (def.texture.kind === 'sprite') {
          this.drawSpriteTile(g, def.key, chunk.frame[i], px, py, def.size);
          continue;
        }
        const tex = TileTextures.tile(id, hash3(tx, ty, 0) % VARIANTS);
        if (tex) g.drawImage(tex, px, py);
        if (def.noEdges) continue;
        // Exposed faces get a dark rim + light top highlight, and grass fringes.
        const up = world.getFg(tx, ty - 1);
        const dn = world.getFg(tx, ty + 1);
        const lf = world.getFg(tx - 1, ty);
        const rt = world.getFg(tx + 1, ty);
        const eUp = !solid[up] && ty > 0;
        const eDn = !solid[dn] && ty < world.height - 1;
        const eLf = !solid[lf] && tx > 0;
        const eRt = !solid[rt] && tx < world.width - 1;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        if (eDn) g.fillRect(px, py + S - 2, S, 2);
        if (eLf) g.fillRect(px, py, 1, S);
        if (eRt) g.fillRect(px + S - 1, py, 1, S);
        if (eUp) {
          g.fillStyle = 'rgba(255,255,255,0.14)';
          g.fillRect(px, py, S, 1);
        }
        // Subtle seams between different materials.
        g.fillStyle = 'rgba(0,0,0,0.12)';
        if (!eUp && up !== id && solid[up]) g.fillRect(px, py, S, 1);
        if (!eLf && lf !== id && solid[lf]) g.fillRect(px, py, 1, S);
        if (def.texture.kind === 'grass') {
          const o = TileTextures.grassOverlay(id);
          if (eUp) g.drawImage(o.top, px, py);
          if (eLf) g.drawImage(o.side, px, py);
          if (eRt) {
            g.save();
            g.translate(px + S, py);
            g.scale(-1, 1);
            g.drawImage(o.side, 0, 0);
            g.restore();
          }
        }
        // Rounded corners on exposed corners (clear 2 pixels) for a softer silhouette.
        if (eUp && eLf) this.corner(g, world, tx, ty, px, py);
        if (eUp && eRt) this.corner(g, world, tx, ty, px + S - 2, py);
      }
    }
    return { canvas, g, used: this.frame };
  }

  private corner(g: CanvasRenderingContext2D, world: World, tx: number, ty: number, x: number, y: number): void {
    g.clearRect(x, y, 2, 1);
    g.clearRect(x + (x % S === 0 ? 0 : 1), y + 1, 1, 1);
    const wall = world.getWall(tx, ty);
    if (wall) {
      const tex = TileTextures.wall(wall, 0);
      if (tex) {
        g.drawImage(tex, x % S, 0, 2, 1, x, y, 2, 1);
        g.drawImage(tex, (x % S) + (x % S === 0 ? 0 : 1), 1, 1, 1, x + (x % S === 0 ? 0 : 1), y + 1, 1, 1);
      }
    }
  }

  private drawSpriteTile(g: CanvasRenderingContext2D, key: string, frame: number, px: number, py: number, size?: [number, number]): void {
    let spriteKey = key;
    let variant = 0;
    if (size) {
      const spr = ObjectSprites.get(spriteKey, 0);
      if (!spr) return;
      const ox = frame & 15;
      const oy = frame >> 4;
      g.drawImage(spr, ox * S, oy * S, S, S, px, py, S, S);
      return;
    }
    if (key === 'treetop') spriteKey = 'trunk';
    variant = frame;
    const spr = ObjectSprites.get(spriteKey, variant);
    if (spr) g.drawImage(spr, px, py);
  }

  /**
   * Per-frame pass over visible tiles for things that animate or overflow
   * their cell: liquids, tree crowns, flames.
   */
  renderDynamic(g: CanvasRenderingContext2D, world: World, l: number, t: number, r: number, b: number, tick: number): void {
    const x0 = Math.max(0, Math.floor(l / S) - 3);
    const y0 = Math.max(0, Math.floor(t / S) - 1);
    const x1 = Math.min(world.width - 1, Math.ceil(r / S) + 3);
    const y1 = Math.min(world.height - 1, Math.ceil(b / S) + 5);
    const crowns: [number, number, number][] = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const fg = world.getFg(tx, ty);
        const liq = world.getLiquid(tx, ty);
        if (liq > 0) {
          const lava = world.getLiquidType(tx, ty) === LIQUID.lava;
          const above = world.getLiquid(tx, ty - 1) > 0;
          const h = above ? S : Math.max(2, Math.round((liq / 255) * S));
          const y = ty * S + S - h;
          g.fillStyle = lava ? 'rgba(255,96,24,0.92)' : 'rgba(38,104,214,0.55)';
          g.fillRect(tx * S, y, S, h);
          if (!above) {
            const wave = Math.sin(tick * 0.08 + tx * 0.7) > 0.3 ? 1 : 0;
            g.fillStyle = lava ? 'rgba(255,210,90,0.95)' : 'rgba(170,215,255,0.7)';
            g.fillRect(tx * S, y + wave, S, 2);
          } else if (lava && (tx + ty + (tick >> 4)) % 7 === 0) {
            g.fillStyle = 'rgba(255,160,60,0.6)';
            g.fillRect(tx * S + 4, ty * S + 6, 4, 3);
          }
        }
        if (!fg) continue;
        if (fg === T.treetop) crowns.push([tx, ty, world.getFrame(tx, ty)]);
        else if (fg === T.torch) this.flame(g, tx * S + 8, ty * S + 5, tick, tx, 1);
        else if (fg === 69) {
          const f = world.getFrame(tx, ty);
          if ((f & 15) === 1 && f >> 4 === 0) {
            this.flame(g, tx * S + 8, ty * S + 22, tick, tx, 2.2);
          }
        }
      }
    }
    for (const [tx, ty, kind] of crowns) {
      const c = treeCrown(kind);
      const sway = Math.sin(tick * 0.02 + tx) * 1;
      g.drawImage(c, tx * S + 8 - c.width / 2 + sway, ty * S + 16 - c.height + 10);
    }
  }

  private flame(g: CanvasRenderingContext2D, x: number, y: number, tick: number, seed: number, scale: number): void {
    const f = Math.sin(tick * 0.3 + seed) * 0.5 + Math.sin(tick * 0.53 + seed * 2) * 0.5;
    const h = (4 + f) * scale;
    g.fillStyle = '#ff7a20';
    g.fillRect(x - 2 * scale, y - h, 4 * scale, h);
    g.fillStyle = '#ffd040';
    g.fillRect(x - 1 * scale, y - h * 0.8, 2 * scale, h * 0.8);
    g.fillStyle = '#fff8d0';
    g.fillRect(x - 0.5 * scale, y - h * 0.4, 1 * scale, h * 0.4);
  }

  renderCracks(g: CanvasRenderingContext2D, each: (fn: (x: number, y: number, f: number) => void) => void): void {
    const sprites = crackSprites();
    each((x, y, f) => {
      const stage = Math.min(3, Math.floor(f * 4));
      g.drawImage(sprites[stage], x * S, y * S);
    });
  }
}
