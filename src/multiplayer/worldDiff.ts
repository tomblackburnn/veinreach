import type { World } from '../world/World';
import type { GameContext } from '../core/context';
import type { LoadedWorld } from '../save/SaveManager';
import type { ChunkRecord } from '../save/types';
import { unsealWorld } from '../systems/Unsealing';
import { generateWorld, runSliced } from '../generation/WorldGenerator';
import { CHUNK_SIZE } from '../core/config';
import { TileRegistry } from '../world/TileRegistry';

const N = CHUNK_SIZE * CHUNK_SIZE;

/**
 * Re-run the deterministic Unsealing on a freshly generated world. Online
 * clients don't send the Unsealing's terrain changes (every client makes them
 * itself), so anyone joining a world that is already unsealed replays it
 * before applying other players' edits.
 */
export function replayUnsealing(world: World, seed: string): void {
  const was = world.generating;
  world.generating = true;
  const gen = unsealWorld({ world } as GameContext, seed);
  while (!gen.next().done) {
    /* run to completion */
  }
  world.generating = was;
  world.recomputeSkyTop();
}

/**
 * Compare a saved world with a fresh generation from the same seed and list
 * every tile and liquid that differs, so the world can be recreated online.
 */
export async function diffSavedWorld(loaded: LoadedWorld, onProgress: (stage: string, p: number) => void): Promise<{ tiles: number[]; liquids: number[] }> {
  const m = loaded.record.meta;
  const gen = await runSliced(generateWorld({ name: m.name, seed: m.seed, width: m.width, height: m.height }), (p) => onProgress(p.stage, p.progress * 0.9));
  const w = gen.world;
  if (loaded.record.state.flags.includes('unsealed')) replayUnsealing(w, m.seed);
  onProgress('Finding your changes', 0.92);
  const tiles: number[] = [];
  const liquids: number[] = [];
  const maxTile = TileRegistry.tileCount;
  const maxWall = TileRegistry.walls.length;
  for (const r of loaded.chunks) {
    const c = w.getChunk(r.cx, r.cy);
    if (!c || !validRecord(r)) continue;
    const fg = new Uint16Array(r.fg);
    const wall = new Uint16Array(r.wall);
    const frame = new Uint8Array(r.frame);
    const liq = new Uint8Array(r.liquid);
    const lt = new Uint8Array(r.liquidType);
    for (let i = 0; i < N; i++) {
      const x = r.cx * CHUNK_SIZE + (i % CHUNK_SIZE);
      const y = r.cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE);
      if (fg[i] !== c.fg[i] || wall[i] !== c.wall[i] || frame[i] !== c.frame[i]) {
        const f = fg[i] < maxTile && TileRegistry.defs[fg[i]] ? fg[i] : 0;
        tiles.push(x, y, f, frame[i], wall[i] < maxWall ? wall[i] : 0);
      }
      if (liq[i] !== c.liquid[i] || (liq[i] > 0 && lt[i] !== c.liquidType[i])) liquids.push(x, y, liq[i], lt[i] <= 2 ? lt[i] : 0);
    }
  }
  return { tiles, liquids };
}

function validRecord(r: ChunkRecord): boolean {
  const ok = (b: unknown, bytes: number) => b instanceof ArrayBuffer && b.byteLength === bytes;
  return ok(r.fg, N * 2) && ok(r.wall, N * 2) && ok(r.frame, N) && ok(r.liquid, N) && ok(r.liquidType, N);
}
