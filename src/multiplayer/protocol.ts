/**
 * Wire protocol shared by the browser client and the Node server (JSON over
 * WebSocket). Tile edits are sent as flat arrays of
 * [x, y, fg, frame, wall] quintuplets produced by the client that made them;
 * the server validates and relays them.
 */
import type { Appearance } from '../entities/player/Appearance';
import type { ExportedChunk } from '../save/serialization';
import type { ChestData, PaintingData } from '../world/WorldState';
import type { WorldSizeKey } from '../core/config';

export const PROTOCOL_VERSION = 3;
export const MAX_PLAYERS = 8;

export interface PlayerInfo {
  id: number;
  name: string;
  appearance: Appearance;
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: string;
  held: string | null;
  armor: (string | null)[];
  life: number;
  maxLife: number;
  pose?: PoseNet | null;
}

/** Held-item pose so others see swings and aiming: [armAngle, itemId, style, angle, scale]. */
export type PoseNet = [number | null, string | null, 'swing' | 'hold' | 'aim' | 'thrust', number, number];

/**
 * A creature simulated by one player's game (its owner), mirrored on the
 * others. `n` is a network id: "<owner tag>.<counter>".
 */
export interface MobSnap {
  n: string;
  /** Enemy def id, or boss id when `boss` is set. */
  id: string;
  boss?: 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  f: 1 | -1;
  l: number;
  ml: number;
  /** AI state name (drives the sprite). */
  s: string;
  /** Contact damage and defense (after world scaling). */
  dm: number;
  df: number;
  g?: 1;
  /** hittable = false */
  h?: 0;
  /** harmful = false */
  hm?: 0;
  bx?: BossNet;
}

export interface BossNet {
  ph: number;
  at: string;
  aT: number;
  sh: number;
  dy: number;
  /** Fleeing (lost interest / dawn): harmless and unhittable while it leaves. */
  fl?: number;
  hz: HazardNet[];
  ex?: Record<string, number | boolean>;
}

export interface HazardNet {
  k: 'spike' | 'beam' | 'ring' | 'column' | 'burst';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  w?: number;
  wa: number;
  ac: number;
  ag: number;
  d: number;
  c: string;
  pm?: 1;
}

export type MobEvent =
  /** A player hit someone else's creature: the owner applies exactly `d` damage. */
  | { k: 'hit'; n: string; d: number; kb: number; dx: number; c?: 1; b?: string; bs?: number }
  /** An owned creature died; `by` is the killer's tag (they roll the loot). */
  | { k: 'die'; n: string; by: string | null; boss?: string; x: number; y: number }
  /** A projectile was fired (players' shots are visual-only on other screens). */
  | { k: 'proj'; id: string; x: number; y: number; vx: number; vy: number; d: number; kb: number; fr: 0 | 1; sc?: number; ow?: string; ob?: { buff: string; seconds: number; chance: number } };

export type ClientMsg =
  | { t: 'hello'; version: number; name: string; appearance: Appearance }
  | ({ t: 'state' } & PlayerState)
  | { t: 'tiles'; changes: number[] }
  | { t: 'liquid'; x: number; y: number; amount: number; type: number }
  | { t: 'chest'; chest: ChestData }
  | { t: 'paint'; painting: PaintingData }
  | { t: 'flag'; flag: string }
  | { t: 'chat'; text: string }
  | { t: 'mobs'; tag: string; list: MobSnap[] }
  | { t: 'ev'; tag: string; ev: MobEvent[] };

export type ServerMsg =
  | {
      t: 'welcome';
      id: number;
      world: { name: string; seed: string; size: WorldSizeKey };
      chunks: ExportedChunk[];
      chests: ChestData[];
      paintings: PaintingData[];
      /** Individual tile edits as [x, y, fg, frame, wall] quintuplets (Firebase rooms). */
      tiles?: number[];
      /** Liquids as [x, y, amount, type] quadruplets (Firebase rooms). */
      liquids?: number[];
      time: number;
      day: number;
      flags: string[];
      /** -1 when the client should use the spawn from its own world generation. */
      spawnX: number;
      spawnY: number;
      players: PlayerInfo[];
    }
  | { t: 'reject'; reason: string }
  | { t: 'join'; player: PlayerInfo }
  | { t: 'leave'; id: number }
  | ({ t: 'state'; id: number } & PlayerState)
  | { t: 'tiles'; id: number; changes: number[] }
  | { t: 'liquid'; x: number; y: number; amount: number; type: number }
  | { t: 'chest'; chest: ChestData }
  | { t: 'paint'; painting: PaintingData }
  | { t: 'flag'; flag: string }
  | { t: 'chat'; id: number; name: string; text: string }
  | { t: 'time'; time: number; day: number }
  | { t: 'mobs'; tag: string; list: MobSnap[] }
  | { t: 'ev'; tag: string; ev: MobEvent[] };

export function encode(m: ClientMsg | ServerMsg): string {
  return JSON.stringify(m);
}

export function decode<T>(data: string): T | null {
  try {
    const v = JSON.parse(data) as T;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}
