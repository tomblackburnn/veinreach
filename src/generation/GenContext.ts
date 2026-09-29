import { Noise2D } from '../utils/noise';
import { Rng, hashString } from '../utils/random';
import { World } from '../world/World';
import { T, TileRegistry, LIQUID } from '../world/TileRegistry';
import { placeObjectRaw } from '../world/objects';
import type { ChestData, StructureInfo } from '../world/WorldState';
import { rollLootTable } from '../systems/LootSystem';

export interface GenOptions {
  name: string;
  seed: string;
  width: number;
  height: number;
}

/** Shared state and helpers handed to every generation pass. */
export class GenContext {
  readonly world: World;
  readonly rng: Rng;
  readonly seedNum: number;
  readonly W: number;
  readonly H: number;
  readonly noise: Noise2D;
  readonly noise2: Noise2D;
  readonly noise3: Noise2D;
  readonly structures: StructureInfo[] = [];
  /** Cells claimed by structures — later passes avoid them. */
  readonly protectedMask: Uint8Array;
  spawnX = 0;
  spawnY = 0;
  keepSide: -1 | 1 = 1;
  seaLevel = 0;
  sporeglowCenters: [number, number][] = [];
  hollowCenters: [number, number][] = [];

  constructor(readonly opts: GenOptions) {
    this.W = opts.width;
    this.H = opts.height;
    this.seedNum = hashString(opts.seed);
    this.rng = new Rng(this.seedNum);
    this.world = new World(this.W, this.H);
    this.world.generating = true;
    this.noise = new Noise2D(this.seedNum);
    this.noise2 = new Noise2D(this.seedNum ^ 0x5bd1e995);
    this.noise3 = new Noise2D(this.seedNum ^ 0x27d4eb2f);
    this.protectedMask = new Uint8Array(this.W * this.H);
  }

  /** Independent deterministic RNG per pass so passes don't perturb each other. */
  passRng(name: string): Rng {
    return new Rng(this.seedNum ^ hashString(name));
  }

  get L() {
    return this.world.layers;
  }

  inside(x: number, y: number, margin = 0): boolean {
    return x >= margin && y >= margin && x < this.W - margin && y < this.H - margin;
  }

  isProtected(x: number, y: number): boolean {
    return this.inside(x, y) && this.protectedMask[y * this.W + x] === 1;
  }

  protect(x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) if (this.inside(xx, yy)) this.protectedMask[yy * this.W + xx] = 1;
    }
  }

  fg(x: number, y: number): number {
    return this.world.getFg(x, y);
  }

  set(x: number, y: number, id: number): void {
    if (this.inside(x, y)) this.world.setFg(x, y, id, 0);
  }

  wall(x: number, y: number, id: number): void {
    if (this.inside(x, y)) this.world.setWall(x, y, id);
  }

  solid(x: number, y: number): boolean {
    return this.world.isSolid(x, y);
  }

  air(x: number, y: number): boolean {
    return this.inside(x, y) && this.world.getFg(x, y) === 0;
  }

  /** Carve a filled circle of air. Respects protected cells. */
  carve(cx: number, cy: number, r: number, removeWalls = false): void {
    const r2 = r * r;
    const ir = Math.ceil(r);
    for (let y = -ir; y <= ir; y++) {
      for (let x = -ir; x <= ir; x++) {
        if (x * x + y * y > r2) continue;
        const px = Math.round(cx + x);
        const py = Math.round(cy + y);
        if (!this.inside(px, py, 1) || this.isProtected(px, py)) continue;
        this.world.setFg(px, py, 0, 0);
        if (removeWalls) this.world.setWall(px, py, 0);
      }
    }
  }

  /** Fill circle, optionally only replacing given host tiles. */
  blob(cx: number, cy: number, r: number, id: number, hosts?: Set<number>): void {
    const r2 = r * r;
    const ir = Math.ceil(r);
    for (let y = -ir; y <= ir; y++) {
      for (let x = -ir; x <= ir; x++) {
        if (x * x + y * y > r2) continue;
        const px = Math.round(cx + x);
        const py = Math.round(cy + y);
        if (!this.inside(px, py, 1) || this.isProtected(px, py)) continue;
        const cur = this.world.getFg(px, py);
        if (hosts ? hosts.has(cur) : cur !== 0) this.world.setFg(px, py, id, 0);
      }
    }
  }

  /** Random-walk "worm" tunnel. */
  worm(x: number, y: number, angle: number, length: number, radius: number, rng: Rng, opts: { wander?: number; down?: number; removeWalls?: boolean } = {}): void {
    const wander = opts.wander ?? 0.35;
    const down = opts.down ?? 0;
    let a = angle;
    let r = radius;
    for (let i = 0; i < length; i++) {
      this.carve(x, y, r, opts.removeWalls);
      a += rng.range(-wander, wander);
      a += (Math.PI / 2 - a) * down;
      x += Math.cos(a) * Math.max(1, r * 0.6);
      y += Math.sin(a) * Math.max(1, r * 0.6);
      r = Math.max(1.2, Math.min(radius * 1.6, r + rng.range(-0.3, 0.3)));
      if (!this.inside(x, y, 4) || y > this.L.underworldY - 4) break;
    }
  }

  placeObject(x: number, y: number, key: string): void {
    placeObjectRaw(this.world, x, y, TileRegistry.id(key));
  }

  /** Place a chest with rolled loot. (x,y) is top-left; the chest is 2×2. */
  addChest(x: number, y: number, lootTable: string, rng: Rng, name?: string): void {
    placeObjectRaw(this.world, x, y, T.chest);
    const items = new Array(40).fill(null);
    const rolled = rollLootTable(lootTable, rng);
    rolled.slice(0, 40).forEach((s, i) => (items[i] = s));
    const chest: ChestData = { x, y, items, name };
    this.world.chests.set(this.world.chestKey(x, y), chest);
  }

  /** Find the first solid tile going down from y. Returns H if none. */
  groundBelow(x: number, y: number): number {
    let yy = y;
    while (yy < this.H - 1 && !this.world.isSolid(x, yy)) yy++;
    return yy;
  }

  addStructure(kind: string, name: string, x: number, y: number, w: number, h: number): void {
    this.structures.push({ kind, name, x, y, w, h, discovered: false });
  }

  /**
   * Flood a basin with liquid starting at (x,y): drop to the floor, then fill
   * layer by layer upward while the layer stays enclosed.
   */
  fillBasin(x: number, y: number, maxLayers: number, type: number = LIQUID.water): number {
    let fy = y;
    while (fy < this.H - 2 && !this.solid(x, fy + 1)) fy++;
    let filled = 0;
    for (let layer = 0; layer < maxLayers; layer++) {
      const row = fy - layer;
      if (row < 2 || this.solid(x, row)) break;
      let l = x;
      let r = x;
      let leaked = false;
      while (!this.solid(l - 1, row)) {
        l--;
        if (x - l > 60 || !this.solid(l, row + 1) && this.world.getLiquid(l, row + 1) < 255) {
          leaked = true;
          break;
        }
      }
      if (!leaked) {
        while (!this.solid(r + 1, row)) {
          r++;
          if (r - x > 60 || !this.solid(r, row + 1) && this.world.getLiquid(r, row + 1) < 255) {
            leaked = true;
            break;
          }
        }
      }
      if (leaked) break;
      for (let xx = l; xx <= r; xx++) {
        if (this.isProtected(xx, row)) continue;
        this.world.setLiquid(xx, row, 255, type);
        filled++;
      }
    }
    return filled;
  }
}

export const tileSet = (...keys: string[]): Set<number> => new Set(keys.map((k) => TileRegistry.id(k)));
