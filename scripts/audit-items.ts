/** Report items that cannot be obtained. Usage: npx tsx scripts/audit-items.ts */
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { unobtainableItems, obtainableItems } from '../src/data/obtainability';
import { TileRegistry } from '../src/world/TileRegistry';
import { newCharacter } from '../src/core/playerSave';
import { defaultAppearance } from '../src/entities/player/Appearance';

const { world } = generateWorldSync({ name: 'audit', seed: 'audit', width: 2200, height: 620 });
const tiles = new Set<number>();
const walls = new Set<number>();
for (const c of world.chunks) {
  c.fg.forEach((v) => tiles.add(v));
  c.wall.forEach((v) => walls.add(v));
}
// Tiles that appear through gameplay rather than generation.
for (const k of ['umbralite_ore', 'aetherium_ore', 'shardgrass', 'shardrock', 'starshard_ore', 'basalt']) tiles.add(TileRegistry.id(k));
// Walls created by the Unsealing.
walls.add(TileRegistry.wallId('shard_wall'));
const kit = newCharacter('x', defaultAppearance(), 'wanderer').inventory.main.filter(Boolean).map((s) => s!.id);
const src = { naturalTiles: tiles, naturalWalls: walls, startingKit: kit, extra: ['wood', 'seedling', 'mushroom', 'leafthatch'] };
const missing = unobtainableItems(src);
console.log(`obtainable: ${obtainableItems(src).obtainable.size}, unobtainable: ${missing.length}`);
console.log(missing.join('\n'));
