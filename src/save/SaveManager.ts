import type { StorageBackend } from './backend';
import { MemoryBackend } from './backend';
import type { CharacterSave, ChunkRecord, ExploredRecord, WorldRecord } from './types';
import { validateCharacter, validateWorldRecord, SaveValidationError } from './validation';
import { chunkToRecord, exploredToRecord, encodeChunkRecord, decodeChunkRecord, type ExportedChunk } from './serialization';
import type { World } from '../world/World';
import { sanitizeSettings, type SettingsData } from '../core/Settings';
import { uid } from '../utils/dom';
import { SAVE_VERSION } from '../core/config';

export interface LoadedWorld {
  record: WorldRecord;
  chunks: ChunkRecord[];
  explored: ExploredRecord[];
}

/**
 * Persistence facade. Worlds are stored as seed + metadata + only the chunks
 * that differ from the procedural baseline, plus explored-map data.
 */
export class SaveManager {
  constructor(public backend: StorageBackend = new MemoryBackend()) {}

  get persistent(): boolean {
    return this.backend.persistent;
  }

  // ---- Characters ----
  async listCharacters(): Promise<CharacterSave[]> {
    const raw = await this.backend.getAll<unknown>('characters');
    const out: CharacterSave[] = [];
    for (const r of raw) {
      try {
        out.push(validateCharacter(r));
      } catch (e) {
        console.warn('[Save] skipping corrupt character', e);
      }
    }
    return out.sort((a, b) => b.lastPlayed - a.lastPlayed);
  }

  async saveCharacter(c: CharacterSave): Promise<void> {
    await this.backend.put('characters', { ...c, version: SAVE_VERSION });
  }

  async deleteCharacter(id: string): Promise<void> {
    await this.backend.delete('characters', id);
  }

  exportCharacter(c: CharacterSave): string {
    return JSON.stringify({ format: 'veinreach-character', version: SAVE_VERSION, character: c }, null, 1);
  }

  async importCharacter(json: string): Promise<CharacterSave> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new SaveValidationError('File is not valid JSON.');
    }
    const p = parsed as { format?: string; character?: unknown };
    if (p?.format !== 'veinreach-character') throw new SaveValidationError('This is not a Veinreach character file.');
    const c = validateCharacter(p.character);
    c.id = uid();
    await this.saveCharacter(c);
    return c;
  }

  // ---- Worlds ----
  async listWorlds(): Promise<WorldRecord[]> {
    const raw = await this.backend.getAll<unknown>('worlds');
    const out: WorldRecord[] = [];
    for (const r of raw) {
      try {
        out.push(validateWorldRecord(r));
      } catch (e) {
        console.warn('[Save] skipping corrupt world', e);
      }
    }
    return out.sort((a, b) => b.meta.lastPlayed - a.meta.lastPlayed);
  }

  async saveWorldRecord(rec: WorldRecord): Promise<void> {
    await this.backend.put('worlds', rec);
  }

  /** Save metadata/state plus dirty chunks (or all modified chunks when `full`). */
  async saveWorld(rec: WorldRecord, world: World, full = false): Promise<number> {
    const chunks: ChunkRecord[] = [];
    const explored: ExploredRecord[] = [];
    for (const c of world.chunks) {
      if (c.modified && (full || c.saveDirty)) {
        chunks.push(chunkToRecord(rec.id, c));
        c.saveDirty = false;
      }
      if (c.exploredDirty || (full && c.explored.some((v) => v))) {
        explored.push(exploredToRecord(rec.id, c));
        c.exploredDirty = false;
      }
    }
    await this.backend.putMany('chunks', chunks);
    await this.backend.putMany('explored', explored);
    await this.backend.put('worlds', rec);
    return chunks.length;
  }

  async loadWorld(id: string): Promise<LoadedWorld> {
    const raw = await this.backend.get<unknown>('worlds', id);
    if (!raw) throw new SaveValidationError('World not found.');
    const record = validateWorldRecord(raw);
    const chunks = await this.backend.getByWorld<ChunkRecord>('chunks', id);
    const explored = await this.backend.getByWorld<ExploredRecord>('explored', id);
    return { record, chunks, explored };
  }

  async deleteWorld(id: string): Promise<void> {
    await this.backend.deleteByWorld('chunks', id);
    await this.backend.deleteByWorld('explored', id);
    await this.backend.delete('worlds', id);
  }

  async exportWorld(id: string): Promise<string> {
    const { record, chunks } = await this.loadWorld(id);
    const out = { format: 'veinreach-world', version: SAVE_VERSION, record, chunks: chunks.map(encodeChunkRecord) };
    return JSON.stringify(out);
  }

  async importWorld(json: string): Promise<WorldRecord> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new SaveValidationError('File is not valid JSON.');
    }
    const p = parsed as { format?: string; record?: unknown; chunks?: unknown };
    if (p?.format !== 'veinreach-world') throw new SaveValidationError('This is not a Veinreach world file.');
    const rec = validateWorldRecord(p.record);
    const newId = uid();
    rec.id = newId;
    rec.meta.id = newId;
    rec.meta.name = `${rec.meta.name} (imported)`.slice(0, 32);
    const chunks: ChunkRecord[] = [];
    if (Array.isArray(p.chunks)) {
      for (const c of p.chunks as ExportedChunk[]) {
        try {
          if (typeof c.cx !== 'number' || typeof c.cy !== 'number') continue;
          chunks.push(decodeChunkRecord(newId, c));
        } catch (e) {
          console.warn('[Save] skipping bad chunk in import', e);
        }
      }
    }
    await this.backend.putMany('chunks', chunks);
    await this.saveWorldRecord(rec);
    return rec;
  }

  // ---- Settings ----
  async loadSettings(): Promise<SettingsData> {
    try {
      const r = await this.backend.get<{ key: string; data: unknown }>('settings', 'settings');
      return sanitizeSettings(r?.data);
    } catch {
      return sanitizeSettings(null);
    }
  }

  async saveSettings(s: SettingsData): Promise<void> {
    await this.backend.put('settings', { key: 'settings', data: s });
  }
}
