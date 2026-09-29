import type { CharacterSave, WorldRecord } from './types';
import { sanitizeAppearance, DIFFICULTIES, type Difficulty } from '../entities/player/Appearance';
import { WORLD_SIZES, type WorldSizeKey, SAVE_VERSION } from '../core/config';
import { defaultWorldState, type WorldState } from '../world/WorldState';
import { ItemRegistry } from '../items/ItemRegistry';
import type { Slot } from '../items/ItemStack';

export class SaveValidationError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number => (typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : d);
const str = (v: unknown, d: string, maxLen = 64): string => (typeof v === 'string' ? v.slice(0, maxLen) : d);

function slots(v: unknown, size: number): Slot[] {
  const out: Slot[] = new Array(size).fill(null);
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < Math.min(size, v.length); i++) {
    const s = v[i];
    if (isObj(s) && typeof s.id === 'string' && ItemRegistry.has(s.id) && typeof s.count === 'number' && s.count > 0) {
      out[i] = { id: s.id, count: Math.min(Math.floor(s.count), ItemRegistry.get(s.id).maxStack) };
    }
  }
  return out;
}

/** Validate & normalise a character from storage or an import file. Throws on unusable data. */
export function validateCharacter(raw: unknown): CharacterSave {
  if (!isObj(raw)) throw new SaveValidationError('Character data is not an object.');
  if (typeof raw.id !== 'string' || !raw.id) throw new SaveValidationError('Character is missing an id.');
  if (typeof raw.name !== 'string' || !raw.name.trim()) throw new SaveValidationError('Character is missing a name.');
  const inv = isObj(raw.inventory) ? raw.inventory : {};
  const diff = (typeof raw.difficulty === 'string' && raw.difficulty in DIFFICULTIES ? raw.difficulty : 'wanderer') as Difficulty;
  return {
    version: SAVE_VERSION,
    id: raw.id.slice(0, 64),
    name: raw.name.trim().slice(0, 24),
    appearance: sanitizeAppearance(raw.appearance),
    difficulty: diff,
    createdAt: num(raw.createdAt, Date.now()),
    lastPlayed: num(raw.lastPlayed, Date.now()),
    playTicks: num(raw.playTicks, 0, 0),
    deaths: num(raw.deaths, 0, 0),
    baseLife: num(raw.baseLife, 100, 100, 400),
    baseMana: num(raw.baseMana, 40, 40, 200),
    life: num(raw.life, 100, 1, 1000),
    mana: num(raw.mana, 40, 0, 1000),
    permadead: raw.permadead === true,
    inventory: {
      main: slots(inv.main, 50),
      armor: slots(inv.armor, 3),
      accessories: slots(inv.accessories, 5),
      ammo: slots(inv.ammo, 4),
      trash: slots(inv.trash, 1),
      wallet: num(inv.wallet, 0, 0, 1e9),
      selected: num(inv.selected, 0, 0, 9),
    },
    buffs: isObj(raw.buffs) ? (Object.fromEntries(Object.entries(raw.buffs).filter(([, v]) => typeof v === 'number')) as Record<string, number>) : {},
  };
}

function validateState(raw: unknown): WorldState {
  const d = defaultWorldState();
  if (!isObj(raw)) return d;
  d.time = num(raw.time, d.time, 0);
  d.day = num(raw.day, 1, 1);
  d.flags = Array.isArray(raw.flags) ? raw.flags.filter((f): f is string => typeof f === 'string') : [];
  d.bossKills = isObj(raw.bossKills) ? (Object.fromEntries(Object.entries(raw.bossKills).filter(([, v]) => typeof v === 'number')) as Record<string, number>) : {};
  if (isObj(raw.event) && typeof raw.event.id === 'string') d.event = { id: raw.event.id, progress: num(raw.event.progress, 0), goal: num(raw.event.goal, 0), ticks: num(raw.event.ticks, 0) };
  if (isObj(raw.weather)) d.weather = { kind: (str(raw.weather.kind, 'clear') as WorldState['weather']['kind']), remaining: num(raw.weather.remaining, 3600), intensity: num(raw.weather.intensity, 0, 0, 1) };
  d.npcs = Array.isArray(raw.npcs) ? raw.npcs.filter(isObj).map((n) => ({ defId: str(n.defId, ''), name: str(n.name, 'Stranger'), x: num(n.x, 0), y: num(n.y, 0), homeX: typeof n.homeX === 'number' ? n.homeX : null, homeY: typeof n.homeY === 'number' ? n.homeY : null })) : [];
  d.spawnX = num(raw.spawnX, 0);
  d.spawnY = num(raw.spawnY, 0);
  const pts = (v: unknown) => (isObj(v) ? (Object.fromEntries(Object.entries(v).filter(([, p]) => isObj(p) && typeof p.x === 'number' && typeof p.y === 'number')) as Record<string, { x: number; y: number }>) : {});
  d.playerSpawns = pts(raw.playerSpawns);
  d.playerPositions = pts(raw.playerPositions);
  d.structures = Array.isArray(raw.structures) ? raw.structures.filter(isObj).map((s) => ({ kind: str(s.kind, ''), name: str(s.name, ''), x: num(s.x, 0), y: num(s.y, 0), w: num(s.w, 0), h: num(s.h, 0), discovered: s.discovered === true })) : [];
  d.chests = Array.isArray(raw.chests) ? raw.chests.filter(isObj).map((c) => ({ x: num(c.x, 0), y: num(c.y, 0), items: slots(c.items, 40), name: typeof c.name === 'string' ? c.name.slice(0, 32) : undefined })) : [];
  d.drops = Array.isArray(raw.drops) ? raw.drops.filter((x): x is { id: string; count: number; x: number; y: number } => isObj(x) && typeof x.id === 'string' && ItemRegistry.has(x.id) && typeof x.count === 'number' && typeof x.x === 'number' && typeof x.y === 'number') : [];
  d.mutationCounter = num(raw.mutationCounter, 0);
  return d;
}

export function validateWorldRecord(raw: unknown): WorldRecord {
  if (!isObj(raw)) throw new SaveValidationError('World data is not an object.');
  const m = raw.meta;
  if (!isObj(m)) throw new SaveValidationError('World is missing metadata.');
  if (typeof m.seed !== 'string') throw new SaveValidationError('World is missing its seed.');
  const size = (typeof m.size === 'string' && m.size in WORLD_SIZES ? m.size : 'medium') as WorldSizeKey;
  const dims = WORLD_SIZES[size];
  const id = str(raw.id ?? m.id, '');
  if (!id) throw new SaveValidationError('World is missing an id.');
  return {
    id,
    meta: {
      id,
      name: str(m.name, 'Unnamed World', 32),
      seed: m.seed.slice(0, 64),
      size,
      width: dims.width,
      height: dims.height,
      createdAt: num(m.createdAt, Date.now()),
      lastPlayed: num(m.lastPlayed, Date.now()),
      version: SAVE_VERSION,
      bossesDefeated: num(m.bossesDefeated, 0, 0, 5),
      unsealed: m.unsealed === true,
    },
    state: validateState(raw.state),
  };
}
