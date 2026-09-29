import type { TileDef } from '../world/tileTypes';

/**
 * Tile catalogue. Numeric ids are persisted in save files — never renumber,
 * only append. Keys are used by code/content to reference tiles.
 */
export const TILE_DEFS: TileDef[] = [
  { id: 0, key: 'air', name: 'Air', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, texture: { kind: 'sprite', base: '#000000' }, mapColor: '#000000', sound: 'soil' },

  // --- Natural soils & stone ---
  { id: 1, key: 'loam', name: 'Loam', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'loam', texture: { kind: 'soil', base: '#7a4e2d', dark: '#5c3820', light: '#93613a' }, mapColor: '#6e462a', sound: 'soil' },
  { id: 2, key: 'meadowgrass', name: 'Meadowgrass', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'loam', grassOf: 'loam', texture: { kind: 'grass', base: '#7a4e2d', dark: '#5c3820', light: '#93613a', accent: '#4fa33b' }, mapColor: '#3f8f33', sound: 'soil', biome: 'meadow' },
  { id: 3, key: 'stone', name: 'Stone', hardness: 1, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'stone', texture: { kind: 'stone', base: '#77777f', dark: '#5a5a63', light: '#91919a' }, mapColor: '#6b6b73', sound: 'stone' },
  { id: 4, key: 'sand', name: 'Sand', hardness: 0.45, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'sand', texture: { kind: 'sand', base: '#dcc37a', dark: '#c1a660', light: '#ecd896' }, mapColor: '#d6bd73', sound: 'soil', biome: 'dunes' },
  { id: 5, key: 'sandstone', name: 'Sandstone', hardness: 1, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'sandstone', texture: { kind: 'stone', base: '#c49a5a', dark: '#a67e45', light: '#d8b171' }, mapColor: '#b98f52', sound: 'stone', biome: 'dunes' },
  { id: 6, key: 'snow', name: 'Snowpack', hardness: 0.4, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'snow', texture: { kind: 'sand', base: '#e8f0f8', dark: '#c6d4e4', light: '#ffffff' }, mapColor: '#e2ebf4', sound: 'soil', biome: 'taiga' },
  { id: 7, key: 'ice', name: 'Rime Ice', hardness: 0.8, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'ice', texture: { kind: 'ice', base: '#8fc4ea', dark: '#6aa4d2', light: '#c9e7fb' }, mapColor: '#88bde4', sound: 'glass', biome: 'taiga' },
  { id: 8, key: 'clay', name: 'Clay', hardness: 0.55, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'clay', texture: { kind: 'soil', base: '#a35a45', dark: '#834634', light: '#b96d56' }, mapColor: '#9a5541', sound: 'soil' },
  { id: 9, key: 'mud', name: 'Mud', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'mud', texture: { kind: 'soil', base: '#4d3a36', dark: '#3a2b28', light: '#5f4944' }, mapColor: '#4a3834', sound: 'soil' },
  { id: 10, key: 'lumenmoss', name: 'Lumenmoss', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'mud', grassOf: 'mud', light: [0.05, 0.18, 0.28], texture: { kind: 'grass', base: '#4d3a36', dark: '#3a2b28', light: '#5f4944', accent: '#45c8d8' }, mapColor: '#3aa9c0', sound: 'soil', biome: 'sporeglow' },
  { id: 11, key: 'blightgrass', name: 'Blightgrass', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'loam', grassOf: 'loam', texture: { kind: 'grass', base: '#5e4a52', dark: '#45363c', light: '#735c66', accent: '#8d5aa8' }, mapColor: '#7b4e93', sound: 'soil', biome: 'blightmire' },
  { id: 12, key: 'blightrock', name: 'Blightrock', hardness: 1.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'blightrock', texture: { kind: 'stone', base: '#5b4868', dark: '#433452', light: '#735d84' }, mapColor: '#554363', sound: 'stone', biome: 'blightmire' },
  { id: 13, key: 'hushstone', name: 'Hushstone', hardness: 1.6, tool: 'pickaxe', toolPower: 35, solid: true, drop: 'hushstone', texture: { kind: 'stone', base: '#4a4d5e', dark: '#363847', light: '#5d6174' }, mapColor: '#434656', sound: 'stone' },
  { id: 14, key: 'ash', name: 'Ash', hardness: 0.55, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'ash', texture: { kind: 'ash', base: '#4f4a4a', dark: '#3a3636', light: '#666060' }, mapColor: '#4a4545', sound: 'soil', biome: 'emberdeep' },
  { id: 15, key: 'basalt', name: 'Basaltglass', hardness: 3, tool: 'pickaxe', toolPower: 55, solid: true, drop: 'basalt', texture: { kind: 'crystal', base: '#2b2438', dark: '#1a1524', light: '#4a3d63' }, mapColor: '#2a2336', sound: 'glass' },
  { id: 16, key: 'prismstone', name: 'Prismstone', hardness: 1.4, tool: 'pickaxe', toolPower: 35, solid: true, drop: 'prismstone', texture: { kind: 'stone', base: '#5a6a8c', dark: '#44526f', light: '#7688ae' }, mapColor: '#56668a', sound: 'crystal', biome: 'glimmer' },

  // --- Ores ---
  { id: 17, key: 'soot_seam', name: 'Soot Seam', hardness: 1, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'soot', texture: { kind: 'ore', base: '#26222a', host: '#77777f', dark: '#5a5a63', light: '#91919a' }, mapColor: '#34303a', sound: 'stone' },
  { id: 18, key: 'brasslite_ore', name: 'Brasslite Ore', hardness: 1.1, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'brasslite_ore', texture: { kind: 'ore', base: '#e0923d', light: '#ffc27a', host: '#77777f', dark: '#5a5a63' }, mapColor: '#c98236', sound: 'stone' },
  { id: 19, key: 'ferrocite_ore', name: 'Ferrocite Ore', hardness: 1.3, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'ferrocite_ore', texture: { kind: 'ore', base: '#a7b3c2', light: '#dfe8f2', host: '#77777f', dark: '#5a5a63' }, mapColor: '#96a2b0', sound: 'stone' },
  { id: 20, key: 'moonsilver_ore', name: 'Moonsilver Ore', hardness: 1.6, tool: 'pickaxe', toolPower: 40, solid: true, drop: 'moonsilver_ore', texture: { kind: 'ore', base: '#cfe0ff', light: '#ffffff', host: '#5d6174', dark: '#363847' }, mapColor: '#b9c9ea', sound: 'metal' },
  { id: 21, key: 'sungild_ore', name: 'Sungild Ore', hardness: 1.9, tool: 'pickaxe', toolPower: 50, solid: true, drop: 'sungild_ore', light: [0.12, 0.09, 0.0], texture: { kind: 'ore', base: '#f5cf3c', light: '#fff2a8', host: '#4a4d5e', dark: '#363847' }, mapColor: '#e2bd33', sound: 'metal' },
  { id: 22, key: 'glimmerite_ore', name: 'Glimmerite', hardness: 2.2, tool: 'pickaxe', toolPower: 60, solid: true, drop: 'glimmerite_ore', light: [0.1, 0.25, 0.3], texture: { kind: 'ore', base: '#6fe0d0', light: '#d4fff8', host: '#5a6a8c', dark: '#44526f' }, mapColor: '#5fcfbf', sound: 'crystal', biome: 'glimmer' },
  { id: 23, key: 'cindrite_ore', name: 'Cindrite', hardness: 2.6, tool: 'pickaxe', toolPower: 70, solid: true, drop: 'cindrite_ore', light: [0.35, 0.12, 0.02], texture: { kind: 'ore', base: '#ff6a2a', light: '#ffc07a', host: '#3a3636', dark: '#241f1f' }, mapColor: '#e2541f', sound: 'stone', biome: 'emberdeep' },
  { id: 24, key: 'umbralite_ore', name: 'Umbralite', hardness: 3, tool: 'pickaxe', toolPower: 90, solid: true, drop: 'umbralite_ore', light: [0.12, 0.02, 0.2], texture: { kind: 'ore', base: '#8a3cd6', light: '#d7a6ff', host: '#4a4d5e', dark: '#282a36' }, mapColor: '#7a32bf', sound: 'crystal', lockedUntil: 'unsealed' },
  { id: 25, key: 'aetherium_ore', name: 'Aetherium', hardness: 3.4, tool: 'pickaxe', toolPower: 110, solid: true, drop: 'aetherium_ore', light: [0.2, 0.3, 0.35], texture: { kind: 'ore', base: '#9ff5ff', light: '#ffffff', host: '#363847', dark: '#20222c' }, mapColor: '#8fe5f0', sound: 'crystal', lockedUntil: 'unsealed' },
  { id: 26, key: 'starshard_ore', name: 'Starshard', hardness: 1.8, tool: 'pickaxe', toolPower: 45, solid: true, drop: 'starshard_ore', light: [0.3, 0.22, 0.35], texture: { kind: 'ore', base: '#ff8ae6', light: '#fff0fc', host: '#3b2f44', dark: '#271e2e' }, mapColor: '#e27acc', sound: 'crystal' },

  // --- Building blocks ---
  { id: 27, key: 'timber', name: 'Timber Planks', hardness: 0.7, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'wood', texture: { kind: 'planks', base: '#a4713f', dark: '#7d532b', light: '#bd8a55' }, mapColor: '#9a6a3b', sound: 'wood' },
  { id: 28, key: 'stone_brick', name: 'Stone Brick', hardness: 1.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'stone_brick', texture: { kind: 'brick', base: '#8a8a94', dark: '#5f5f69', light: '#a3a3ad', accent: '#4e4e57' }, mapColor: '#80808a', sound: 'stone' },
  { id: 29, key: 'kiln_brick', name: 'Kiln Brick', hardness: 1.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'kiln_brick', texture: { kind: 'brick', base: '#b05a44', dark: '#843f2f', light: '#c87058', accent: '#d9c7b4' }, mapColor: '#a8563f', sound: 'stone' },
  { id: 30, key: 'sandstone_brick', name: 'Sandstone Brick', hardness: 1.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'sandstone_brick', texture: { kind: 'brick', base: '#d0a868', dark: '#a8844e', light: '#e2bf80', accent: '#8f6c3c' }, mapColor: '#c79f60', sound: 'stone' },
  { id: 31, key: 'warden_brick', name: 'Warden Brick', hardness: 2.5, tool: 'pickaxe', toolPower: 65, solid: true, drop: 'warden_brick', texture: { kind: 'brick', base: '#3d5a6e', dark: '#2a4152', light: '#527489', accent: '#1d2d3a' }, mapColor: '#3a566a', sound: 'stone' },
  { id: 32, key: 'ember_brick', name: 'Ember Brick', hardness: 2.5, tool: 'pickaxe', toolPower: 70, solid: true, drop: 'ember_brick', texture: { kind: 'brick', base: '#5a2a2a', dark: '#3d1b1b', light: '#743737', accent: '#ff7a3a' }, mapColor: '#552828', sound: 'stone' },
  { id: 33, key: 'glass', name: 'Glass', hardness: 0.4, tool: 'pickaxe', toolPower: 0, solid: true, transparent: true, drop: 'glass', texture: { kind: 'glass', base: '#bfe6f0', light: '#ffffff', dark: '#86b8c8' }, mapColor: '#a8d4e0', sound: 'glass' },
  { id: 34, key: 'platform', name: 'Timber Platform', hardness: 0.3, tool: 'pickaxe', toolPower: 0, solid: false, platform: true, housingBoundary: true, drop: 'platform', support: 'attach', texture: { kind: 'sprite', base: '#a4713f', dark: '#7d532b' }, mapColor: '#9a6a3b', sound: 'wood', noEdges: true },

  // --- Furniture & objects ---
  { id: 35, key: 'door_closed', name: 'Door', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: true, transparent: true, drop: 'door', size: [1, 3], support: 'floor', furniture: ['door'], housingBoundary: true, texture: { kind: 'sprite', base: '#8b5a2b', dark: '#6a4220' }, mapColor: '#7a4f28', sound: 'wood', noEdges: true },
  { id: 36, key: 'door_open', name: 'Door', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'door', size: [1, 3], support: 'floor', furniture: ['door'], housingBoundary: true, texture: { kind: 'sprite', base: '#8b5a2b', dark: '#6a4220' }, mapColor: '#7a4f28', sound: 'wood', noEdges: true },
  { id: 37, key: 'torch', name: 'Torch', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, drop: 'torch', support: 'attach', light: [1.0, 0.78, 0.45], furniture: ['light'], texture: { kind: 'sprite', base: '#ffb040' }, mapColor: '#ffb040', sound: 'wood', noEdges: true },
  { id: 38, key: 'workbench', name: 'Workbench', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'workbench', size: [2, 1], support: 'floor', furniture: ['table', 'station'], station: 'workbench', texture: { kind: 'sprite', base: '#a4713f' }, mapColor: '#9a6a3b', sound: 'wood', noEdges: true },
  { id: 39, key: 'furnace', name: 'Smelter', hardness: 0.8, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'furnace', size: [2, 2], support: 'floor', furniture: ['station', 'light'], station: 'furnace', light: [0.7, 0.35, 0.1], texture: { kind: 'sprite', base: '#77777f' }, mapColor: '#6b6b73', sound: 'stone', noEdges: true },
  { id: 40, key: 'anvil', name: 'Ferrocite Anvil', hardness: 0.8, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'anvil', size: [2, 1], support: 'floor', furniture: ['station'], station: 'anvil', texture: { kind: 'sprite', base: '#5d6474' }, mapColor: '#5d6474', sound: 'metal', noEdges: true },
  { id: 41, key: 'alembic', name: 'Alembic Bench', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'alembic', size: [2, 2], support: 'floor', furniture: ['station', 'table'], station: 'alembic', texture: { kind: 'sprite', base: '#7a5a8c' }, mapColor: '#7a5a8c', sound: 'glass', noEdges: true },
  { id: 42, key: 'runescribe', name: 'Runescribe Desk', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'runescribe', size: [3, 2], support: 'floor', furniture: ['station', 'table'], station: 'runescribe', light: [0.15, 0.2, 0.45], texture: { kind: 'sprite', base: '#3e4f8a' }, mapColor: '#3e4f8a', sound: 'wood', noEdges: true },
  { id: 43, key: 'aetherforge', name: 'Aetherforge', hardness: 1, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'aetherforge', size: [3, 2], support: 'floor', furniture: ['station', 'light'], station: 'aetherforge', light: [0.3, 0.5, 0.6], texture: { kind: 'sprite', base: '#5dd5e8' }, mapColor: '#5dd5e8', sound: 'metal', noEdges: true },
  { id: 44, key: 'chest', name: 'Chest', hardness: 0.6, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'chest', size: [2, 2], support: 'floor', furniture: ['chest'], texture: { kind: 'sprite', base: '#9b6a35' }, mapColor: '#b0822f', sound: 'wood', noEdges: true },
  { id: 45, key: 'table', name: 'Table', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'table', size: [3, 2], support: 'floor', furniture: ['table'], texture: { kind: 'sprite', base: '#a4713f' }, mapColor: '#9a6a3b', sound: 'wood', noEdges: true },
  { id: 46, key: 'chair', name: 'Chair', hardness: 0.4, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'chair', size: [1, 2], support: 'floor', furniture: ['chair'], texture: { kind: 'sprite', base: '#a4713f' }, mapColor: '#9a6a3b', sound: 'wood', noEdges: true },
  { id: 47, key: 'bookcase', name: 'Bookcase', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'bookcase', size: [3, 4], support: 'floor', furniture: ['station'], station: 'bookcase', texture: { kind: 'sprite', base: '#7d532b' }, mapColor: '#6e4a28', sound: 'wood', noEdges: true },
  { id: 48, key: 'lamp', name: 'Glowlamp', hardness: 0.3, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'lamp', size: [1, 3], support: 'floor', furniture: ['light'], light: [1.0, 0.9, 0.65], texture: { kind: 'sprite', base: '#ffe7a0' }, mapColor: '#d8c080', sound: 'metal', noEdges: true },
  { id: 49, key: 'bed', name: 'Bed', hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'bed', size: [4, 2], support: 'floor', furniture: ['bed'], texture: { kind: 'sprite', base: '#b8434a' }, mapColor: '#a33a41', sound: 'cloth', noEdges: true },

  // --- Vegetation & natural decor ---
  { id: 50, key: 'tallgrass', name: 'Tall Grass', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', texture: { kind: 'sprite', base: '#4fa33b' }, mapColor: '#3f8f33', sound: 'plant', noEdges: true },
  { id: 51, key: 'flower', name: 'Wildflower', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', drop: 'petal', dropCount: [0, 1], texture: { kind: 'sprite', base: '#e85d9a' }, mapColor: '#3f8f33', sound: 'plant', noEdges: true },
  { id: 52, key: 'cactus', name: 'Spinecactus', hardness: 0.5, tool: 'axe', toolPower: 0, solid: false, transparent: true, support: 'floor', drop: 'cactus', contactDamage: 6, texture: { kind: 'sprite', base: '#3f8a4a' }, mapColor: '#3f8a4a', sound: 'plant', noEdges: true },
  { id: 53, key: 'trunk', name: 'Tree', hardness: 1, tool: 'axe', toolPower: 0, solid: false, transparent: true, support: 'floor', drop: 'wood', texture: { kind: 'sprite', base: '#6b4526' }, mapColor: '#5e3d22', sound: 'wood', noEdges: true },
  { id: 54, key: 'treetop', name: 'Tree Crown', hardness: 1, tool: 'axe', toolPower: 0, solid: false, transparent: true, support: 'floor', overlaySprite: true, texture: { kind: 'sprite', base: '#3d8a2f' }, mapColor: '#2f7426', sound: 'plant', noEdges: true },
  { id: 55, key: 'sapling', name: 'Sapling', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', drop: 'seedling', texture: { kind: 'sprite', base: '#4fa33b' }, mapColor: '#3f8f33', sound: 'plant', noEdges: true },
  { id: 56, key: 'glowshroom', name: 'Glowshroom', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', drop: 'glowshroom', light: [0.1, 0.35, 0.55], texture: { kind: 'sprite', base: '#45c8d8' }, mapColor: '#45c8d8', sound: 'plant', noEdges: true, biome: 'sporeglow' },
  { id: 57, key: 'emberbloom', name: 'Emberbloom', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', drop: 'emberbloom', light: [0.4, 0.15, 0.02], texture: { kind: 'sprite', base: '#ff7a2a' }, mapColor: '#c0501f', sound: 'plant', noEdges: true, biome: 'emberdeep' },
  { id: 58, key: 'vine', name: 'Vine', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'ceiling', texture: { kind: 'sprite', base: '#3d8a2f' }, mapColor: '#2f7426', sound: 'plant', noEdges: true },
  { id: 59, key: 'stalactite', name: 'Stalactite', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'ceiling', texture: { kind: 'sprite', base: '#77777f' }, mapColor: '#6b6b73', sound: 'stone', noEdges: true },
  { id: 60, key: 'pot', name: 'Clay Urn', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', size: [2, 2], texture: { kind: 'sprite', base: '#a35a45' }, mapColor: '#9a5541', sound: 'glass', noEdges: true },
  { id: 61, key: 'vital_crystal', name: 'Vital Crystal', hardness: 0.5, tool: 'any', toolPower: 0, solid: false, transparent: true, support: 'floor', size: [2, 2], drop: 'vital_heart', light: [0.6, 0.1, 0.2], texture: { kind: 'sprite', base: '#ff3b5c' }, mapColor: '#ff3b5c', sound: 'crystal', noEdges: true },
  { id: 62, key: 'crystal_cluster', name: 'Crystal Cluster', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'attach', drop: 'prism_shard', light: [0.2, 0.45, 0.6], texture: { kind: 'sprite', base: '#8ff0ff' }, mapColor: '#8ff0ff', sound: 'crystal', noEdges: true, biome: 'glimmer' },
  { id: 63, key: 'thornbrush', name: 'Thornbrush', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', contactDamage: 8, texture: { kind: 'sprite', base: '#7b4e93' }, mapColor: '#6a3f80', sound: 'plant', noEdges: true, biome: 'blightmire' },
  { id: 64, key: 'shardgrass', name: 'Shardgrass', hardness: 0.6, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'loam', grassOf: 'loam', light: [0.08, 0.02, 0.12], texture: { kind: 'grass', base: '#4a4058', dark: '#352d40', light: '#5c5070', accent: '#d05cff' }, mapColor: '#b04fe0', sound: 'soil', biome: 'shardblight' },
  { id: 65, key: 'shardrock', name: 'Shardrock', hardness: 1.8, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'shardrock', texture: { kind: 'crystal', base: '#4b3163', dark: '#321f45', light: '#7a52a0' }, mapColor: '#4b3163', sound: 'crystal', biome: 'shardblight' },
  { id: 66, key: 'basalt_brick', name: 'Basalt Brick', hardness: 2, tool: 'pickaxe', toolPower: 55, solid: true, drop: 'basalt_brick', texture: { kind: 'brick', base: '#3a3148', dark: '#261f31', light: '#4e4361', accent: '#161220' }, mapColor: '#362d44', sound: 'stone' },
  { id: 67, key: 'starloom', name: 'Starloom', hardness: 1, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'starloom', size: [3, 3], support: 'floor', furniture: ['station', 'light'], station: 'starloom', light: [0.5, 0.35, 0.6], texture: { kind: 'sprite', base: '#ff8ae6' }, mapColor: '#ff8ae6', sound: 'crystal', noEdges: true },
  { id: 68, key: 'frostbrick', name: 'Frostbrick', hardness: 1.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'frostbrick', texture: { kind: 'brick', base: '#a9cfe8', dark: '#7fa8c6', light: '#cfe8f8', accent: '#5f86a4' }, mapColor: '#a0c6de', sound: 'glass' },
  { id: 69, key: 'campfire', name: 'Campfire', hardness: 0.3, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'campfire', size: [3, 2], support: 'floor', furniture: ['light'], light: [1.0, 0.6, 0.25], texture: { kind: 'sprite', base: '#ff9a3a' }, mapColor: '#c0701f', sound: 'wood', noEdges: true },
  { id: 70, key: 'magmarock', name: 'Magmarock', hardness: 1.5, tool: 'pickaxe', toolPower: 50, solid: true, drop: 'magmarock', light: [0.3, 0.1, 0.0], contactDamage: 10, texture: { kind: 'ore', base: '#ff5a1a', light: '#ffb060', host: '#3a3636', dark: '#241f1f' }, mapColor: '#8a2f12', sound: 'stone', biome: 'emberdeep' },
  { id: 71, key: 'gravel', name: 'Gravel', hardness: 0.55, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'gravel', texture: { kind: 'sand', base: '#8c8078', dark: '#6e645e', light: '#a69a92' }, mapColor: '#857a72', sound: 'soil' },
  { id: 72, key: 'rope', name: 'Rope', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, climbable: true, drop: 'rope', support: 'attach', texture: { kind: 'sprite', base: '#b89a64' }, mapColor: '#9e8456', sound: 'cloth', noEdges: true },
  { id: 73, key: 'cobweb', name: 'Cobweb', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, drop: 'silk', dropCount: [0, 1], drag: 0.25, texture: { kind: 'sprite', base: '#dcdcdc' }, mapColor: '#9c9c9c', sound: 'cloth', noEdges: true },
  { id: 74, key: 'leafblock', name: 'Leafthatch', hardness: 0.2, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'leafthatch', texture: { kind: 'leaves', base: '#3d8a2f', dark: '#2a6a20', light: '#58a846' }, mapColor: '#2f7426', sound: 'plant' },
  { id: 75, key: 'moonsilver_brick', name: 'Moonsilver Brick', hardness: 1.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'moonsilver_brick', texture: { kind: 'brick', base: '#bccbe6', dark: '#95a4c0', light: '#dde8fb', accent: '#6f7c96' }, mapColor: '#b0bfda', sound: 'metal' },
  { id: 76, key: 'sungild_brick', name: 'Sungild Brick', hardness: 1.5, tool: 'pickaxe', toolPower: 0, solid: true, drop: 'sungild_brick', light: [0.05, 0.04, 0], texture: { kind: 'brick', base: '#e4bf40', dark: '#b8962b', light: '#f7da70', accent: '#8e7020' }, mapColor: '#d8b43a', sound: 'metal' },
  { id: 77, key: 'bone_pile', name: 'Bone Pile', hardness: 0, tool: 'any', toolPower: 0, solid: false, transparent: true, cuttable: true, support: 'floor', drop: 'bone', dropCount: [1, 2], texture: { kind: 'sprite', base: '#e6dcc4' }, mapColor: '#8c8578', sound: 'stone', noEdges: true },

  // --- Hearth & Home: decor with comfort, light tinting and weather reactions ---
  deco(78, 'artisan_bench', "Artisan's Bench", [3, 2], 'floor', 2, '#b07a48', 'wood', { furniture: ['station', 'table'], station: 'artisan' }),
  stained(79, 'rose_glass', 'Rose Stained Glass', '#d8546e', '#ffb0c0', [1.0, 0.42, 0.52]),
  stained(80, 'amber_glass', 'Amber Stained Glass', '#e8a23a', '#ffe0a0', [1.0, 0.74, 0.32]),
  stained(81, 'verdant_glass', 'Verdant Stained Glass', '#4fb86a', '#b8f0c0', [0.42, 1.0, 0.5]),
  stained(82, 'azure_glass', 'Azure Stained Glass', '#3f7ee0', '#b0d0ff', [0.38, 0.62, 1.0]),
  stained(83, 'violet_glass', 'Violet Stained Glass', '#8a4fd0', '#dcc0ff', [0.7, 0.42, 1.0]),
  stained(84, 'prism_glass', 'Prism Glass', '#c8c8e0', '#ffffff', [1, 1, 1], 4),
  deco(85, 'wind_chime', 'Wind Chime', [1, 2], 'ceiling', 3, '#c9a24a', 'metal'),
  deco(86, 'weathervane', 'Weathervane', [1, 3], 'floor', 3, '#5d6474', 'metal'),
  deco(87, 'pennant', 'Festival Pennant', [1, 3], 'ceiling', 2, '#d05a5a', 'cloth'),
  deco(88, 'hanging_lantern', 'Hanging Lantern', [1, 2], 'ceiling', 3, '#ffcf70', 'metal', { furniture: ['light'], light: [1.0, 0.8, 0.5] }),
  deco(89, 'wisp_jar', 'Wisp Jar', [1, 1], 'floor', 4, '#7fe8f0', 'glass', { furniture: ['light'], light: [0.25, 0.62, 0.72] }),
  deco(90, 'fountain', 'Stone Fountain', [3, 3], 'floor', 6, '#8a8a94', 'stone'),
  deco(91, 'gloop_lamp', 'Gloop Lamp', [1, 2], 'floor', 4, '#6ad04a', 'glass', { furniture: ['light'], light: [0.36, 0.8, 0.34] }),
  deco(92, 'hourglass', 'Tide Hourglass', [1, 2], 'floor', 4, '#e0c88a', 'glass'),
  deco(93, 'orrery', 'Starlit Orrery', [3, 3], 'floor', 8, '#d8b060', 'metal', { furniture: ['light'], light: [0.4, 0.34, 0.55] }),
  { id: 94, key: 'planter', name: 'Planter Box', hardness: 0.3, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: 'planter', support: 'floor', comfort: 1, texture: { kind: 'sprite', base: '#8b5a2b' }, mapColor: '#7a4f28', sound: 'wood', noEdges: true },
  deco(95, 'canvas_small', 'Small Canvas', [2, 2], 'wall', 1, '#efe4c8', 'cloth'),
  deco(96, 'canvas_wide', 'Grand Canvas', [4, 3], 'wall', 1, '#efe4c8', 'cloth'),
  deco(97, 'rug', 'Woven Rug', [3, 1], 'floor', 3, '#b8434a', 'cloth'),
];

/** Comfort values for furniture that predates the comfort system. */
const BASE_COMFORT: Record<string, number> = {
  torch: 1, lamp: 2, campfire: 3, chair: 1, table: 2, workbench: 1, bed: 4, bookcase: 4, chest: 1, glass: 1,
  furnace: 1, anvil: 1, alembic: 2, runescribe: 3, aetherforge: 3, starloom: 5,
};
for (const t of TILE_DEFS) if (t.comfort === undefined && BASE_COMFORT[t.key]) t.comfort = BASE_COMFORT[t.key];

/** A placeable decoration object drawn by an object sprite. */
function deco(id: number, key: string, name: string, size: [number, number], support: TileDef['support'], comfort: number, color: string, sound: TileDef['sound'], extra: Partial<TileDef> = {}): TileDef {
  return { id, key, name, hardness: 0.5, tool: 'pickaxe', toolPower: 0, solid: false, transparent: true, drop: key, size: size[0] * size[1] > 1 ? size : undefined, support, comfort, texture: { kind: 'sprite', base: color }, mapColor: color, sound, noEdges: true, ...extra };
}

/** A stained glass block: solid, see-through, and tints the light passing through it. */
function stained(id: number, key: string, name: string, base: string, light: string, tint: [number, number, number], comfort = 2): TileDef {
  return { id, key, name, hardness: 0.4, tool: 'pickaxe', toolPower: 0, solid: true, transparent: true, drop: key, tint, comfort, texture: { kind: 'stained', base, light, dark: '#241a22', accent: key === 'prism_glass' ? 'prism' : undefined }, mapColor: base, sound: 'glass' };
}
