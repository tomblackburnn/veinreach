/**
 * Compact encodings for Realtime Database room data. Tiles and liquids are
 * keyed by tile index (y * width + x) and stored as single numbers; chests,
 * paintings and player data are JSON strings (RTDB mangles arrays with nulls).
 */
import { ItemRegistry } from '../../items/ItemRegistry';
import type { ChestData } from '../../world/WorldState';
import type { Slot } from '../../items/ItemStack';
import type { PlayerState, PoseNet } from '../protocol';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_RE = /^[A-Z2-9]{6}$/;

export function randomRoomCode(): string {
  let s = '';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (const n of buf) s += ROOM_CODE_ALPHABET[n % ROOM_CODE_ALPHABET.length];
  return s;
}

/** Upper-case, drop spaces/dashes; null if it can't be a room code. */
export function normalizeRoomCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s-]/g, '');
  return ROOM_CODE_RE.test(s) ? s : null;
}

export const encodeTile = (fg: number, frame: number, wall: number): number => fg + frame * 65536 + wall * 16777216;
export const decodeTile = (v: number): [number, number, number] => [v % 65536, Math.floor(v / 65536) % 256, Math.floor(v / 16777216)];

export const encodeLiquid = (amount: number, type: number): number => amount + type * 256;
export const decodeLiquid = (v: number): [number, number] => [v % 256, Math.floor(v / 256)];

export const posKey = (x: number, y: number): string => `${x}_${y}`;
export function parsePosKey(k: string): [number, number] | null {
  const m = /^(\d{1,5})_(\d{1,5})$/.exec(k);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function parse(json: unknown): Record<string, unknown> | null {
  if (typeof json !== 'string') return null;
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Validate chest data from another player (ids and stack sizes). */
export function sanitizeChest(json: unknown): ChestData | null {
  const c = parse(json);
  if (!c || !Number.isInteger(c.x) || !Number.isInteger(c.y) || !Array.isArray(c.items)) return null;
  const items: Slot[] = new Array(40).fill(null);
  (c.items as unknown[]).slice(0, 40).forEach((s, i) => {
    const st = s as { id?: unknown; count?: unknown } | null;
    if (st && typeof st.id === 'string' && ItemRegistry.has(st.id) && typeof st.count === 'number' && st.count > 0) items[i] = { id: st.id, count: Math.min(Math.floor(st.count), ItemRegistry.get(st.id).maxStack) };
  });
  return { x: c.x as number, y: c.y as number, items, name: typeof c.name === 'string' ? c.name.slice(0, 24) : undefined };
}

export function sanitizeState(json: unknown): PlayerState | null {
  const s = parse(json);
  if (!s) return null;
  const nums = ['x', 'y', 'vx', 'vy', 'life', 'maxLife'] as const;
  if (!nums.every((k) => typeof s[k] === 'number' && isFinite(s[k] as number))) return null;
  const armor = Array.isArray(s.armor) ? (s.armor as unknown[]).slice(0, 3).map((a) => (typeof a === 'string' ? a : null)) : [];
  return {
    x: s.x as number,
    y: s.y as number,
    vx: s.vx as number,
    vy: s.vy as number,
    facing: s.facing === -1 ? -1 : 1,
    anim: typeof s.anim === 'string' ? s.anim.slice(0, 16) : 'idle',
    held: typeof s.held === 'string' ? s.held : null,
    armor,
    life: s.life as number,
    maxLife: s.maxLife as number,
    pose: Array.isArray(s.pose) && s.pose.length === 5 ? (s.pose as PoseNet) : null,
  };
}

export function parseInfo(json: unknown): { name: string; appearance: unknown } | null {
  const v = parse(json);
  if (!v || typeof v.name !== 'string') return null;
  return { name: v.name.slice(0, 24).replace(/[<>]/g, '') || 'Player', appearance: v.appearance };
}
