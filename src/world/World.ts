import { CHUNK_SIZE } from '../core/config';
import { Chunk } from './Chunk';
import { TileRegistry } from './TileRegistry';
import type { ChestData, PaintingData, StructureInfo } from './WorldState';

const SHIFT = Math.log2(CHUNK_SIZE) | 0;
const MASK = CHUNK_SIZE - 1;

export type TileLayer = 'fg' | 'wall' | 'liquid';
export type TileChangeListener = (x: number, y: number, layer: TileLayer) => void;

export interface WorldLayers {
  /** Top of the underground (dirt→stone transition zone). */
  surfaceY: number;
  undergroundY: number;
  cavernY: number;
  deepY: number;
  underworldY: number;
}

/**
 * The tile grid. Tile data for the whole map is resident (seed-regenerated on
 * load and patched with saved chunk modifications); the ChunkManager decides
 * which chunks are *active* for rendering and simulation.
 */
export class World {
  readonly chunksX: number;
  readonly chunksY: number;
  readonly chunks: Chunk[];
  /** First opaque tile per column — used for sunlight. */
  readonly skyTop: Int16Array;
  /** Generated surface height per column (static reference used by biomes/spawning). */
  readonly surface: Int16Array;
  /** Surface biome index per column (see data/biomes). */
  readonly biomeColumn: Uint8Array;
  layers: WorldLayers;

  readonly chests = new Map<string, ChestData>();
  /** Painted canvases keyed by object origin ("x,y"). Blank canvases have no entry. */
  readonly paintings = new Map<string, PaintingData>();
  structures: StructureInfo[] = [];

  /** While true, edits don't flag chunks modified or fire listeners. */
  generating = true;
  private listeners: TileChangeListener[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.chunksX = Math.ceil(width / CHUNK_SIZE);
    this.chunksY = Math.ceil(height / CHUNK_SIZE);
    this.chunks = [];
    for (let cy = 0; cy < this.chunksY; cy++) {
      for (let cx = 0; cx < this.chunksX; cx++) this.chunks.push(new Chunk(cx, cy));
    }
    this.skyTop = new Int16Array(width);
    this.surface = new Int16Array(width);
    this.biomeColumn = new Uint8Array(width);
    const s = Math.floor(height * 0.24);
    this.layers = {
      surfaceY: s,
      undergroundY: s + 22,
      cavernY: Math.floor(height * 0.42),
      deepY: Math.floor(height * 0.62),
      underworldY: height - Math.max(70, Math.floor(height * 0.14)),
    };
  }

  onChange(fn: TileChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  chunkAt(x: number, y: number): Chunk | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.chunks[(y >> SHIFT) * this.chunksX + (x >> SHIFT)];
  }

  getChunk(cx: number, cy: number): Chunk | undefined {
    if (cx < 0 || cy < 0 || cx >= this.chunksX || cy >= this.chunksY) return undefined;
    return this.chunks[cy * this.chunksX + cx];
  }

  private idx(x: number, y: number): number {
    return ((y & MASK) << SHIFT) | (x & MASK);
  }

  getFg(x: number, y: number): number {
    const c = this.chunkAt(x, y);
    return c ? c.fg[this.idx(x, y)] : 0;
  }

  getWall(x: number, y: number): number {
    const c = this.chunkAt(x, y);
    return c ? c.wall[this.idx(x, y)] : 0;
  }

  getFrame(x: number, y: number): number {
    const c = this.chunkAt(x, y);
    return c ? c.frame[this.idx(x, y)] : 0;
  }

  getLiquid(x: number, y: number): number {
    const c = this.chunkAt(x, y);
    return c ? c.liquid[this.idx(x, y)] : 0;
  }

  getLiquidType(x: number, y: number): number {
    const c = this.chunkAt(x, y);
    return c ? c.liquidType[this.idx(x, y)] : 0;
  }

  isExplored(x: number, y: number): boolean {
    const c = this.chunkAt(x, y);
    return c ? c.explored[this.idx(x, y)] === 1 : false;
  }

  /** Solid for collision. Out-of-bounds counts as solid (world boundary). */
  isSolid(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return TileRegistry.solid[this.getFg(x, y)] === 1;
  }

  isPlatform(x: number, y: number): boolean {
    return TileRegistry.platform[this.getFg(x, y)] === 1;
  }

  isEmpty(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.getFg(x, y) === 0;
  }

  setFg(x: number, y: number, id: number, frame = 0): void {
    const c = this.chunkAt(x, y);
    if (!c) return;
    const i = this.idx(x, y);
    if (c.fg[i] === id && c.frame[i] === frame) return;
    c.fg[i] = id;
    c.frame[i] = frame;
    this.touch(c, x, y, 'fg');
    // Generation recomputes all columns once at the end.
    if (!this.generating) this.updateSkyTop(x);
  }

  setFrame(x: number, y: number, frame: number): void {
    const c = this.chunkAt(x, y);
    if (!c) return;
    c.frame[this.idx(x, y)] = frame;
    this.touch(c, x, y, 'fg');
  }

  setWall(x: number, y: number, id: number): void {
    const c = this.chunkAt(x, y);
    if (!c) return;
    const i = this.idx(x, y);
    if (c.wall[i] === id) return;
    c.wall[i] = id;
    this.touch(c, x, y, 'wall');
  }

  setLiquid(x: number, y: number, amount: number, type: number): void {
    const c = this.chunkAt(x, y);
    if (!c) return;
    const i = this.idx(x, y);
    const a = amount <= 0 ? 0 : amount > 255 ? 255 : amount | 0;
    const t = a === 0 ? 0 : type;
    if (c.liquid[i] === a && c.liquidType[i] === t) return;
    c.liquid[i] = a;
    c.liquidType[i] = t;
    if (!this.generating) {
      c.modified = true;
      c.saveDirty = true;
      c.renderDirty = true;
      for (const l of this.listeners) l(x, y, 'liquid');
    }
  }

  markExplored(x: number, y: number): boolean {
    const c = this.chunkAt(x, y);
    if (!c) return false;
    const i = this.idx(x, y);
    if (c.explored[i]) return false;
    c.explored[i] = 1;
    c.exploredDirty = true;
    return true;
  }

  private touch(c: Chunk, x: number, y: number, layer: TileLayer): void {
    c.renderDirty = true;
    // Edge tiles affect neighbour chunk edge rendering.
    const lx = x & MASK;
    const ly = y & MASK;
    if (lx === 0) this.markRenderDirty(x - 1, y);
    if (lx === MASK) this.markRenderDirty(x + 1, y);
    if (ly === 0) this.markRenderDirty(x, y - 1);
    if (ly === MASK) this.markRenderDirty(x, y + 1);
    if (this.generating) return;
    c.modified = true;
    c.saveDirty = true;
    for (const l of this.listeners) l(x, y, layer);
  }

  private markRenderDirty(x: number, y: number): void {
    const c = this.chunkAt(x, y);
    if (c) c.renderDirty = true;
  }

  updateSkyTop(x: number): void {
    if (x < 0 || x >= this.width) return;
    let y = 0;
    while (y < this.height && TileRegistry.skyBlock[this.getFg(x, y)] !== 1) y++;
    this.skyTop[x] = y;
  }

  recomputeSkyTop(): void {
    for (let x = 0; x < this.width; x++) this.updateSkyTop(x);
  }

  /** Origin (top-left) of a multi-tile object occupying (x,y). */
  objectOrigin(x: number, y: number): [number, number] {
    const def = TileRegistry.get(this.getFg(x, y));
    if (!def.size) return [x, y];
    const f = this.getFrame(x, y);
    return [x - (f & 15), y - (f >> 4)];
  }

  chestKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  getPaintingAt(x: number, y: number): PaintingData | undefined {
    const [ox, oy] = this.objectOrigin(x, y);
    return this.paintings.get(this.chestKey(ox, oy));
  }

  /** Force a redraw of a rectangle of tiles without counting it as a world edit. */
  invalidateRender(x: number, y: number, w = 1, h = 1): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.markRenderDirty(xx, yy);
  }

  getChestAt(x: number, y: number): ChestData | undefined {
    const [ox, oy] = this.objectOrigin(x, y);
    return this.chests.get(this.chestKey(ox, oy));
  }

  /** Depth zone name for a tile row. */
  zoneAt(y: number): 'sky' | 'surface' | 'underground' | 'cavern' | 'deep' | 'underworld' {
    const L = this.layers;
    if (y < L.surfaceY - 60) return 'sky';
    if (y < L.undergroundY) return 'surface';
    if (y < L.cavernY) return 'underground';
    if (y < L.deepY) return 'cavern';
    if (y < L.underworldY) return 'deep';
    return 'underworld';
  }

  modifiedChunks(): Chunk[] {
    return this.chunks.filter((c) => c.modified);
  }
}
