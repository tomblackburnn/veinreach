import type { GameSession } from '../../core/GameSession';
import { h, clear } from '../../utils/dom';
import { TileRegistry } from '../../world/TileRegistry';
import { PAINT_PALETTE, canvasArtSize, blankArt, isCanvasTile, isPainted } from '../../world/paintings';
import type { PaintingData } from '../../world/WorldState';

type Tool = 'brush' | 'fill' | 'picker';

const MAX_UNDO = 40;

/**
 * Pixel-art editor for canvases hung in the world. Left button paints with
 * the chosen colour, right button paints bare canvas. Changes are saved to
 * the world (and shared in multiplayer) when the editor closes.
 */
export class PaintPanel {
  private el: HTMLDivElement;
  private body: HTMLDivElement;
  private view!: HTMLCanvasElement;
  private preview!: HTMLCanvasElement;
  private art: string[] = [];
  private undo: string[] = [];
  private original = '';
  private w = 0;
  private h = 0;
  private ox = 0;
  private oy = 0;
  private cell = 16;
  private color = 1;
  private tool: Tool = 'brush';
  private painting = 0; // 0 none, 1 primary, 2 erase
  private last: [number, number] | null = null;
  private swatches: HTMLElement[] = [];
  private toolBtns = new Map<Tool, HTMLElement>();
  isOpen = false;

  constructor(private s: GameSession) {
    this.body = h('div', { class: 'col' });
    this.el = h('div', { class: 'panel paint-panel' }, this.body);
    this.el.style.display = 'none';
    s.host.ui.root.appendChild(this.el);
    window.addEventListener('mouseup', this.onUp);
  }

  /** Open the editor for the canvas occupying tile (x, y). */
  open(x: number, y: number): void {
    const w = this.s.world;
    const id = w.getFg(x, y);
    if (!isCanvasTile(id)) return;
    this.s.ui.closeWorldPanels(); // also saves any canvas already open
    [this.ox, this.oy] = w.objectOrigin(x, y);
    [this.w, this.h] = canvasArtSize(id);
    const existing = w.paintings.get(w.chestKey(this.ox, this.oy));
    this.original = existing && existing.w === this.w && existing.h === this.h ? existing.px : blankArt(this.w, this.h);
    this.art = this.original.split('');
    this.undo = [];
    this.cell = Math.max(8, Math.min(22, Math.floor(420 / this.w), Math.floor(300 / this.h)));
    this.isOpen = true;
    this.el.style.display = '';
    this.build(TileRegistry.get(id).name);
    this.redraw();
  }

  /** Close and keep the painting. */
  close(): void {
    if (!this.isOpen) return;
    this.commit();
    this.isOpen = false;
    this.painting = 0;
    this.el.style.display = 'none';
  }

  /** Close without keeping changes made since opening. */
  cancel(): void {
    this.art = this.original.split('');
    this.close();
  }

  update(): void {
    if (!this.isOpen) return;
    const p = this.s.player;
    const w = this.s.world;
    const gone = !isCanvasTile(w.getFg(this.ox, this.oy)) || w.getFrame(this.ox, this.oy) !== 0;
    const far = Math.abs(p.tileX - this.ox) > 12 || Math.abs(p.tileY - this.oy) > 10;
    if (gone) {
      this.isOpen = false;
      this.el.style.display = 'none';
    } else if (far || p.dead) this.close();
  }

  /** A remote player changed this painting while it is open: adopt their version. */
  refresh(p: PaintingData): void {
    if (!this.isOpen || p.x !== this.ox || p.y !== this.oy || p.w !== this.w || p.h !== this.h) return;
    this.art = p.px.split('');
    this.original = p.px;
    this.redraw();
  }

  dispose(): void {
    window.removeEventListener('mouseup', this.onUp);
    this.el.remove();
  }

  private commit(): void {
    const w = this.s.world;
    const px = this.art.join('');
    const key = w.chestKey(this.ox, this.oy);
    const before = w.paintings.get(key)?.px ?? blankArt(this.w, this.h);
    if (px === before) return;
    const data: PaintingData = { x: this.ox, y: this.oy, w: this.w, h: this.h, px };
    if (isPainted(data)) w.paintings.set(key, data);
    else w.paintings.delete(key);
    const [tw, th] = TileRegistry.get(w.getFg(this.ox, this.oy)).size ?? [1, 1];
    w.invalidateRender(this.ox, this.oy, tw, th);
    this.s.paintingChanged(data);
    this.s.bus.emit('saveRequested', { reason: 'painting' });
  }

  private build(title: string): void {
    clear(this.body);
    this.view = h('canvas', { class: 'paint-canvas', width: String(this.w), height: String(this.h) });
    this.view.style.width = `${this.w * this.cell}px`;
    this.view.style.height = `${this.h * this.cell}px`;
    this.view.addEventListener('mousedown', this.onDown);
    this.view.addEventListener('mousemove', this.onMove);
    this.view.addEventListener('contextmenu', (e) => e.preventDefault());
    this.preview = h('canvas', { class: 'paint-preview', width: String(this.w), height: String(this.h) });
    this.preview.style.width = `${this.w * 2}px`;
    this.preview.style.height = `${this.h * 2}px`;

    this.swatches = PAINT_PALETTE.map((c, i) => {
      const sw = h('div', { class: 'paint-swatch', title: i === 0 ? 'Bare canvas' : c, style: `background:${c}` });
      sw.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.color = i;
        if (this.tool === 'picker') this.setTool('brush');
        this.syncSwatches();
      });
      return sw;
    });
    const tool = (t: Tool, label: string, tip: string) => {
      const b = h('button', { class: 'btn small', title: tip, onclick: () => this.setTool(t) }, label);
      this.toolBtns.set(t, b);
      return b;
    };
    this.body.append(
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, title), h('div', { class: 'spacer' }), h('span', { class: 'label-sm' }, 'Preview'), h('div', { class: 'paint-preview-frame' }, this.preview)),
      h('div', { class: 'hint' }, 'Left-click paints, right-click erases. Your painting is kept when you close this window.'),
      h('div', { class: 'row paint-tools' }, tool('brush', 'Brush', 'Paint single pixels'), tool('fill', 'Fill', 'Flood-fill an area'), tool('picker', 'Pick', 'Pick a colour from the painting'), h('div', { class: 'spacer' }), h('button', { class: 'btn small', onclick: () => this.popUndo() }, 'Undo'), h('button', { class: 'btn small', onclick: () => this.clearArt() }, 'Clear')),
      h('div', { class: 'paint-stage', style: `--cell:${this.cell}px` }, this.view),
      h('div', { class: 'paint-palette' }, ...this.swatches),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => this.cancel() }, 'Discard changes'), h('div', { class: 'spacer' }), h('button', { class: 'btn gold', onclick: () => this.close() }, 'Done')),
    );
    this.setTool(this.tool);
    this.syncSwatches();
  }

  private setTool(t: Tool): void {
    this.tool = t;
    for (const [k, b] of this.toolBtns) b.classList.toggle('gold', k === t);
  }

  private syncSwatches(): void {
    this.swatches.forEach((sw, i) => sw.classList.toggle('active', i === this.color));
  }

  private cellAt(e: MouseEvent): [number, number] | null {
    const r = this.view.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * this.w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * this.h);
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? [x, y] : null;
  }

  private onDown = (e: MouseEvent): void => {
    e.preventDefault();
    const c = this.cellAt(e);
    if (!c) return;
    const erase = e.button === 2;
    if (this.tool === 'picker') {
      this.color = parseInt(this.art[c[1] * this.w + c[0]], 16);
      this.setTool('brush');
      this.syncSwatches();
      return;
    }
    this.pushUndo();
    const col = erase ? 0 : this.color;
    if (this.tool === 'fill') {
      this.fill(c[0], c[1], col);
      this.redraw();
      return;
    }
    this.painting = erase ? 2 : 1;
    this.last = c;
    this.plot(c[0], c[1], col);
    this.redraw();
  };

  private onMove = (e: MouseEvent): void => {
    if (!this.painting) return;
    const c = this.cellAt(e);
    if (!c) return;
    const col = this.painting === 2 ? 0 : this.color;
    // Interpolate so fast strokes stay continuous.
    const [x0, y0] = this.last ?? c;
    const n = Math.max(Math.abs(c[0] - x0), Math.abs(c[1] - y0));
    for (let i = 0; i <= n; i++) this.plot(Math.round(x0 + ((c[0] - x0) * i) / (n || 1)), Math.round(y0 + ((c[1] - y0) * i) / (n || 1)), col);
    this.last = c;
    this.redraw();
  };

  private onUp = (): void => {
    this.painting = 0;
    this.last = null;
  };

  private plot(x: number, y: number, col: number): void {
    this.art[y * this.w + x] = col.toString(16);
  }

  private fill(x: number, y: number, col: number): void {
    const target = this.art[y * this.w + x];
    const next = col.toString(16);
    if (target === next) return;
    const stack = [x, y];
    while (stack.length) {
      const cy = stack.pop()!;
      const cx = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) continue;
      const i = cy * this.w + cx;
      if (this.art[i] !== target) continue;
      this.art[i] = next;
      stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
  }

  private pushUndo(): void {
    this.undo.push(this.art.join(''));
    if (this.undo.length > MAX_UNDO) this.undo.shift();
  }

  private popUndo(): void {
    const prev = this.undo.pop();
    if (prev === undefined) return;
    this.art = prev.split('');
    this.redraw();
  }

  private clearArt(): void {
    this.pushUndo();
    this.art = blankArt(this.w, this.h).split('');
    this.redraw();
  }

  private redraw(): void {
    for (const c of [this.view, this.preview]) {
      const g = c.getContext('2d');
      if (!g) continue;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          g.fillStyle = PAINT_PALETTE[parseInt(this.art[y * this.w + x], 16)];
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  }
}
