import { describe, it, expect } from 'vitest';
import { SaveManager } from '../src/save/SaveManager';
import { MemoryBackend } from '../src/save/backend';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { applyChunkRecord, chunkToRecord, encodeChunkRecord, decodeChunkRecord } from '../src/save/serialization';
import { validateCharacter, validateWorldRecord, SaveValidationError } from '../src/save/validation';
import { newCharacter } from '../src/core/playerSave';
import { defaultAppearance } from '../src/entities/player/Appearance';
import { defaultWorldState } from '../src/world/WorldState';
import type { WorldRecord } from '../src/save/types';
import { rleEncode, rleDecode } from '../src/utils/base64';

const opts = { name: 'SaveTest', seed: 'save-seed', width: 400, height: 260 };

function record(): WorldRecord {
  return {
    id: 'w1',
    meta: { id: 'w1', name: 'SaveTest', seed: opts.seed, size: 'small', width: opts.width, height: opts.height, createdAt: 1, lastPlayed: 1, version: 1, bossesDefeated: 0, unsealed: false },
    state: defaultWorldState(),
  };
}

describe('RLE', () => {
  it('round-trips arbitrary data', () => {
    const data = new Uint8Array(3000);
    for (let i = 0; i < data.length; i++) data[i] = i % 700 < 300 ? 0 : (i * 7) % 256;
    expect(Array.from(rleDecode(rleEncode(data), data.length))).toEqual(Array.from(data));
  });
});

describe('save system', () => {
  it('saves only modified chunks and restores them over a regenerated world', async () => {
    const saves = new SaveManager(new MemoryBackend());
    const a = generateWorldSync(opts).world;
    a.generating = false;
    a.setFg(10, 10, 3, 0);
    a.setFg(200, 100, 0, 0);
    a.setWall(201, 100, 4);
    const rec = record();
    rec.state.flags = ['boss:gravelmaw'];
    rec.state.chests = [{ x: 5, y: 5, items: [{ id: 'torch', count: 3 }, ...new Array(39).fill(null)] }];
    const written = await saves.saveWorld(rec, a, true);
    expect(written).toBe(a.modifiedChunks().length);
    expect(written).toBeLessThanOrEqual(3);

    const loaded = await saves.loadWorld('w1');
    const b = generateWorldSync(opts).world;
    for (const c of loaded.chunks) expect(applyChunkRecord(b, c)).toBe(true);
    expect(b.getFg(10, 10)).toBe(3);
    expect(b.getFg(200, 100)).toBe(0);
    expect(b.getWall(201, 100)).toBe(4);
    expect(loaded.record.state.flags).toEqual(['boss:gravelmaw']);
    expect(loaded.record.state.chests[0].items[0]).toEqual({ id: 'torch', count: 3 });
  });

  it('exports and imports worlds and characters', async () => {
    const saves = new SaveManager(new MemoryBackend());
    const w = generateWorldSync(opts).world;
    w.generating = false;
    w.setFg(50, 50, 28, 0);
    await saves.saveWorld(record(), w, true);
    const json = await saves.exportWorld('w1');
    const imported = await saves.importWorld(json);
    expect(imported.id).not.toBe('w1');
    const back = await saves.loadWorld(imported.id);
    const fresh = generateWorldSync(opts).world;
    for (const c of back.chunks) applyChunkRecord(fresh, c);
    expect(fresh.getFg(50, 50)).toBe(28);

    const c = newCharacter('Hero', defaultAppearance(), 'delver');
    await saves.saveCharacter(c);
    const cj = saves.exportCharacter(c);
    const ci = await saves.importCharacter(cj);
    expect(ci.name).toBe('Hero');
    expect(ci.difficulty).toBe('delver');
    expect((await saves.listCharacters()).length).toBe(2);
  });

  it('rejects garbage and sanitises bad fields', async () => {
    const saves = new SaveManager(new MemoryBackend());
    await expect(saves.importWorld('not json')).rejects.toBeInstanceOf(SaveValidationError);
    await expect(saves.importCharacter('{"format":"something-else"}')).rejects.toBeInstanceOf(SaveValidationError);
    expect(() => validateCharacter({ name: 'x' })).toThrow();
    const c = validateCharacter({ id: 'a', name: '  Bob  ', baseLife: 99999, inventory: { main: [{ id: 'nope', count: 1 }, { id: 'torch', count: 5000 }] }, appearance: { hairColor: 'javascript:alert(1)' } });
    expect(c.name).toBe('Bob');
    expect(c.baseLife).toBe(400);
    expect(c.inventory.main[0]).toBeNull();
    expect(c.inventory.main[1]!.count).toBe(999);
    expect(c.appearance.hairColor).toMatch(/^#/);
    expect(() => validateWorldRecord({ meta: {} })).toThrow();
  });

  it('skips corrupt chunk data instead of crashing', () => {
    const w = generateWorldSync(opts).world;
    const r = chunkToRecord('x', w.chunks[0]);
    r.fg = new ArrayBuffer(3);
    expect(applyChunkRecord(w, r)).toBe(false);
    const good = chunkToRecord('x', w.chunks[1]);
    const roundTrip = decodeChunkRecord('x', encodeChunkRecord(good));
    expect(new Uint16Array(roundTrip.fg)).toEqual(new Uint16Array(good.fg));
  });

  it('persists settings', async () => {
    const saves = new SaveManager(new MemoryBackend());
    const s = await saves.loadSettings();
    s.musicVolume = 0.1;
    await saves.saveSettings(s);
    expect((await saves.loadSettings()).musicVolume).toBe(0.1);
  });
});
