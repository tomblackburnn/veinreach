/** Item system type definitions. Content lives in src/data/items/. */

export type ItemCategory =
  | 'block'
  | 'wall'
  | 'material'
  | 'tool'
  | 'melee'
  | 'ranged'
  | 'magic'
  | 'summon'
  | 'armor'
  | 'accessory'
  | 'consumable'
  | 'bossSummon'
  | 'ammo'
  | 'furniture'
  | 'currency'
  | 'utility';

export type DamageClass = 'melee' | 'ranged' | 'magic' | 'summon';
export type AmmoType = 'arrow' | 'pellet';
export type UseStyle = 'swing' | 'thrust' | 'shoot' | 'consume' | 'place' | 'hold';

/** Additive stat modifiers from armour, accessories, set bonuses and buffs. */
export interface StatMods {
  defense?: number;
  maxLife?: number;
  maxMana?: number;
  lifeRegen?: number; // HP per second
  manaRegen?: number;
  moveSpeed?: number; // fraction, 0.1 = +10%
  jumpBoost?: number; // fraction
  crit?: number; // percentage points
  damage?: number; // fraction, all classes
  meleeDamage?: number;
  rangedDamage?: number;
  magicDamage?: number;
  summonDamage?: number;
  meleeSpeed?: number; // fraction faster
  miningSpeed?: number; // fraction faster
  manaCostReduce?: number; // fraction
  damageReduce?: number; // fraction of incoming damage removed
  thorns?: number; // fraction reflected
  lightRadius?: number; // 0..1 personal light
  minionSlots?: number;
  // Flags (any positive value enables)
  doubleJump?: number;
  dash?: number;
  fallImmune?: number;
  knockbackImmune?: number;
  lavaImmune?: number;
  fireImmune?: number;
  poisonImmune?: number;
  nightVision?: number;
  detectEnemies?: number;
  showDepth?: number;
  showTime?: number;
}

export interface IconSpec {
  /** Template drawn by rendering/sprites/itemIcons. */
  t: string;
  /** Palette: meaning depends on template (e.g. [blade, hilt]). */
  c?: string[];
  /** For block/wall/object icons. */
  tile?: string;
  wall?: string;
}

export interface ToolStats {
  pick?: number;
  axe?: number;
  hammer?: number;
  /** Extra reach in tiles. */
  range?: number;
}

export interface WeaponStats {
  damage: number;
  knockback: number;
  crit?: number;
  kind: DamageClass;
  projectile?: string;
  shootSpeed?: number;
  ammo?: AmmoType;
  manaCost?: number;
  spread?: number; // radians
  shots?: number;
  /** Melee blade length in px (drawn & hit-tested). */
  reach?: number;
  /** Melee swing also fires this projectile. */
  swingProjectile?: string;
  /** For summon weapons: number of minion slots used. */
  minionCost?: number;
  /** Inflicts this buff on hit. */
  onHit?: { buff: string; seconds: number; chance: number };
}

export interface ArmorStats {
  slot: 'head' | 'body' | 'legs';
  defense: number;
  set?: string;
  mods?: StatMods;
  /** Visual colours used to draw the armour on the player. */
  color: string;
  trim?: string;
}

export interface ConsumableStats {
  heal?: number;
  mana?: number;
  buffs?: { id: string; seconds: number }[];
  maxLifeUp?: number;
  maxManaUp?: number;
  recall?: boolean;
  /** Healing potions apply potion sickness. */
  sickness?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  description?: string;
  category: ItemCategory;
  rarity: number;
  maxStack: number;
  /** Base sell value in aurels. Shops charge 5×. */
  value: number;
  icon: IconSpec;
  useTime?: number;
  useStyle?: UseStyle;
  autoReuse?: boolean;
  placeTile?: string;
  placeWall?: string;
  tool?: ToolStats;
  weapon?: WeaponStats;
  armor?: ArmorStats;
  accessory?: StatMods;
  consumable?: ConsumableStats;
  ammo?: { type: AmmoType; damage: number; projectile: string; speedBonus?: number };
  summonBoss?: string;
  startsEvent?: string;
  /** Held item emits light (torches). */
  heldLight?: [number, number, number];
  /** Bucket-style liquid tool. */
  liquid?: { action: 'collect' } | { action: 'pour'; type: number };
  /** Custom utility handler id (e.g. 'recall'). */
  utility?: string;
  /** Creative/testing item: excluded from the obtainability audit, shown in the Creative panel. */
  cheat?: boolean;
}

export const RARITY_COLORS = [
  '#ffffff', // 0 common
  '#9aa0ff', // 1 blue
  '#8cff8c', // 2 green
  '#ffb070', // 3 orange
  '#ff7a7a', // 4 red
  '#ff80ff', // 5 pink
  '#c8a0ff', // 6 violet
  '#ffe16b', // 7 gold
  '#6bfff0', // 8 cyan (endgame)
] as const;

export const RARITY_NAMES = ['Common', 'Uncommon', 'Fine', 'Rare', 'Epic', 'Mythic', 'Arcane', 'Legendary', 'Celestial'];
