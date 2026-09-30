import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { getFirebase, friendlyError } from './client';
import { FirebaseTransport } from './FirebaseTransport';
import { randomRoomCode, encodeTile, encodeLiquid, posKey } from './codec';
import { NetworkManager, type Connection } from '../NetworkManager';
import { MAX_OWNED_ROOMS } from './account';
import { PROTOCOL_VERSION } from '../protocol';
import { WORLD_SIZES, DAY_TICKS, type WorldSizeKey } from '../../core/config';
import type { CharacterSave } from '../../save/types';
import type { ChestData, PaintingData } from '../../world/WorldState';
import { isPainted } from '../../world/paintings';

/** The signed-in player's username (required for online play). */
async function requireUsername(): Promise<{ fb: Awaited<ReturnType<typeof getFirebase>>; username: string }> {
  const fb = await getFirebase();
  const name = (await get(ref(fb.db, `users/${fb.uid}/name`))).val();
  if (typeof name !== 'string') throw new Error('Please choose a username first.');
  return { fb, username: name };
}

/** Create a new online world owned by this account (max 5) and return its room code. */
export async function createRoom(name: string, seed: string, size: WorldSizeKey): Promise<string> {
  const { fb, username } = await requireUsername();
  const owned = ((await get(ref(fb.db, `users/${fb.uid}/rooms`))).val() ?? {}) as Record<string, string>;
  const slot = ['1', '2', '3', '4', '5'].find((s) => !owned[s]);
  if (!slot) throw new Error(`You already own ${MAX_OWNED_ROOMS} online worlds. Delete one from the Multiplayer menu to make room.`);
  const meta = { name: name.slice(0, 32) || 'Online World', seed: seed.slice(0, 64), size: size in WORLD_SIZES ? size : 'medium', v: PROTOCOL_VERSION, owner: fb.uid, created: serverTimestamp(), slot };
  // Codes are random; the rules only allow creating a room that doesn't exist yet, so retry on a clash.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomRoomCode();
    try {
      await update(ref(fb.db), { [`rooms/${code}/meta`]: meta, [`users/${fb.uid}/rooms/${slot}`]: code });
    } catch (e) {
      if (attempt === 5) throw new Error(friendlyError(e));
      continue;
    }
    try {
      await set(ref(fb.db, `rooms/${code}/members/${fb.uid}`), { name: username, joined: serverTimestamp() });
      await set(ref(fb.db, `rooms/${code}/time`), { time: Math.floor(DAY_TICKS * (7.5 / 24)), day: 1 });
    } catch (e) {
      throw new Error(friendlyError(e));
    }
    return code;
  }
  throw new Error('Could not create an online world.');
}

export interface WorldUpload {
  /** [x, y, fg, frame, wall] quintuplets that differ from the freshly generated world. */
  tiles: number[];
  /** [x, y, amount, type] for liquids that differ. */
  liquids: number[];
  chests: ChestData[];
  paintings: PaintingData[];
  flags: string[];
  time: number;
  day: number;
}

/** Upload an existing world's changes into a freshly created room (host a local world online). */
export async function uploadWorld(code: string, size: WorldSizeKey, data: WorldUpload, onProgress: (p: number) => void): Promise<void> {
  const fb = await getFirebase();
  const base = ref(fb.db, `rooms/${code}`);
  const width = WORLD_SIZES[size].width;
  const paths: [string, unknown][] = [];
  for (let i = 0; i + 4 < data.tiles.length; i += 5) {
    const [x, y, fg, frame, wall] = data.tiles.slice(i, i + 5);
    paths.push([`tiles/${y * width + x}`, encodeTile(fg, frame, wall)]);
  }
  for (let i = 0; i + 3 < data.liquids.length; i += 4) {
    const [x, y, amount, type] = data.liquids.slice(i, i + 4);
    paths.push([`liquids/${y * width + x}`, encodeLiquid(amount, type)]);
  }
  // Every chest, including emptied ones, so joiners don't see regenerated loot.
  for (const c of data.chests) paths.push([`chests/${posKey(c.x, c.y)}`, JSON.stringify(c)]);
  for (const p of data.paintings) if (isPainted(p)) paths.push([`paintings/${posKey(p.x, p.y)}`, JSON.stringify({ w: p.w, h: p.h, px: p.px })]);
  for (const f of data.flags) if (/^[A-Za-z0-9:_-]{1,40}$/.test(f)) paths.push([`flags/${f}`, true]);
  paths.push(['time', { time: Math.floor(data.time), day: data.day }]);
  const BATCH = 4000;
  for (let i = 0; i < paths.length; i += BATCH) {
    const updates: Record<string, unknown> = {};
    for (const [k, v] of paths.slice(i, i + BATCH)) updates[k] = v;
    try {
      await update(base, updates);
    } catch (e) {
      throw new Error(friendlyError(e));
    }
    onProgress(Math.min(1, (i + BATCH) / paths.length));
  }
}

/** Join an online world by code. */
export async function connectRoom(code: string, c: CharacterSave): Promise<Connection> {
  const { fb, username } = await requireUsername();
  const t = new FirebaseTransport(fb, code, username);
  return NetworkManager.connectWith(t, c, 30000, 'Timed out joining the online world. Check your connection and try again.');
}

export { rememberRoom } from '../recentRooms';
