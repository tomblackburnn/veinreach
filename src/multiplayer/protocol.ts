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

export const PROTOCOL_VERSION = 2;
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
}

export type ClientMsg =
  | { t: 'hello'; version: number; name: string; appearance: Appearance }
  | ({ t: 'state' } & PlayerState)
  | { t: 'tiles'; changes: number[] }
  | { t: 'liquid'; x: number; y: number; amount: number; type: number }
  | { t: 'chest'; chest: ChestData }
  | { t: 'paint'; painting: PaintingData }
  | { t: 'flag'; flag: string }
  | { t: 'chat'; text: string };

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
  | { t: 'time'; time: number; day: number };

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
