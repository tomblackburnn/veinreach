import type { GameSession } from '../core/GameSession';
import { TileRegistry } from '../world/TileRegistry';
import { hexToRgb } from '../utils/color';
import { h } from '../utils/dom';

const MW = 220;
const MH = 150;
const SCALE = 2;

/**
 * Explored-terrain map. A world-sized ImageData is updated incrementally as
 * tiles are explored or edited; the minimap shows a window around the player
 * and the full map (M) shows everything explored, with markers.
 */
export class Minimap {
  private worldCanvas: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private img: ImageData;
  private dirty = new Set<number>();
  private rebuildAll = true;
  private mini: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private tileRGB: [number, number, number][];
  private wallRGB: [number, number, number][];
  private full: HTMLCanvasElement | null = null;

  constructor(private s: GameSession) {
    const w = s.world;
    this.worldCanvas = document.createElement('canvas');
    this.worldCanvas.width = w.width;
    this.worldCanvas.height = w.height;
    this.wctx = this.worldCanvas.getContext('2d')!;
    this.img = this.wctx.createImageData(w.width, w.height);
    this.tileRGB = TileRegistry.defs.map((d) => hexToRgb(d?.mapColor ?? '#000000'));
    this.wallRGB = TileRegistry.walls.map((d) => hexToRgb(d?.mapColor ?? '#000000'));
    this.mini = h('canvas', { class: 'minimap', width: String(MW), height: String(MH) });
    this.mctx = this.mini.getContext('2d')!;
    this.mctx.imageSmoothingEnabled = false;
    s.hud.barsEl.appendChild(this.mini);
  }

  onExplored(x: number, y: number): void {
    this.dirty.add(y * this.s.world.width + x);
  }

  onTileChanged(x: number, y: number): void {
    if (this.s.world.isExplored(x, y)) this.dirty.add(y * this.s.world.width + x);
  }

  rebuild(): void {
    this.rebuildAll = true;
  }

  private colorAt(x: number, y: number, o: number): void {
    const w = this.s.world;
    const d = this.img.data;
    const fg = w.getFg(x, y);
    let c: [number, number, number];
    if (fg) c = this.tileRGB[fg];
    else if (w.getLiquid(x, y) > 0) c = w.getLiquidType(x, y) === 2 ? [230, 90, 20] : [40, 90, 200];
    else if (w.getWall(x, y)) c = this.wallRGB[w.getWall(x, y)];
    else if (y < w.layers.undergroundY) c = [120, 170, 220];
    else if (y >= w.layers.underworldY) c = [40, 10, 8];
    else c = [22, 16, 24];
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = 255;
  }

  update(): void {
    const w = this.s.world;
    if (this.rebuildAll) {
      this.rebuildAll = false;
      this.dirty.clear();
      const d = this.img.data;
      for (let y = 0; y < w.height; y++) {
        for (let x = 0; x < w.width; x++) {
          const o = (y * w.width + x) * 4;
          if (w.isExplored(x, y)) this.colorAt(x, y, o);
          else d[o + 3] = 0;
        }
      }
      this.wctx.putImageData(this.img, 0, 0);
      return;
    }
    if (!this.dirty.size) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (const k of this.dirty) {
      const x = k % w.width;
      const y = Math.floor(k / w.width);
      this.colorAt(x, y, k * 4);
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    this.dirty.clear();
    this.wctx.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  /** Draw the corner minimap. */
  render(): void {
    const s = this.s;
    const p = s.player;
    const g = this.mctx;
    const vw = MW / SCALE;
    const vh = MH / SCALE;
    const sx = Math.max(0, Math.min(s.world.width - vw, p.tileX - vw / 2));
    const sy = Math.max(0, Math.min(s.world.height - vh, p.tileY - vh / 2));
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, MW, MH);
    g.drawImage(this.worldCanvas, sx, sy, vw, vh, 0, 0, MW, MH);
    const mark = (tx: number, ty: number, c: string, size = 4) => {
      const x = (tx - sx) * SCALE;
      const y = (ty - sy) * SCALE;
      if (x < 0 || y < 0 || x > MW || y > MH) return;
      g.fillStyle = '#000';
      g.fillRect(x - size / 2 - 1, y - size / 2 - 1, size + 2, size + 2);
      g.fillStyle = c;
      g.fillRect(x - size / 2, y - size / 2, size, size);
    };
    if (p.stats.detectEnemies) for (const e of s.entities.enemies) if (!e.head) mark(e.cx / 16, e.cy / 16, '#ff4a4a', 3);
    for (const n of s.entities.npcs) mark(n.cx / 16, n.cy / 16, '#6affb0', 4);
    for (const b of s.bosses.active) mark(b.cx / 16, b.cy / 16, '#ff2a8a', 7);
    for (const r of s.entities.remotes) mark(r.cx / 16, r.cy / 16, '#6ab0ff', 5);
    mark(p.cx / 16, p.cy / 16, '#ffffff', 5);
  }

  /** Full-screen explored map. */
  renderFull(container: HTMLElement): void {
    const s = this.s;
    const w = s.world;
    const maxW = window.innerWidth - 100;
    const maxH = window.innerHeight - 100;
    const scale = Math.min(maxW / w.width, maxH / w.height);
    if (!this.full) {
      this.full = document.createElement('canvas');
      container.appendChild(this.full);
      container.appendChild(h('div', { style: 'position:absolute;bottom:8px;left:12px;font-size:18px', class: 'muted' }, 'World map — click or press M to close'));
    }
    const c = this.full;
    c.width = Math.floor(w.width * scale);
    c.height = Math.floor(w.height * scale);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(this.worldCanvas, 0, 0, c.width, c.height);
    g.font = '14px VT323, monospace';
    for (const st of w.structures) {
      if (!st.discovered) continue;
      const x = (st.x + st.w / 2) * scale;
      const y = st.y * scale;
      g.fillStyle = '#ffe8a0';
      g.fillRect(x - 3, y - 3, 6, 6);
      g.fillStyle = '#000';
      g.fillText(st.name, x + 6, y + 5);
      g.fillStyle = '#ffe8a0';
      g.fillText(st.name, x + 5, y + 4);
    }
    const dot = (tx: number, ty: number, col: string, r = 4) => {
      g.fillStyle = '#000';
      g.fillRect(tx * scale - r - 1, ty * scale - r - 1, r * 2 + 2, r * 2 + 2);
      g.fillStyle = col;
      g.fillRect(tx * scale - r, ty * scale - r, r * 2, r * 2);
    };
    for (const n of s.entities.npcs) dot(n.cx / 16, n.cy / 16, '#6affb0', 3);
    for (const b of s.bosses.active) dot(b.cx / 16, b.cy / 16, '#ff2a8a', 5);
    dot(s.player.spawnX, s.player.spawnY, '#f5cf3c', 3);
    dot(s.player.cx / 16, s.player.cy / 16, '#ffffff', 4);
  }
}
