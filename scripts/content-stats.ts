/** Print content statistics (used to keep docs honest). */
import { TILE_DEFS } from '../src/data/tiles';
import { WALL_DEFS } from '../src/data/walls';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { RecipeRegistry } from '../src/crafting/RecipeRegistry';
import { ENEMIES } from '../src/data/enemies';
import { BOSSES } from '../src/data/bosses';
import { NPCS } from '../src/data/npcs';
import { BIOMES } from '../src/data/biomes';
import { BUFFS } from '../src/data/buffs';
import { PROJECTILES } from '../src/data/projectiles';
import { LOOT_TABLES } from '../src/data/lootTables';
import { WORLD_EVENTS } from '../src/systems/WorldEventSystem';

const items = ItemRegistry.all();
const by = (f: (i: (typeof items)[number]) => boolean) => items.filter(f).length;
console.log(JSON.stringify({
  tiles: TILE_DEFS.length - 1,
  walls: WALL_DEFS.length - 1,
  items: items.length,
  weapons: by((i) => !!i.weapon && i.category !== 'tool'),
  melee: by((i) => i.category === 'melee'),
  ranged: by((i) => i.category === 'ranged'),
  magic: by((i) => i.category === 'magic'),
  summon: by((i) => i.category === 'summon'),
  tools: by((i) => i.category === 'tool' || i.category === 'utility'),
  armorPieces: by((i) => !!i.armor),
  armorSets: new Set(items.filter((i) => i.armor).map((i) => i.armor!.set)).size,
  accessories: by((i) => i.category === 'accessory'),
  consumables: by((i) => i.category === 'consumable'),
  ammo: by((i) => i.category === 'ammo'),
  recipes: RecipeRegistry.recipes.length,
  enemiesNatural: ENEMIES.filter((e) => e.spawn.length).length,
  enemiesTotal: ENEMIES.length,
  aiKinds: new Set(ENEMIES.map((e) => e.ai)).size,
  bosses: BOSSES.length,
  npcs: NPCS.length,
  biomes: Object.keys(BIOMES).length,
  buffs: BUFFS.length,
  projectiles: PROJECTILES.length,
  lootTables: Object.keys(LOOT_TABLES).length,
  events: Object.keys(WORLD_EVENTS).length,
}, null, 1));
