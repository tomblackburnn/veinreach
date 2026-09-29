import type { Slot } from '../items/ItemStack';
import type { WorldSizeKey } from '../core/config';

export interface ChestData {
  x: number;
  y: number;
  items: Slot[];
  name?: string;
}

export interface StructureInfo {
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  discovered: boolean;
}

export interface SavedNPC {
  defId: string;
  name: string;
  x: number;
  y: number;
  homeX: number | null;
  homeY: number | null;
}

export interface ActiveEvent {
  id: string;
  progress: number;
  goal: number;
  ticks: number;
}

export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'sandstorm' | 'veilstorm';

export interface WorldMeta {
  id: string;
  name: string;
  seed: string;
  size: WorldSizeKey;
  width: number;
  height: number;
  createdAt: number;
  lastPlayed: number;
  version: number;
  /** Summary for the world list. */
  bossesDefeated: number;
  unsealed: boolean;
}

/** All mutable non-tile world state that is persisted. */
export interface WorldState {
  time: number;
  day: number;
  flags: string[];
  bossKills: Record<string, number>;
  event: ActiveEvent | null;
  weather: { kind: WeatherKind; remaining: number; intensity: number };
  npcs: SavedNPC[];
  spawnX: number;
  spawnY: number;
  playerSpawns: Record<string, { x: number; y: number }>;
  playerPositions: Record<string, { x: number; y: number }>;
  structures: StructureInfo[];
  chests: ChestData[];
  drops: { id: string; count: number; x: number; y: number }[];
  /** Deterministic counter so post-generation world changes can be seeded. */
  mutationCounter: number;
}

export function defaultWorldState(): WorldState {
  return {
    time: 0,
    day: 1,
    flags: [],
    bossKills: {},
    event: null,
    weather: { kind: 'clear', remaining: 60 * 60 * 3, intensity: 0 },
    npcs: [],
    spawnX: 0,
    spawnY: 0,
    playerSpawns: {},
    playerPositions: {},
    structures: [],
    chests: [],
    drops: [],
    mutationCounter: 0,
  };
}
