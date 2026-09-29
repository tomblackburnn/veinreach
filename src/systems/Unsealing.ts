import type { GameContext } from '../core/context';
import { T, TileRegistry } from '../world/TileRegistry';
import { Rng, hashString } from '../utils/random';
import { TREE_KIND } from '../generation/passes/vegetation';

/**
 * The Unsealing — the mid-game world transformation triggered when Obelisk
 * Prime is first destroyed. Deterministic from the world seed. Runs as a
 * generator so it can be spread over several frames.
 *
 *  - carves a diagonal "Shardblight" scar from the surface to the caverns
 *  - seeds Umbralite and Aetherium veins through the deep layers
 */
export function* unsealWorld(ctx: GameContext, seed: string): Generator<number> {
  const w = ctx.world;
  const L = w.layers;
  const rng = new Rng(hashString(seed + ':unseal'));
  const spawnX = Math.floor(w.width / 2);
  let x0 = spawnX;
  for (let i = 0; i < 20 && Math.abs(x0 - spawnX) < 120; i++) x0 = rng.int(Math.floor(w.width * 0.18), Math.floor(w.width * 0.82));
  const dir = rng.chance(0.5) ? 1 : -1;
  const shardWall = TileRegistry.wallId('shard_wall');
  const top = Math.max(0, L.surfaceY - 60);
  const bottom = L.cavernY + 40;
  // 1) The scar
  for (let y = top; y < bottom; y++) {
    const cx = x0 + ((y - top) * 0.45) * dir;
    const half = 26 + Math.sin(y * 0.05) * 6;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      if (!w.inBounds(x, y)) continue;
      const edge = Math.abs(x - cx) / half;
      if (edge > 0.85 && rng.next() < 0.5) continue;
      const id = w.getFg(x, y);
      if (id === T.meadowgrass || id === T.blightgrass) w.setFg(x, y, T.shardgrass, 0);
      else if (id === T.stone || id === T.blightrock || id === T.sandstone || id === T.ice) w.setFg(x, y, T.shardrock, 0);
      else if (id === T.loam && w.getFg(x, y - 1) === 0) w.setFg(x, y, T.shardgrass, 0);
      else if ((id === T.trunk || id === T.treetop) && w.getFrame(x, y) !== TREE_KIND.shard) w.setFg(x, y, id, TREE_KIND.shard);
      const wall = w.getWall(x, y);
      if (wall && TileRegistry.wall(wall).natural) w.setWall(x, y, shardWall);
    }
    if (y % 20 === 0) yield (y - top) / (bottom - top) * 0.5;
  }
  // 2) New ores
  const umbral = TileRegistry.id('umbralite_ore');
  const aether = TileRegistry.id('aetherium_ore');
  const hosts = new Set([T.stone, T.hushstone, T.shardrock, T.prismstone]);
  const place = (id: number, count: number, y0: number, y1: number) => {
    for (let i = 0; i < count; i++) {
      let x = rng.int(10, w.width - 10);
      let y = rng.int(y0, y1);
      const steps = rng.int(4, 9);
      for (let s = 0; s < steps; s++) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (hosts.has(w.getFg(x + dx, y + dy)) && rng.next() < 0.7) w.setFg(x + dx, y + dy, id, 0);
        x += rng.int(-1, 1);
        y += rng.int(-1, 1);
      }
    }
  };
  const scale = (w.width * w.height) / 1_000_000;
  place(umbral, Math.floor(160 * scale), L.cavernY, L.underworldY - 10);
  yield 0.75;
  place(aether, Math.floor(110 * scale), L.deepY, L.underworldY - 5);
  yield 1;
}
