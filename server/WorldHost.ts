import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { WORLD_SIZES, type WorldSizeKey, DAY_TICKS } from '../src/core/config';
import type { World } from '../src/world/World';
import { chunkToRecord, encodeChunkRecord, decodeChunkRecord, applyChunkRecord, type ExportedChunk } from '../src/save/serialization';
import type { ChestData, PaintingData } from '../src/world/WorldState';
import { sanitizePainting, paintingFits, isPainted, isCanvasTile } from '../src/world/paintings';
import { TileRegistry } from '../src/world/TileRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import type { Slot } from '../src/items/ItemStack';

interface SaveFile {
  format: 'veinreach-server-world';
  name: string;
  seed: string;
  size: WorldSizeKey;
  time: number;
  day: number;
  flags: string[];
  chests: ChestData[];
  paintings?: PaintingData[];
  chunks: ExportedChunk[];
}

/**
 * Server-side authoritative copy of a world: regenerated from its seed at
 * startup and patched with saved modifications. Validates client edits.
 */
export class WorldHost {
  world!: World;
  spawnX = 0;
  spawnY = 0;
  time = DAY_TICKS * (7.5 / 24);
  day = 1;
  flags = new Set<string>();
  chests = new Map<string, ChestData>();
  paintings = new Map<string, PaintingData>();
  dirty = false;

  constructor(
    readonly file: string,
    readonly name: string,
    readonly seed: string,
    readonly size: WorldSizeKey,
  ) {}

  load(): void {
    let save: SaveFile | null = null;
    if (existsSync(this.file)) {
      try {
        save = JSON.parse(readFileSync(this.file, 'utf8')) as SaveFile;
        if (save.format !== 'veinreach-server-world') throw new Error('bad format');
      } catch (e) {
        console.error(`[server] could not read ${this.file}; starting fresh`, e);
        save = null;
      }
    }
    const seed = save?.seed ?? this.seed;
    const size = save?.size ?? this.size;
    const { width, height } = WORLD_SIZES[size];
    const t0 = Date.now();
    const gen = generateWorldSync({ name: save?.name ?? this.name, seed, width, height });
    this.world = gen.world;
    this.spawnX = gen.spawnX;
    this.spawnY = gen.spawnY;
    for (const c of this.world.chests.values()) this.chests.set(`${c.x},${c.y}`, c);
    if (save) {
      this.world.generating = true;
      let n = 0;
      for (const c of save.chunks) if (applyChunkRecord(this.world, decodeChunkRecord('srv', c))) n++;
      this.world.generating = false;
      this.time = save.time;
      this.day = save.day;
      this.flags = new Set(save.flags);
      this.chests.clear();
      for (const c of save.chests) this.chests.set(`${c.x},${c.y}`, c);
      for (const raw of save.paintings ?? []) {
        const p = sanitizePainting(raw);
        if (p && paintingFits(this.world, p)) this.paintings.set(`${p.x},${p.y}`, p);
      }
      console.log(`[server] loaded ${n} modified chunks`);
    }
    (this as { seed: string }).seed = seed;
    (this as { size: WorldSizeKey }).size = size;
    console.log(`[server] world "${this.name}" (${size}, seed ${seed}) ready in ${Date.now() - t0}ms`);
  }

  modifiedChunks(): ExportedChunk[] {
    return this.world.chunks.filter((c) => c.modified).map((c) => encodeChunkRecord(chunkToRecord('srv', c)));
  }

  save(): void {
    const data: SaveFile = {
      format: 'veinreach-server-world',
      name: this.name,
      seed: this.seed,
      size: this.size,
      time: this.time,
      day: this.day,
      flags: [...this.flags],
      chests: [...this.chests.values()],
      paintings: [...this.paintings.values()],
      chunks: this.modifiedChunks(),
    };
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, this.file);
    this.dirty = false;
  }

  tick(ms: number): boolean {
    this.time += (ms / 1000) * 60;
    if (this.time >= DAY_TICKS) {
      this.time -= DAY_TICKS;
      this.day++;
      return true;
    }
    return false;
  }

  /**
   * Validate and apply a batch of [x,y,fg,frame,wall] edits from a player at
   * (px,py) tile position. Returns the accepted subset.
   */
  applyTiles(changes: unknown, px: number, py: number, maxDist = 48): number[] {
    if (!Array.isArray(changes) || changes.length % 5 !== 0 || changes.length > 5 * 2500) return [];
    const accepted: number[] = [];
    const w = this.world;
    const maxTile = TileRegistry.tileCount;
    const maxWall = TileRegistry.walls.length;
    for (let i = 0; i < changes.length; i += 5) {
      const [x, y, fg, frame, wall] = changes.slice(i, i + 5) as number[];
      if (![x, y, fg, frame, wall].every((v) => Number.isInteger(v))) continue;
      if (!w.inBounds(x, y)) continue;
      if (Math.abs(x - px) > maxDist || Math.abs(y - py) > maxDist) continue;
      if (fg < 0 || fg >= maxTile || !TileRegistry.defs[fg] || wall < 0 || wall >= maxWall || frame < 0 || frame > 255) continue;
      const before = w.getFg(x, y);
      w.setFg(x, y, fg, frame);
      w.setWall(x, y, wall);
      if (before === TileRegistry.id('chest') && fg !== before) this.chests.delete(`${x},${y}`);
      if (isCanvasTile(before) && fg !== before) this.paintings.delete(`${x},${y}`);
      accepted.push(x, y, fg, frame, wall);
    }
    if (accepted.length) this.dirty = true;
    return accepted;
  }

  /** Validate a painting from a player standing at tile (px,py). Returns the stored copy or null. */
  validPainting(raw: unknown, px: number, py: number, maxDist = 48): PaintingData | null {
    const p = sanitizePainting(raw);
    if (!p || !paintingFits(this.world, p)) return null;
    if (Math.abs(p.x - px) > maxDist || Math.abs(p.y - py) > maxDist) return null;
    const key = `${p.x},${p.y}`;
    if (isPainted(p)) this.paintings.set(key, p);
    else this.paintings.delete(key);
    this.dirty = true;
    return p;
  }

  validChest(raw: unknown): ChestData | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (!Number.isInteger(c.x) || !Number.isInteger(c.y) || !Array.isArray(c.items)) return null;
    const x = c.x as number;
    const y = c.y as number;
    if (this.world.getFg(x, y) !== TileRegistry.id('chest')) return null;
    const items: Slot[] = new Array(40).fill(null);
    (c.items as unknown[]).slice(0, 40).forEach((s, i) => {
      const st = s as { id?: unknown; count?: unknown } | null;
      if (st && typeof st.id === 'string' && ItemRegistry.has(st.id) && typeof st.count === 'number' && st.count > 0) items[i] = { id: st.id, count: Math.min(Math.floor(st.count), ItemRegistry.get(st.id).maxStack) };
    });
    const chest: ChestData = { x, y, items, name: typeof c.name === 'string' ? c.name.slice(0, 24) : undefined };
    this.chests.set(`${x},${y}`, chest);
    this.dirty = true;
    return chest;
  }
}
