// Minimal IndexedDB wrapper (no external dependency) — DB name kept as
// 'lingua-flow' after the VISUS rebrand so existing user databases open in place.
const DB_NAME = 'lingua-flow'; const DB_VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('vocab')) { const s = db.createObjectStore('vocab', { keyPath: 'id' }); s.createIndex('lang', 'lang'); s.createIndex('lemma', 'lemma'); }
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('bookData')) db.createObjectStore('bookData', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('stats')) { const s = db.createObjectStore('stats', { keyPath: 'id' }); s.createIndex('date', 'date'); }
      if (!db.objectStoreNames.contains('dictCache')) db.createObjectStore('dictCache', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode); const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  }));
}
export const idb = {
  get: <T,>(store: string, key: string) => tx<T>(store, 'readonly', s => s.get(key) as IDBRequest<T>),
  put: (store: string, val: unknown) => tx(store, 'readwrite', s => s.put(val)),
  del: (store: string, key: string) => tx(store, 'readwrite', s => s.delete(key)),
  all: <T,>(store: string) => tx<T[]>(store, 'readonly', s => s.getAll() as unknown as IDBRequest<T[]>),
  clear: (store: string) => tx(store, 'readwrite', s => s.clear()),
  async byIndex<T>(store: string, index: string, value: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => { const req = db.transaction(store).objectStore(store).index(index).getAll(value); req.onsuccess = () => resolve(req.result as T[]); req.onerror = () => reject(req.error); });
  },
};
// Versioned migration manager. Rules: DB_VERSION only ever increases, every
// step is recorded in meta, a failed step leaves the previous version recorded
// so the next launch retries it, and the database is NEVER deleted/reset.
export interface MigrationStep { version: number; name: string; up: () => Promise<void>; }
export const MIGRATIONS: MigrationStep[] = [
  { version: 1, name: 'v1 baseline: vocab/books/bookData/stats/dictCache/meta stores', up: async () => { /* created by onupgradeneeded */ } },
];
export const MigrationManager = {
  async current(): Promise<number> {
    const meta = await idb.get<{ key: string; value: number }>('meta', 'schemaVersion').catch(() => undefined);
    return meta?.value ?? 0;
  },
  async run(): Promise<{ from: number; to: number; applied: string[] }> {
    const from = await this.current(); const applied: string[] = [];
    for (const step of MIGRATIONS.filter(m => m.version > from).sort((a, b) => a.version - b.version)) {
      try {
        await step.up();
        await idb.put('meta', { key: 'schemaVersion', value: step.version });
        await idb.put('meta', { key: `migration:${step.version}`, value: { name: step.name, at: Date.now(), ok: true } });
        applied.push(step.name);
      } catch (e) {
        await idb.put('meta', { key: `migration:${step.version}`, value: { name: step.name, at: Date.now(), ok: false, error: String(e) } }).catch(() => undefined);
        throw new Error(`Migration v${step.version} (${step.name}) failed and will retry on next launch: ${String(e)}`);
      }
    }
    if (!applied.length && from === 0) await idb.put('meta', { key: 'schemaVersion', value: DB_VERSION });
    return { from, to: await this.current(), applied };
  },
};
export async function migrateIfNeeded(): Promise<number> {
  const r = await MigrationManager.run(); return r.to;
}
