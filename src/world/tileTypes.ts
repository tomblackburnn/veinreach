/** Type definitions for tiles and walls. Content lives in src/data/tiles.ts & walls.ts. */

export type ToolKind = 'pickaxe' | 'axe' | 'hammer' | 'any';
export type TileSound = 'soil' | 'stone' | 'wood' | 'plant' | 'glass' | 'metal' | 'crystal' | 'cloth';
/** 'wall': every cell needs a background wall behind it (paintings). */
export type SupportRule = 'none' | 'floor' | 'ceiling' | 'attach' | 'wall';
export type FurnitureTag = 'chair' | 'table' | 'door' | 'light' | 'bed' | 'chest' | 'station';

/** Procedural texture recipe. Colours are hex strings. */
export type TextureKind =
  | 'soil'
  | 'stone'
  | 'sand'
  | 'grass'
  | 'ore'
  | 'brick'
  | 'planks'
  | 'leaves'
  | 'crystal'
  | 'ice'
  | 'glass'
  | 'moss'
  | 'ash'
  | 'stained'
  | 'sprite';

export interface TextureSpec {
  kind: TextureKind;
  base: string;
  dark?: string;
  light?: string;
  /** Secondary colour: ore fleck, grass colour, mortar colour... */
  accent?: string;
  /** For 'ore' textures: the host rock texture colours. */
  host?: string;
}

export interface TileDef {
  id: number;
  key: string;
  name: string;
  /** Mining effort multiplier. 1 = standard stone. 0 = breaks instantly. */
  hardness: number;
  tool: ToolKind;
  /** Minimum tool power required to break (pickaxe power for most tiles). */
  toolPower: number;
  solid: boolean;
  platform?: boolean;
  /** Lets light through at full strength (non-solid tiles are always transparent). */
  transparent?: boolean;
  light?: [number, number, number];
  /** Item id dropped when broken; null for no drop. Defaults to none. */
  drop?: string | null;
  dropCount?: [number, number];
  texture: TextureSpec;
  mapColor: string;
  sound: TileSound;
  biome?: string;
  /** Multi-tile footprint (width × height in tiles). */
  size?: [number, number];
  support?: SupportRule;
  furniture?: FurnitureTag[];
  /** Crafting station tag this tile provides. */
  station?: string;
  /** Plants and similar: can be overwritten by placement; destroyed by any tool swing. */
  cuttable?: boolean;
  /** Touch damage to actors overlapping it. */
  contactDamage?: number;
  /** Grass tiles: soil tile they revert to when covered / spread onto. */
  grassOf?: string;
  /** World flag required before the tile can be mined. */
  lockedUntil?: string;
  /** Slows actors inside (cobweb, mud-ish). 1 = no slow. */
  drag?: number;
  climbable?: boolean;
  /** Treat like solid for housing enclosure (doors, platforms). */
  housingBoundary?: boolean;
  /** Tile that is drawn larger than one cell (tree crowns) — renderer handles specially. */
  overlaySprite?: boolean;
  /** Blocks do not draw exposed-edge outlines (e.g. decorations). */
  noEdges?: boolean;
  /** Comfort points this kind of object adds to a room (each kind counts once). */
  comfort?: number;
  /** Stained glass: multiplies light passing through it, per channel. */
  tint?: [number, number, number];
}

export interface WallDef {
  id: number;
  key: string;
  name: string;
  texture: TextureSpec;
  mapColor: string;
  drop?: string | null;
  /** Naturally generated walls don't count for NPC housing. */
  natural: boolean;
}
