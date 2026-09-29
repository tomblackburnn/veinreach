import type { Appearance, Difficulty } from '../entities/player/Appearance';
import type { WorldMeta, WorldState } from '../world/WorldState';
import type { Slot } from '../items/ItemStack';

export interface CharacterSave {
  version: number;
  id: string;
  name: string;
  appearance: Appearance;
  difficulty: Difficulty;
  createdAt: number;
  lastPlayed: number;
  playTicks: number;
  deaths: number;
  baseLife: number;
  baseMana: number;
  life: number;
  mana: number;
  permadead: boolean;
  inventory: {
    main: Slot[];
    armor: Slot[];
    accessories: Slot[];
    ammo: Slot[];
    trash: Slot[];
    wallet: number;
    selected: number;
  };
  buffs: Record<string, number>;
}

export interface WorldRecord {
  id: string;
  meta: WorldMeta;
  state: WorldState;
}

/** A persisted modified chunk (raw typed-array buffers). */
export interface ChunkRecord {
  key: string;
  worldId: string;
  cx: number;
  cy: number;
  fg: ArrayBuffer;
  wall: ArrayBuffer;
  liquid: ArrayBuffer;
  liquidType: ArrayBuffer;
  frame: ArrayBuffer;
}

export interface ExploredRecord {
  key: string;
  worldId: string;
  cx: number;
  cy: number;
  /** RLE-encoded explored flags. */
  data: ArrayBuffer;
}
