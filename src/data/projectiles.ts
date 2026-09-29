/**
 * Projectile archetypes shared by players, enemies and bosses. Damage and
 * faction are supplied when a projectile is spawned.
 */
export type ProjectileShape =
  | 'arrow'
  | 'orb'
  | 'bolt'
  | 'shard'
  | 'boomerang'
  | 'spear'
  | 'fireball'
  | 'leaf'
  | 'star'
  | 'rock'
  | 'thorn'
  | 'wisp'
  | 'pellet'
  | 'spark'
  | 'beam'
  | 'ring';

export type ProjectileBehavior = 'default' | 'boomerang' | 'spear' | 'minion' | 'orbit' | 'beam';

export interface ProjectileDef {
  id: string;
  shape: ProjectileShape;
  color: string;
  color2?: string;
  size: number; // hitbox size in px (square)
  gravity?: number;
  drag?: number;
  lifetime: number; // ticks
  pierce?: number; // -1 = infinite
  bounces?: number;
  homing?: number; // turn rate per tick (radians)
  homingRange?: number; // px
  explode?: { radius: number };
  trail?: string; // particle colour
  light?: [number, number, number];
  tileCollide?: boolean;
  behavior?: ProjectileBehavior;
  rotate?: 'velocity' | 'spin' | 'none';
  /** Visual length for beams/arrows in px. */
  length?: number;
  /** Spawn these projectiles on death (count, spread speed). */
  split?: { id: string; count: number; speed: number };
  sound?: string;
}

export const PROJECTILES: ProjectileDef[] = [
  // Player — arrows & pellets
  { id: 'arrow_wood', shape: 'arrow', color: '#c9a36a', color2: '#e8e8e8', size: 8, gravity: 0.12, lifetime: 240, rotate: 'velocity', length: 18 },
  { id: 'arrow_barbed', shape: 'arrow', color: '#a7b3c2', color2: '#e8e8e8', size: 8, gravity: 0.1, lifetime: 240, pierce: 1, rotate: 'velocity', length: 18 },
  { id: 'arrow_frost', shape: 'arrow', color: '#8fe0ff', color2: '#ffffff', size: 8, gravity: 0.1, lifetime: 240, rotate: 'velocity', length: 18, trail: '#bff0ff', light: [0.1, 0.25, 0.35] },
  { id: 'arrow_ember', shape: 'arrow', color: '#ff7a2a', color2: '#ffd070', size: 8, gravity: 0.08, lifetime: 240, rotate: 'velocity', length: 18, trail: '#ff9a40', light: [0.4, 0.2, 0.05] },
  { id: 'arrow_void', shape: 'arrow', color: '#a64cff', color2: '#e0b0ff', size: 8, gravity: 0.04, lifetime: 240, pierce: 3, rotate: 'velocity', length: 20, trail: '#c080ff', light: [0.2, 0.05, 0.3] },
  { id: 'pellet_lead', shape: 'pellet', color: '#9aa0a8', size: 5, lifetime: 120, rotate: 'velocity', length: 8, trail: '#fff2b0' },
  { id: 'pellet_cinder', shape: 'pellet', color: '#ff7a2a', size: 5, lifetime: 120, pierce: 1, rotate: 'velocity', length: 10, trail: '#ffb060', light: [0.3, 0.12, 0.02] },
  { id: 'star_volley', shape: 'star', color: '#fff0a0', color2: '#ff8ae6', size: 10, lifetime: 150, pierce: 2, homing: 0.04, homingRange: 320, rotate: 'spin', trail: '#ffd0f0', light: [0.4, 0.3, 0.4] },
  // Player — melee specials
  { id: 'riftrang', shape: 'boomerang', color: '#6fe0d0', color2: '#2a6a80', size: 16, lifetime: 600, behavior: 'boomerang', rotate: 'spin', pierce: -1, trail: '#9ff5ff', light: [0.1, 0.3, 0.3] },
  { id: 'emberlance', shape: 'spear', color: '#ff7a2a', color2: '#5a2a2a', size: 12, lifetime: 18, behavior: 'spear', pierce: -1, tileCollide: false, length: 56, light: [0.4, 0.15, 0.02] },
  { id: 'serpent_glaive', shape: 'spear', color: '#ffb040', color2: '#5a1a10', size: 14, lifetime: 18, behavior: 'spear', pierce: -1, tileCollide: false, length: 70, light: [0.4, 0.2, 0.05] },
  { id: 'glimmer_bolt', shape: 'shard', color: '#6fe0d0', color2: '#ffffff', size: 10, lifetime: 45, pierce: 1, rotate: 'velocity', trail: '#9ff5ff', light: [0.1, 0.35, 0.35] },
  { id: 'thorn_bolt', shape: 'thorn', color: '#6ab04a', color2: '#2f5a24', size: 8, lifetime: 60, gravity: 0.05, rotate: 'velocity', trail: '#8fd060' },
  { id: 'umbral_wave', shape: 'ring', color: '#a64cff', color2: '#ffffff', size: 22, lifetime: 30, pierce: -1, tileCollide: false, trail: '#c080ff', light: [0.3, 0.05, 0.4] },
  { id: 'starfall', shape: 'star', color: '#ffe8a0', color2: '#ff8ae6', size: 14, lifetime: 120, pierce: 2, rotate: 'spin', trail: '#fff0c0', light: [0.5, 0.4, 0.3], tileCollide: false },
  // Player — magic
  { id: 'spark', shape: 'spark', color: '#ffe070', color2: '#ffffff', size: 8, lifetime: 50, trail: '#ffd040', light: [0.35, 0.28, 0.1] },
  { id: 'frost_bolt', shape: 'bolt', color: '#8fe0ff', color2: '#ffffff', size: 10, lifetime: 80, bounces: 2, trail: '#bff0ff', light: [0.15, 0.3, 0.4] },
  { id: 'fireball', shape: 'fireball', color: '#ff7a2a', color2: '#ffe070', size: 12, lifetime: 90, gravity: 0.08, explode: { radius: 40 }, trail: '#ff9a40', light: [0.6, 0.3, 0.05] },
  { id: 'prism_ray', shape: 'beam', color: '#9ff5ff', color2: '#ffffff', size: 8, lifetime: 40, pierce: 4, trail: '#d4fff8', light: [0.2, 0.4, 0.45], rotate: 'velocity', length: 28 },
  { id: 'verdant_leaf', shape: 'leaf', color: '#6ad04a', color2: '#2f7426', size: 10, lifetime: 120, homing: 0.07, homingRange: 360, rotate: 'velocity', trail: '#8fe070' },
  { id: 'void_orb', shape: 'orb', color: '#a64cff', color2: '#1a0a2a', size: 14, lifetime: 160, homing: 0.06, homingRange: 420, pierce: 1, trail: '#c080ff', light: [0.3, 0.05, 0.45] },
  { id: 'astral_star', shape: 'star', color: '#fff0a0', color2: '#9ff5ff', size: 16, lifetime: 140, pierce: 3, rotate: 'spin', tileCollide: false, explode: { radius: 48 }, trail: '#ffffff', light: [0.5, 0.5, 0.5] },
  // Summons
  { id: 'wisp_minion', shape: 'wisp', color: '#8fe0ff', color2: '#ffffff', size: 14, lifetime: 60 * 60 * 30, behavior: 'minion', tileCollide: false, pierce: -1, light: [0.2, 0.35, 0.45], trail: '#bff0ff' },
  { id: 'shard_minion', shape: 'shard', color: '#6fe0d0', color2: '#ffffff', size: 14, lifetime: 60 * 60 * 30, behavior: 'minion', tileCollide: false, pierce: -1, light: [0.15, 0.35, 0.35], trail: '#9ff5ff' },
  { id: 'wyrmling_minion', shape: 'fireball', color: '#ff8a3a', color2: '#ffe070', size: 16, lifetime: 60 * 60 * 30, behavior: 'minion', tileCollide: false, pierce: -1, light: [0.45, 0.2, 0.05], trail: '#ffb060' },
  // Hostile
  { id: 'enemy_arrow', shape: 'arrow', color: '#e6dcc4', color2: '#888888', size: 8, gravity: 0.08, lifetime: 240, rotate: 'velocity', length: 18 },
  { id: 'enemy_bolt', shape: 'orb', color: '#c060ff', color2: '#ffffff', size: 10, lifetime: 200, homing: 0.025, homingRange: 500, trail: '#d090ff', light: [0.25, 0.05, 0.35], tileCollide: false },
  { id: 'enemy_shard', shape: 'shard', color: '#8ff0ff', color2: '#ffffff', size: 8, lifetime: 150, rotate: 'velocity', trail: '#bff8ff', light: [0.1, 0.3, 0.35] },
  { id: 'enemy_fireball', shape: 'fireball', color: '#ff6a2a', color2: '#ffe070', size: 12, lifetime: 220, tileCollide: false, trail: '#ff9a40', light: [0.5, 0.2, 0.02] },
  { id: 'enemy_spore', shape: 'orb', color: '#7ad060', color2: '#d0ff90', size: 10, lifetime: 160, drag: 0.985, gravity: -0.005, trail: '#a0e080' },
  { id: 'enemy_rock', shape: 'rock', color: '#8a7f78', color2: '#5a524d', size: 12, gravity: 0.25, lifetime: 240, rotate: 'spin' },
  { id: 'enemy_scrap', shape: 'rock', color: '#9aa0a8', color2: '#6a4a3a', size: 10, gravity: 0.2, lifetime: 200, rotate: 'spin' },
  // Bosses
  { id: 'boss_rock', shape: 'rock', color: '#9a8f86', color2: '#5a524d', size: 16, gravity: 0.3, lifetime: 300, rotate: 'spin' },
  { id: 'boss_thorn', shape: 'thorn', color: '#7ab04a', color2: '#3a2a1a', size: 10, lifetime: 240, rotate: 'velocity', tileCollide: false, trail: '#8fd060' },
  { id: 'boss_seed', shape: 'orb', color: '#b06adf', color2: '#3a1a4a', size: 14, gravity: 0.18, lifetime: 240, split: { id: 'boss_thorn', count: 6, speed: 4 }, trail: '#c080ff' },
  { id: 'boss_shard', shape: 'shard', color: '#8ff0ff', color2: '#ffffff', size: 10, lifetime: 300, rotate: 'velocity', tileCollide: false, trail: '#bff8ff', light: [0.1, 0.3, 0.35] },
  { id: 'boss_orb', shape: 'orb', color: '#6fe0d0', color2: '#ffffff', size: 16, lifetime: 300, homing: 0.02, homingRange: 900, tileCollide: false, trail: '#9ff5ff', light: [0.15, 0.4, 0.4] },
  { id: 'boss_ember', shape: 'fireball', color: '#ff6a2a', color2: '#ffe070', size: 14, lifetime: 260, homing: 0.018, homingRange: 900, tileCollide: false, trail: '#ff9a40', light: [0.5, 0.2, 0.02] },
  { id: 'boss_flame', shape: 'fireball', color: '#ffb040', color2: '#ff3a1a', size: 18, lifetime: 50, drag: 0.97, tileCollide: false, pierce: -1, light: [0.6, 0.3, 0.05] },
  { id: 'boss_star', shape: 'star', color: '#fff0a0', color2: '#ff8ae6', size: 14, lifetime: 360, rotate: 'spin', tileCollide: false, trail: '#ffe0f0', light: [0.4, 0.35, 0.4] },
  { id: 'boss_void', shape: 'orb', color: '#a64cff', color2: '#ffffff', size: 18, lifetime: 360, tileCollide: false, trail: '#c080ff', light: [0.3, 0.05, 0.45] },
];
