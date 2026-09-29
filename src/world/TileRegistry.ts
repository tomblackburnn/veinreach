import { TILE_DEFS } from '../data/tiles';
import { WALL_DEFS } from '../data/walls';
import type { TileDef, WallDef } from './tileTypes';

/**
 * Fast lookup tables derived from tile/wall data. Hot paths (collision,
 * lighting) use the typed arrays rather than touching TileDef objects.
 */
class TileRegistryImpl {
  readonly defs: TileDef[] = [];
  readonly walls: WallDef[] = [];
  private byKey = new Map<string, TileDef>();
  private wallByKey = new Map<string, WallDef>();

  solid = new Uint8Array(0);
  platform = new Uint8Array(0);
  opaque = new Uint8Array(0);
  cuttable = new Uint8Array(0);
  lightR = new Float32Array(0);
  lightG = new Float32Array(0);
  lightB = new Float32Array(0);
  emits = new Uint8Array(0);

  constructor() {
    this.load(TILE_DEFS, WALL_DEFS);
  }

  load(tiles: TileDef[], walls: WallDef[]): void {
    const maxId = tiles.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    this.defs.length = 0;
    this.byKey.clear();
    this.solid = new Uint8Array(maxId);
    this.platform = new Uint8Array(maxId);
    this.opaque = new Uint8Array(maxId);
    this.cuttable = new Uint8Array(maxId);
    this.lightR = new Float32Array(maxId);
    this.lightG = new Float32Array(maxId);
    this.lightB = new Float32Array(maxId);
    this.emits = new Uint8Array(maxId);
    for (const t of tiles) {
      if (this.defs[t.id]) console.warn(`[TileRegistry] duplicate tile id ${t.id} (${t.key})`);
      if (this.byKey.has(t.key)) console.warn(`[TileRegistry] duplicate tile key ${t.key}`);
      this.defs[t.id] = t;
      this.byKey.set(t.key, t);
      this.solid[t.id] = t.solid ? 1 : 0;
      this.platform[t.id] = t.platform ? 1 : 0;
      this.opaque[t.id] = t.solid && !t.transparent ? 1 : 0;
      this.cuttable[t.id] = t.cuttable ? 1 : 0;
      if (t.light) {
        this.emits[t.id] = 1;
        [this.lightR[t.id], this.lightG[t.id], this.lightB[t.id]] = t.light;
      }
    }
    this.walls.length = 0;
    this.wallByKey.clear();
    for (const w of walls) {
      this.walls[w.id] = w;
      this.wallByKey.set(w.key, w);
    }
  }

  get(id: number): TileDef {
    return this.defs[id] ?? this.defs[0];
  }

  /** Numeric id for a tile key. Throws on unknown keys — content bugs should surface early. */
  id(key: string): number {
    const def = this.byKey.get(key);
    if (!def) throw new Error(`Unknown tile key "${key}"`);
    return def.id;
  }

  tryId(key: string): number | undefined {
    return this.byKey.get(key)?.id;
  }

  byKeyOrUndefined(key: string): TileDef | undefined {
    return this.byKey.get(key);
  }

  wall(id: number): WallDef {
    return this.walls[id] ?? this.walls[0];
  }

  wallId(key: string): number {
    const def = this.wallByKey.get(key);
    if (!def) throw new Error(`Unknown wall key "${key}"`);
    return def.id;
  }

  tryWallId(key: string): number | undefined {
    return this.wallByKey.get(key)?.id;
  }

  get tileCount(): number {
    return this.defs.length;
  }
}

export const TileRegistry = new TileRegistryImpl();

/** Frequently-used tile ids, resolved once. */
export const T = {
  air: 0,
  loam: TileRegistry.id('loam'),
  meadowgrass: TileRegistry.id('meadowgrass'),
  stone: TileRegistry.id('stone'),
  sand: TileRegistry.id('sand'),
  sandstone: TileRegistry.id('sandstone'),
  snow: TileRegistry.id('snow'),
  ice: TileRegistry.id('ice'),
  clay: TileRegistry.id('clay'),
  mud: TileRegistry.id('mud'),
  lumenmoss: TileRegistry.id('lumenmoss'),
  blightgrass: TileRegistry.id('blightgrass'),
  blightrock: TileRegistry.id('blightrock'),
  hushstone: TileRegistry.id('hushstone'),
  ash: TileRegistry.id('ash'),
  basalt: TileRegistry.id('basalt'),
  prismstone: TileRegistry.id('prismstone'),
  trunk: TileRegistry.id('trunk'),
  treetop: TileRegistry.id('treetop'),
  sapling: TileRegistry.id('sapling'),
  doorClosed: TileRegistry.id('door_closed'),
  doorOpen: TileRegistry.id('door_open'),
  chest: TileRegistry.id('chest'),
  torch: TileRegistry.id('torch'),
  platform: TileRegistry.id('platform'),
  pot: TileRegistry.id('pot'),
  shardgrass: TileRegistry.id('shardgrass'),
  shardrock: TileRegistry.id('shardrock'),
  bed: TileRegistry.id('bed'),
  rope: TileRegistry.id('rope'),
  cactus: TileRegistry.id('cactus'),
  vine: TileRegistry.id('vine'),
} as const;

export const LIQUID = { none: 0, water: 1, lava: 2 } as const;
export type LiquidKind = (typeof LIQUID)[keyof typeof LIQUID];
