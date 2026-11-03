import { idb } from './db';
import type { BookRecord, Settings, StatDay, VocabRecord } from '../types';
import { SettingsService } from '../services/settings';

// Repository layer over IndexedDB (Phase 8). User vocabulary, dictionary cache,
// settings, reading history and learning activity stay in separate stores;
// dictionary *datasets* live in versioned files, never mixed into user stores.
export const VocabularyRepository = {
  get: (id: string) => idb.get<VocabRecord>('vocab', id),
  put: (r: VocabRecord) => idb.put('vocab', r),
  all: () => idb.all<VocabRecord>('vocab'),
  byLang: (lang: string) => idb.byIndex<VocabRecord>('vocab', 'lang', lang),
  delete: (id: string) => idb.del('vocab', id),
};
export const DictionaryRepository = {
  getCached: (id: string) => idb.get('dictCache', id),
  putCached: (id: string, value: unknown) => idb.put('dictCache', { id, value, at: Date.now() }),
};
export const UserSettingsRepository = {
  get: (): Promise<Settings> => SettingsService.get(),
  set: (patch: Partial<Settings>) => SettingsService.set(patch),
};
export const ReadingHistoryRepository = {
  async list<T>(): Promise<T[]> { const h = await idb.get<{ key: string; value: T[] }>('meta', 'readingHistory'); return h?.value ?? []; },
  save: (items: unknown[]) => idb.put('meta', { key: 'readingHistory', value: items.slice(0, 20) }),
};
export const LearningActivityRepository = {
  all: () => idb.all<StatDay>('stats'),
  put: (s: StatDay) => idb.put('stats', s),
};
export const BooksRepository = {
  all: () => idb.all<BookRecord>('books'),
  put: (b: BookRecord) => idb.put('books', b),
  delete: (id: string) => idb.del('books', id),
};
