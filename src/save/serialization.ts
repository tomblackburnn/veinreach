import type { World } from '../world/World';
import type { Chunk } from '../world/Chunk';
import type { ChunkRecord, ExploredRecord } from './types';
import { rleEncode, rleDecode, bytesToBase64, base64ToBytes } from '../utils/base64';
import { CHUNK_SIZE } from '../core/config';
import { TileRegistry } from '../world/TileRegistry';

const N = CHUNK_SIZE * CHUNK_SIZE;

const copyBuf = (a: ArrayBufferView): ArrayBuffer => {
  const b = new Uint8Array(a.byteLength);
  b.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  return b.buffer;
};

export function chunkKey(worldId: string, cx: number, cy: number): string {
  return `${worldId}:${cx}:${cy}`;
}

export function chunkToRecord(worldId: string, c: Chunk): ChunkRecord {
  return {
    key: chunkKey(worldId, c.cx, c.cy),
    worldId,
    cx: c.cx,
    cy: c.cy,
    fg: copyBuf(c.fg),
    wall: copyBuf(c.wall),
    liquid: copyBuf(c.liquid),
    liquidType: copyBuf(c.liquidType),
    frame: copyBuf(c.frame),
  };
}

/**
 * Apply a saved chunk over the regenerated baseline. Unknown tile ids (from
 * newer/corrupt saves) are replaced with air rather than crashing.
 */
export function applyChunkRecord(world: World, r: ChunkRecord): boolean {
  const c = world.getChunk(r.cx, r.cy);
  if (!c) return false;
  const ok = (b: unknown, bytes: number) => b instanceof ArrayBuffer && b.byteLength === bytes;
  if (!ok(r.fg, N * 2) || !ok(r.wall, N * 2) || !ok(r.liquid, N) || !ok(r.liquidType, N) || !ok(r.frame, N)) return false;
  const fg = new Uint16Array(r.fg);
  const wall = new Uint16Array(r.wall);
  const liquid = new Uint8Array(r.liquid);
  const lt = new Uint8Array(r.liquidType);
  const frame = new Uint8Array(r.frame);
  if (fg.length !== N || wall.length !== N || liquid.length !== N || lt.length !== N || frame.length !== N) return false;
  const maxTile = TileRegistry.tileCount;
  const maxWall = TileRegistry.walls.length;
  for (let i = 0; i < N; i++) {
    c.fg[i] = fg[i] < maxTile && TileRegistry.defs[fg[i]] ? fg[i] : 0;
    c.wall[i] = wall[i] < maxWall && TileRegistry.walls[wall[i]] ? wall[i] : 0;
    c.liquid[i] = liquid[i];
    c.liquidType[i] = lt[i] <= 2 ? lt[i] : 0;
    c.frame[i] = frame[i];
  }
  c.modified = true;
  c.saveDirty = false;
  c.renderDirty = true;
  return true;
}

export function exploredToRecord(worldId: string, c: Chunk): ExploredRecord {
  return { key: chunkKey(worldId, c.cx, c.cy), worldId, cx: c.cx, cy: c.cy, data: copyBuf(rleEncode(c.explored)) };
}

export function applyExplored(world: World, r: ExploredRecord): void {
  const c = world.getChunk(r.cx, r.cy);
  if (!c) return;
  c.explored.set(rleDecode(new Uint8Array(r.data), N));
  c.exploredDirty = false;
}

/** JSON-safe encoding for export files. */
export interface ExportedChunk {
  cx: number;
  cy: number;
  fg: string;
  wall: string;
  liquid: string;
  liquidType: string;
  frame: string;
}

const enc = (buf: ArrayBuffer) => bytesToBase64(rleEncode(new Uint8Array(buf)));

export function encodeChunkRecord(r: ChunkRecord): ExportedChunk {
  return { cx: r.cx, cy: r.cy, fg: enc(r.fg), wall: enc(r.wall), liquid: enc(r.liquid), liquidType: enc(r.liquidType), frame: enc(r.frame) };
}

export function decodeChunkRecord(worldId: string, e: ExportedChunk): ChunkRecord {
  const dec = (s: string, bytes: number) => rleDecode(base64ToBytes(s), bytes).buffer as ArrayBuffer;
  return {
    key: chunkKey(worldId, e.cx, e.cy),
    worldId,
    cx: e.cx,
    cy: e.cy,
    fg: dec(e.fg, N * 2),
    wall: dec(e.wall, N * 2),
    liquid: dec(e.liquid, N),
    liquidType: dec(e.liquidType, N),
    frame: dec(e.frame, N),
  };
}
