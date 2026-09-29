/**
 * Storage backends. The game uses IndexedDB; tests (and browsers where
 * IndexedDB is blocked) use the in-memory backend.
 */
export type StoreName = 'characters' | 'worlds' | 'chunks' | 'explored' | 'settings';

export interface StorageBackend {
  readonly persistent: boolean;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T extends object>(store: StoreName, value: T): Promise<void>;
  putMany<T extends object>(store: StoreName, values: T[]): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  getAll<T>(store: StoreName): Promise<T[]>;
  getByWorld<T>(store: 'chunks' | 'explored', worldId: string): Promise<T[]>;
  deleteByWorld(store: 'chunks' | 'explored', worldId: string): Promise<void>;
}

const KEY_PATH: Record<StoreName, string> = { characters: 'id', worlds: 'id', chunks: 'key', explored: 'key', settings: 'key' };

export class MemoryBackend implements StorageBackend {
  readonly persistent = false;
  private stores = new Map<StoreName, Map<string, unknown>>();

  private s(name: StoreName): Map<string, unknown> {
    let m = this.stores.get(name);
    if (!m) {
      m = new Map();
      this.stores.set(name, m);
    }
    return m;
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return structuredClone(this.s(store).get(key)) as T | undefined;
  }

  async put<T extends object>(store: StoreName, value: T): Promise<void> {
    this.s(store).set(String((value as Record<string, unknown>)[KEY_PATH[store]]), structuredClone(value));
  }

  async putMany<T extends object>(store: StoreName, values: T[]): Promise<void> {
    for (const v of values) await this.put(store, v);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.s(store).delete(key);
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return [...this.s(store).values()].map((v) => structuredClone(v) as T);
  }

  async getByWorld<T>(store: 'chunks' | 'explored', worldId: string): Promise<T[]> {
    return [...this.s(store).values()].filter((v) => (v as { worldId: string }).worldId === worldId).map((v) => structuredClone(v) as T);
  }

  async deleteByWorld(store: 'chunks' | 'explored', worldId: string): Promise<void> {
    const m = this.s(store);
    for (const [k, v] of m) if ((v as { worldId: string }).worldId === worldId) m.delete(k);
  }
}

const DB_NAME = 'veinreach';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

export class IDBBackend implements StorageBackend {
  readonly persistent = true;
  private constructor(private db: IDBDatabase) {}

  static async open(): Promise<IDBBackend> {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const name of ['characters', 'worlds', 'settings'] as StoreName[]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: KEY_PATH[name] });
      for (const name of ['chunks', 'explored'] as StoreName[]) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: 'key' });
          s.createIndex('worldId', 'worldId', { unique: false });
        }
      }
    };
    const db = await req(r);
    return new IDBBackend(db);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return (await req(this.db.transaction(store).objectStore(store).get(key))) as T | undefined;
  }

  async put<T extends object>(store: StoreName, value: T): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await done(tx);
  }

  async putMany<T extends object>(store: StoreName, values: T[]): Promise<void> {
    if (!values.length) return;
    const tx = this.db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    for (const v of values) s.put(v);
    await done(tx);
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await done(tx);
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return (await req(this.db.transaction(store).objectStore(store).getAll())) as T[];
  }

  async getByWorld<T>(store: 'chunks' | 'explored', worldId: string): Promise<T[]> {
    return (await req(this.db.transaction(store).objectStore(store).index('worldId').getAll(worldId))) as T[];
  }

  async deleteByWorld(store: 'chunks' | 'explored', worldId: string): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    const idx = tx.objectStore(store).index('worldId');
    const keys = await req(idx.getAllKeys(worldId));
    for (const k of keys) tx.objectStore(store).delete(k);
    await done(tx);
  }
}
