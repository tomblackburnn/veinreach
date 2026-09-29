/** Helpers for authoring pixel art procedurally on offscreen canvases. */
export type Canvas2D = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas2D {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function ctx2d(c: Canvas2D): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.imageSmoothingEnabled = false;
  return g;
}

/** Thin wrapper offering pixel-art primitives. */
export class Pix {
  readonly canvas: Canvas2D;
  readonly g: CanvasRenderingContext2D;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.canvas = makeCanvas(w, h);
    this.g = ctx2d(this.canvas);
  }

  px(x: number, y: number, c: string): this {
    this.g.fillStyle = c;
    this.g.fillRect(x | 0, y | 0, 1, 1);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    this.g.fillStyle = c;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  /** Outline-only rectangle. */
  box(x: number, y: number, w: number, h: number, c: string): this {
    this.rect(x, y, w, 1, c).rect(x, y + h - 1, w, 1, c).rect(x, y, 1, h, c).rect(x + w - 1, y, 1, h, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        if (x * x + y * y <= r * r + r * 0.8) this.px(cx + x, cy + y, c);
      }
    }
    return this;
  }

  /**
   * Draw string art: each character maps to a palette colour, '.' or ' ' is transparent.
   */
  art(rows: string[], palette: Record<string, string>, ox = 0, oy = 0): this {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const col = palette[ch];
        if (col) this.px(ox + x, oy + y, col);
      }
    });
    return this;
  }
}

/** Build a sprite from string art. */
export function fromArt(rows: string[], palette: Record<string, string>): Canvas2D {
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w, rows.length);
  p.art(rows, palette);
  return p.canvas;
}
