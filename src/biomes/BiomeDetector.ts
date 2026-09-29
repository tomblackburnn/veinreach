import { BIOMES, type BiomeKey } from '../data/biomes';
import { TileRegistry } from '../world/TileRegistry';
import type { World } from '../world/World';

interface DetectRule {
  key: BiomeKey;
  tiles: Set<number>;
  walls: Set<number>;
  threshold: number;
  priority: number;
}

let rules: DetectRule[] | null = null;
function getRules(): DetectRule[] {
  if (rules) return rules;
  rules = Object.values(BIOMES)
    .filter((b) => b.detectThreshold > 0)
    .map((b) => ({
      key: b.key,
      tiles: new Set(b.detectTiles.map((k) => TileRegistry.id(k))),
      walls: new Set((b.detectWalls ?? []).map((k) => TileRegistry.wallId(k))),
      threshold: b.detectThreshold,
      priority: b.priority,
    }))
    .sort((a, b) => b.priority - a.priority);
  return rules;
}

/** Surface biome index stored per column by the generator. */
export const SURFACE_BIOME_ORDER: BiomeKey[] = ['meadow', 'dunes', 'taiga', 'blightmire', 'shore'];

/**
 * Determine the biome around a tile by sampling nearby tiles every other cell
 * in a ~50×36 window. Cheap enough to call a few times per second.
 */
export function detectBiome(world: World, x: number, y: number): BiomeKey {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const zone = world.zoneAt(ty);
  const rs = getRules();
  const counts = new Array<number>(rs.length).fill(0);
  for (let yy = ty - 18; yy <= ty + 18; yy += 2) {
    for (let xx = tx - 25; xx <= tx + 25; xx += 2) {
      if (!world.inBounds(xx, yy)) continue;
      const fg = world.getFg(xx, yy);
      const wall = world.getWall(xx, yy);
      for (let i = 0; i < rs.length; i++) {
        if (rs[i].tiles.has(fg) || rs[i].walls.has(wall)) counts[i] += 4;
      }
    }
  }
  for (let i = 0; i < rs.length; i++) {
    if (counts[i] >= rs[i].threshold) return rs[i].key;
  }
  if (zone === 'underworld') return 'emberdeep';
  if (zone === 'sky') return 'skyisles';
  if (zone === 'surface') {
    const col = world.biomeColumn[Math.max(0, Math.min(world.width - 1, tx))];
    return SURFACE_BIOME_ORDER[col] ?? 'meadow';
  }
  return 'underground';
}
