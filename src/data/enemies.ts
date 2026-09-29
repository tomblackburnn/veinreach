import type { BiomeKey } from './biomes';

export type Zone = 'sky' | 'surface' | 'underground' | 'cavern' | 'deep' | 'underworld';

export type AIKind =
  | 'jumper'
  | 'walker'
  | 'charger'
  | 'flier'
  | 'hoverdive'
  | 'burrowAmbush'
  | 'climber'
  | 'roller'
  | 'worm'
  | 'archer'
  | 'caster'
  | 'floater'
  | 'mimic'
  | 'ghost';

export type EnemySpriteKind =
  | 'blob'
  | 'beetle'
  | 'husk'
  | 'bat'
  | 'lantern'
  | 'scorpion'
  | 'wolf'
  | 'shambler'
  | 'spider'
  | 'tortoise'
  | 'worm'
  | 'skeleton'
  | 'caster'
  | 'mote'
  | 'mimic'
  | 'mushroom'
  | 'imp'
  | 'knight'
  | 'shardling'
  | 'wraith'
  | 'stalker'
  | 'scrapjack'
  | 'brute';

export interface SpawnRule {
  biomes?: BiomeKey[];
  zones?: Zone[];
  time?: 'day' | 'night' | 'any';
  weight: number;
  requires?: string;
  excludes?: string;
  /** Only spawns during this world event. */
  event?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  life: number;
  damage: number;
  defense: number;
  kbResist: number;
  w: number;
  h: number;
  ai: AIKind;
  /** AI tuning knobs (speed, jump, range, cooldown...). */
  p?: Record<string, number>;
  sprite: { kind: EnemySpriteKind; colors: string[] };
  loot: string;
  spawn: SpawnRule[];
  light?: [number, number, number];
  onHit?: { buff: string; seconds: number; chance: number };
  projectile?: string;
  projectileDamage?: number;
  flying?: boolean;
  immune?: string[];
  /** Despawns in daylight on the surface. */
  nocturnal?: boolean;
  /** Stat multiplier applied after the Unsealing. */
  unsealedScale?: number;
}

const SURF: Zone[] = ['surface'];
const UG: Zone[] = ['underground', 'cavern'];

export const ENEMIES: EnemyDef[] = [
  // --- Surface, day ---
  {
    id: 'gloop', name: 'Meadow Gloop', life: 22, damage: 7, defense: 0, kbResist: 0, w: 22, h: 16, ai: 'jumper', p: { jump: 6.5, hop: 2.2, interval: 90 },
    sprite: { kind: 'blob', colors: ['#6ad04a', '#3a8a2a'] }, loot: 'e_gloop',
    spawn: [{ biomes: ['meadow', 'shore'], zones: SURF, time: 'day', weight: 10 }],
  },
  {
    id: 'sand_gloop', name: 'Amber Gloop', life: 32, damage: 10, defense: 2, kbResist: 0.1, w: 22, h: 16, ai: 'jumper', p: { jump: 7.5, hop: 2.8, interval: 70 },
    sprite: { kind: 'blob', colors: ['#f0b040', '#b07a20'] }, loot: 'e_gloop',
    spawn: [{ biomes: ['dunes'], zones: SURF, weight: 8 }],
  },
  {
    id: 'frost_gloop', name: 'Frost Gloop', life: 38, damage: 12, defense: 3, kbResist: 0.1, w: 22, h: 16, ai: 'jumper', p: { jump: 7, hop: 2.5, interval: 80 },
    sprite: { kind: 'blob', colors: ['#9fd8ff', '#4a8ac0'] }, loot: 'e_gloop', onHit: { buff: 'chilled', seconds: 3, chance: 0.5 },
    spawn: [{ biomes: ['taiga'], zones: ['surface', 'underground'], weight: 8 }],
  },
  {
    id: 'cave_gloop', name: 'Cave Gloop', life: 40, damage: 13, defense: 4, kbResist: 0.1, w: 22, h: 16, ai: 'jumper', p: { jump: 7, hop: 2.5, interval: 70 },
    sprite: { kind: 'blob', colors: ['#6a7ad0', '#3a4a9a'] }, loot: 'e_gloop',
    spawn: [{ biomes: ['underground'], zones: UG, weight: 8 }],
  },
  {
    id: 'burrbeetle', name: 'Burrbeetle', life: 30, damage: 11, defense: 5, kbResist: 0.3, w: 24, h: 16, ai: 'charger', p: { speed: 1.2, charge: 4.2, sight: 180 },
    sprite: { kind: 'beetle', colors: ['#8a5a2a', '#c08a4a', '#3a2a1a'] }, loot: 'e_burrbeetle',
    spawn: [{ biomes: ['meadow', 'dunes'], zones: SURF, time: 'day', weight: 5 }],
  },
  {
    id: 'sandlurker', name: 'Sandlurker', life: 60, damage: 18, defense: 6, kbResist: 0.5, w: 30, h: 16, ai: 'burrowAmbush', p: { speed: 2.4, trigger: 120 },
    sprite: { kind: 'scorpion', colors: ['#c08a3a', '#8a5a1a', '#e0b060'] }, loot: 'e_sandlurker', onHit: { buff: 'poisoned', seconds: 4, chance: 0.4 },
    spawn: [{ biomes: ['dunes'], zones: ['surface', 'underground'], weight: 5 }],
  },
  {
    id: 'frostfang', name: 'Frostfang', life: 55, damage: 16, defense: 4, kbResist: 0.2, w: 30, h: 20, ai: 'charger', p: { speed: 2.4, charge: 5.2, sight: 300, jump: 7 },
    sprite: { kind: 'wolf', colors: ['#dfe8f4', '#8a9ab0', '#4a5a70'] }, loot: 'e_frostfang',
    spawn: [{ biomes: ['taiga'], zones: SURF, weight: 6 }],
  },
  {
    id: 'bogshambler', name: 'Bogshambler', life: 70, damage: 16, defense: 6, kbResist: 0.4, w: 22, h: 38, ai: 'walker', p: { speed: 0.8, jump: 6 },
    sprite: { kind: 'shambler', colors: ['#5a6a3a', '#8d5aa8', '#3a2a2a'] }, loot: 'e_bogshambler', onHit: { buff: 'blighted', seconds: 4, chance: 0.4 },
    spawn: [{ biomes: ['blightmire'], zones: ['surface', 'underground'], weight: 8 }],
  },
  // --- Surface, night ---
  {
    id: 'husk', name: 'Hollow Husk', life: 45, damage: 14, defense: 5, kbResist: 0.3, w: 18, h: 40, ai: 'walker', p: { speed: 1.0, jump: 6.5 },
    sprite: { kind: 'husk', colors: ['#7a8a6a', '#4a4a5a', '#3a3a2a'] }, loot: 'e_husk', nocturnal: true,
    spawn: [{ biomes: ['meadow', 'dunes', 'taiga', 'shore', 'blightmire'], zones: SURF, time: 'night', weight: 10 }],
  },
  {
    id: 'duskwing', name: 'Duskwing', life: 20, damage: 10, defense: 1, kbResist: 0.6, w: 20, h: 14, ai: 'flier', p: { speed: 3.2, erratic: 1 },
    sprite: { kind: 'bat', colors: ['#5a4a6a', '#8a7a9a', '#ff5a5a'] }, loot: 'e_duskwing', flying: true, nocturnal: true,
    spawn: [
      { zones: SURF, time: 'night', weight: 5 },
      { zones: UG, weight: 5 },
    ],
  },
  {
    id: 'nightlantern', name: 'Nightlantern', life: 55, damage: 17, defense: 3, kbResist: 0.7, w: 22, h: 26, ai: 'hoverdive', p: { speed: 2.4, dive: 7 },
    sprite: { kind: 'lantern', colors: ['#3a2a4a', '#ffe070', '#ff9a40'] }, loot: 'e_nightlantern', flying: true, nocturnal: true, light: [0.5, 0.4, 0.15],
    spawn: [{ zones: SURF, time: 'night', weight: 4 }],
  },
  // --- Underground ---
  {
    id: 'webskitter', name: 'Webskitter', life: 50, damage: 15, defense: 5, kbResist: 0.3, w: 26, h: 18, ai: 'climber', p: { speed: 2.2 },
    sprite: { kind: 'spider', colors: ['#3a3040', '#6a5a70', '#ff4a4a'] }, loot: 'e_webskitter', onHit: { buff: 'poisoned', seconds: 3, chance: 0.3 },
    spawn: [{ biomes: ['underground'], zones: ['underground', 'cavern', 'deep'], weight: 6 }],
  },
  {
    id: 'rockback', name: 'Rockback', life: 110, damage: 20, defense: 18, kbResist: 0.8, w: 30, h: 20, ai: 'roller', p: { speed: 0.7, roll: 5 },
    sprite: { kind: 'tortoise', colors: ['#8a7f78', '#5a524d', '#6a8a5a'] }, loot: 'e_rockback',
    spawn: [{ zones: ['cavern', 'deep'], weight: 4 }],
  },
  {
    id: 'tunnelgrub', name: 'Tunnel Grub', life: 60, damage: 16, defense: 4, kbResist: 1, w: 18, h: 18, ai: 'worm', p: { speed: 4.5, segments: 7, turn: 0.07 },
    sprite: { kind: 'worm', colors: ['#c09070', '#8a6050', '#e0b090'] }, loot: 'e_tunnelgrub',
    spawn: [{ zones: ['underground', 'cavern'], weight: 3 }],
  },
  {
    id: 'ossuary_archer', name: 'Ossuary Archer', life: 70, damage: 18, defense: 8, kbResist: 0.3, w: 18, h: 40, ai: 'archer', p: { speed: 1.1, range: 360, cooldown: 110, jump: 6.5 },
    sprite: { kind: 'skeleton', colors: ['#e6dcc4', '#8a8070', '#5a3a2a'] }, loot: 'e_ossuary_archer', projectile: 'enemy_arrow', projectileDamage: 22,
    spawn: [
      { biomes: ['keep'], weight: 10 },
      { zones: ['cavern', 'deep'], weight: 3 },
    ],
  },
  {
    id: 'hexcaller', name: 'Hexcaller', life: 80, damage: 18, defense: 6, kbResist: 0.4, w: 18, h: 40, ai: 'caster', p: { cooldown: 150, teleport: 280 },
    sprite: { kind: 'caster', colors: ['#5a2a7a', '#c060ff', '#e6dcc4'] }, loot: 'e_hexcaller', projectile: 'enemy_bolt', projectileDamage: 26,
    spawn: [
      { biomes: ['keep'], weight: 6 },
      { zones: ['deep'], weight: 2 },
    ],
  },
  {
    id: 'crystal_mote', name: 'Crystal Mote', life: 75, damage: 20, defense: 10, kbResist: 0.5, w: 20, h: 20, ai: 'floater', p: { speed: 1.6, cooldown: 140, burst: 5 },
    sprite: { kind: 'mote', colors: ['#8ff0ff', '#3a6a8a', '#ffffff'] }, loot: 'e_crystal_mote', projectile: 'enemy_shard', projectileDamage: 22, flying: true, light: [0.2, 0.45, 0.55],
    spawn: [{ biomes: ['glimmer'], weight: 10 }],
  },
  {
    id: 'lurker_chest', name: 'Lurker Chest', life: 260, damage: 34, defense: 16, kbResist: 0.9, w: 30, h: 30, ai: 'mimic', p: { jump: 8, speed: 3 },
    sprite: { kind: 'mimic', colors: ['#9b6a35', '#d4a441', '#ff4a4a'] }, loot: 'e_lurker_chest',
    spawn: [{ zones: ['cavern', 'deep'], weight: 0.4 }],
  },
  {
    id: 'sporecap', name: 'Sporecap', life: 65, damage: 16, defense: 6, kbResist: 0.3, w: 20, h: 26, ai: 'walker', p: { speed: 0.9, jump: 6, spore: 160 },
    sprite: { kind: 'mushroom', colors: ['#45c8d8', '#d8e8f0', '#8ff0ff'] }, loot: 'e_sporecap', projectile: 'enemy_spore', projectileDamage: 16, light: [0.1, 0.3, 0.45],
    onHit: { buff: 'poisoned', seconds: 4, chance: 0.5 },
    spawn: [{ biomes: ['sporeglow'], weight: 10 }],
  },
  // --- Emberdeep ---
  {
    id: 'cinder_imp', name: 'Cinder Imp', life: 90, damage: 24, defense: 12, kbResist: 0.4, w: 20, h: 26, ai: 'caster', p: { cooldown: 120, teleport: 240, fly: 1 },
    sprite: { kind: 'imp', colors: ['#c0401a', '#ff9a40', '#3a1a1a'] }, loot: 'e_cinder_imp', projectile: 'enemy_fireball', projectileDamage: 30, flying: true, immune: ['burning'], light: [0.4, 0.15, 0.02],
    onHit: { buff: 'burning', seconds: 3, chance: 0.4 },
    spawn: [{ zones: ['underworld'], weight: 7 }],
  },
  {
    id: 'magma_gloop', name: 'Magma Gloop', life: 80, damage: 26, defense: 10, kbResist: 0.2, w: 24, h: 18, ai: 'jumper', p: { jump: 8, hop: 3, interval: 60 },
    sprite: { kind: 'blob', colors: ['#ff6a2a', '#8a2a0a'] }, loot: 'e_magma_gloop', immune: ['burning'], light: [0.45, 0.15, 0.02],
    onHit: { buff: 'burning', seconds: 4, chance: 0.6 },
    spawn: [{ zones: ['underworld'], weight: 8 }],
  },
  {
    id: 'ashen_knight', name: 'Ashen Knight', life: 220, damage: 34, defense: 26, kbResist: 0.8, w: 22, h: 42, ai: 'charger', p: { speed: 1.1, charge: 4.5, sight: 260, jump: 7 },
    sprite: { kind: 'knight', colors: ['#4a4040', '#ff7a2a', '#2a2020'] }, loot: 'e_ashen_knight', immune: ['burning'],
    spawn: [{ zones: ['underworld'], weight: 4 }],
  },
  // --- Post-Unsealing ---
  {
    id: 'shardling', name: 'Shardling Horror', life: 260, damage: 44, defense: 24, kbResist: 0.5, w: 26, h: 26, ai: 'charger', p: { speed: 1.8, charge: 6, sight: 320, jump: 8 },
    sprite: { kind: 'shardling', colors: ['#b04fe0', '#4b3163', '#ffffff'] }, loot: 'e_shardling', light: [0.2, 0.05, 0.3],
    spawn: [{ biomes: ['shardblight'], weight: 10, requires: 'unsealed' }],
  },
  {
    id: 'voidwraith', name: 'Voidwraith', life: 300, damage: 50, defense: 20, kbResist: 0.9, w: 24, h: 34, ai: 'ghost', p: { speed: 2.4 },
    sprite: { kind: 'wraith', colors: ['#a64cff', '#1a0a2a', '#e0b0ff'] }, loot: 'e_voidwraith', flying: true, light: [0.25, 0.05, 0.4],
    onHit: { buff: 'voidtouched', seconds: 5, chance: 0.5 },
    spawn: [
      { biomes: ['shardblight'], time: 'night', weight: 5, requires: 'unsealed' },
      { zones: ['deep'], weight: 3, requires: 'unsealed' },
      { event: 'veilstorm', weight: 10 },
    ],
  },
  // --- Events ---
  {
    id: 'gloam_stalker', name: 'Gloam Stalker', life: 90, damage: 26, defense: 10, kbResist: 0.4, w: 20, h: 40, ai: 'walker', p: { speed: 2.0, jump: 7.5 },
    sprite: { kind: 'stalker', colors: ['#3a2a5a', '#8a60c0', '#ff4aff'] }, loot: 'e_gloam_stalker', nocturnal: true,
    spawn: [{ event: 'gloamtide', weight: 10 }],
  },
  {
    id: 'scrapjack', name: 'Scrapjack Raider', life: 80, damage: 20, defense: 8, kbResist: 0.3, w: 18, h: 40, ai: 'walker', p: { speed: 1.5, jump: 7 },
    sprite: { kind: 'scrapjack', colors: ['#9aa0a8', '#8a5a3a', '#c0401a'] }, loot: 'e_scrapjack',
    spawn: [{ event: 'raid', weight: 10 }],
  },
  {
    id: 'scrapjack_slinger', name: 'Scrapjack Slinger', life: 65, damage: 18, defense: 6, kbResist: 0.3, w: 18, h: 40, ai: 'archer', p: { speed: 1.3, range: 320, cooldown: 90, jump: 7 },
    sprite: { kind: 'scrapjack', colors: ['#9aa0a8', '#5a6a8a', '#e0923d'] }, loot: 'e_scrapjack_slinger', projectile: 'enemy_scrap', projectileDamage: 20,
    spawn: [{ event: 'raid', weight: 6 }],
  },
  {
    id: 'scrapjack_brute', name: 'Scrapjack Brute', life: 320, damage: 36, defense: 18, kbResist: 0.9, w: 30, h: 48, ai: 'charger', p: { speed: 0.9, charge: 3.6, sight: 240, jump: 6 },
    sprite: { kind: 'brute', colors: ['#6a7078', '#8a5a3a', '#c0401a'] }, loot: 'e_scrapjack_brute',
    spawn: [{ event: 'raid', weight: 2 }],
  },
  // --- Boss adds (never spawn naturally) ---
  {
    id: 'grubling', name: 'Grubling', life: 30, damage: 14, defense: 4, kbResist: 0, w: 18, h: 14, ai: 'jumper', p: { jump: 6, hop: 3, interval: 40 },
    sprite: { kind: 'blob', colors: ['#c0a070', '#6a4a2a'] }, loot: 'e_gloop', spawn: [],
  },
  {
    id: 'thornling', name: 'Thornling', life: 60, damage: 20, defense: 6, kbResist: 0.2, w: 18, h: 30, ai: 'walker', p: { speed: 1.8, jump: 7 },
    sprite: { kind: 'shambler', colors: ['#6a8a3a', '#b06adf', '#3a2a1a'] }, loot: 'e_bogshambler', spawn: [],
  },
  {
    id: 'star_wisp', name: 'Star Wisp', life: 180, damage: 50, defense: 20, kbResist: 0.8, w: 18, h: 18, ai: 'flier', p: { speed: 4.5, erratic: 0.3 },
    sprite: { kind: 'mote', colors: ['#fff0a0', '#ff8ae6', '#ffffff'] }, loot: 'e_gloop', flying: true, light: [0.4, 0.35, 0.4], spawn: [],
  },
];

export const ENEMY_MAP = new Map(ENEMIES.map((e) => [e.id, e]));
