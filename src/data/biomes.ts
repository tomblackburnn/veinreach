/**
 * Biome catalogue. Biomes are *detected* at runtime by sampling nearby tiles
 * (see biomes/BiomeDetector), so player building and world transformation
 * naturally change the local biome.
 */
export type BiomeKey =
  | 'meadow'
  | 'dunes'
  | 'taiga'
  | 'blightmire'
  | 'shore'
  | 'underground'
  | 'sporeglow'
  | 'glimmer'
  | 'emberdeep'
  | 'shardblight'
  | 'keep'
  | 'skyisles';

export type AmbientParticle = 'leaves' | 'sand' | 'snow' | 'spores' | 'embers' | 'sparkles' | 'ash' | 'motes' | 'none';
export type BackgroundKind = 'hills' | 'dunes' | 'pines' | 'mire' | 'sea' | 'cave' | 'mushroom' | 'crystal' | 'hellscape' | 'shards' | 'keep';

export interface BiomeDef {
  key: BiomeKey;
  name: string;
  description: string;
  music: string;
  background: BackgroundKind;
  /** Background palette far→near. */
  bgColors: [string, string, string];
  /** Sky tint multiplied into the day sky. */
  skyTint?: string;
  ambient: AmbientParticle;
  /** Tiles counted during detection and how many samples are needed. */
  detectTiles: string[];
  detectWalls?: string[];
  detectThreshold: number;
  /** Higher priority wins when several thresholds are met. */
  priority: number;
  weather: ('rain' | 'snow' | 'sandstorm' | 'storm')[];
}

export const BIOMES: Record<BiomeKey, BiomeDef> = {
  meadow: {
    key: 'meadow', name: 'Mossmeadow', description: 'Rolling green hills where most journeys begin.',
    music: 'day', background: 'hills', bgColors: ['#6f9fc4', '#4f8a5a', '#35683d'], ambient: 'leaves',
    detectTiles: ['meadowgrass'], detectThreshold: 0, priority: 0, weather: ['rain', 'storm'],
  },
  dunes: {
    key: 'dunes', name: 'Sunscald Dunes', description: 'Wind-carved sand seas hiding sandstone vaults.',
    music: 'dunes', background: 'dunes', bgColors: ['#e8c890', '#d4a860', '#b88a48'], skyTint: '#ffe8c0', ambient: 'sand',
    detectTiles: ['sand', 'sandstone', 'sandstone_brick'], detectThreshold: 60, priority: 2, weather: ['sandstorm'],
  },
  taiga: {
    key: 'taiga', name: 'Rimefrost Taiga', description: 'Snowbound pinewoods above caverns of rime ice.',
    music: 'taiga', background: 'pines', bgColors: ['#b8cfe0', '#7a9cb4', '#48677e'], skyTint: '#e0f0ff', ambient: 'snow',
    detectTiles: ['snow', 'ice', 'frostbrick'], detectThreshold: 60, priority: 2, weather: ['snow'],
  },
  blightmire: {
    key: 'blightmire', name: 'Blightmire', description: 'A rotting fen where a sickly violet growth spreads.',
    music: 'blight', background: 'mire', bgColors: ['#6a5a7a', '#4a3a5a', '#2e2438'], skyTint: '#d8c0e8', ambient: 'spores',
    detectTiles: ['blightgrass', 'blightrock', 'thornbrush'], detectThreshold: 50, priority: 3, weather: ['rain'],
  },
  shore: {
    key: 'shore', name: 'Saltreach Shore', description: 'The world’s edge, where the sea meets the sand.',
    music: 'day', background: 'sea', bgColors: ['#8fc4e8', '#5a9cc8', '#3a7aa8'], ambient: 'none',
    detectTiles: [], detectThreshold: 0, priority: 1, weather: ['rain', 'storm'],
  },
  underground: {
    key: 'underground', name: 'The Underlayers', description: 'Twisting tunnels of loam and stone.',
    music: 'underground', background: 'cave', bgColors: ['#3a3038', '#2c242a', '#1e181c'], ambient: 'motes',
    detectTiles: [], detectThreshold: 0, priority: 0, weather: [],
  },
  sporeglow: {
    key: 'sporeglow', name: 'Sporeglow Caverns', description: 'Luminous fungal groves deep in the mud.',
    music: 'sporeglow', background: 'mushroom', bgColors: ['#1e3a4a', '#16303e', '#0e2230'], ambient: 'spores',
    detectTiles: ['lumenmoss', 'glowshroom', 'mud'], detectThreshold: 90, priority: 4, weather: [],
  },
  glimmer: {
    key: 'glimmer', name: 'Glimmer Hollows', description: 'Singing crystal caverns humming with old magic.',
    music: 'glimmer', background: 'crystal', bgColors: ['#2a3558', '#222a48', '#181e36'], ambient: 'sparkles',
    detectTiles: ['prismstone', 'glimmerite_ore', 'crystal_cluster'], detectThreshold: 70, priority: 5, weather: [],
  },
  emberdeep: {
    key: 'emberdeep', name: 'Emberdeep', description: 'The molten bottom of the world, ruled by ash and fire.',
    music: 'emberdeep', background: 'hellscape', bgColors: ['#5a1a10', '#3a100a', '#200806'], ambient: 'embers',
    detectTiles: ['ash', 'magmarock', 'cindrite_ore', 'ember_brick'], detectThreshold: 80, priority: 6, weather: [],
  },
  shardblight: {
    key: 'shardblight', name: 'The Shardblight', description: 'Where the Seal broke, reality splinters into violet glass.',
    music: 'shardblight', background: 'shards', bgColors: ['#4a2a6a', '#361e50', '#221236'], skyTint: '#e0b0ff', ambient: 'sparkles',
    detectTiles: ['shardgrass', 'shardrock'], detectThreshold: 60, priority: 7, weather: ['storm'],
  },
  keep: {
    key: 'keep', name: 'Warden’s Keep', description: 'A drowned fortress built to guard something below.',
    music: 'keep', background: 'keep', bgColors: ['#1e2c38', '#16222c', '#0e161e'], ambient: 'motes',
    detectTiles: ['warden_brick'], detectWalls: ['warden_wall'], detectThreshold: 120, priority: 8, weather: [],
  },
  skyisles: {
    key: 'skyisles', name: 'Drifting Isles', description: 'Fragments of land adrift in the high winds.',
    music: 'sky', background: 'hills', bgColors: ['#9fd0f0', '#c8e6f8', '#e8f6ff'], ambient: 'none',
    detectTiles: [], detectThreshold: 0, priority: 1, weather: [],
  },
};
