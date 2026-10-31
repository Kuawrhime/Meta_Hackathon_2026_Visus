import type { BookRecord, LangCode } from '../types';
import { idb } from '../storage/db';
// BookReaderService — local library. Book files live in IndexedDB; never uploaded.
export const BookReaderService = {
  async list(): Promise<BookRecord[]> { const rows = await idb.all<BookRecord>('books'); return rows.sort((a, b) => b.lastReadAt - a.lastReadAt); },
  async add(file: File, lang: LangCode): Promise<BookRecord> {
    const lower = file.name.toLowerCase();
    const format = lower.endsWith('.epub') ? 'epub' : lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.cbz') ? 'cbz' : 'txt';
    const id = 'book-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const buf = await file.arrayBuffer();
    const rec: BookRecord = { id, title: file.name.replace(/\.(epub|pdf|txt|cbz)$/i, ''), format, lang, progress: 0, chapter: 0, addedAt: Date.now(), lastReadAt: Date.now(), size: buf.byteLength, bookmarkCount: 0 };
    await idb.put('books', rec); await idb.put('bookData', { id, data: buf });
    return rec;
  },
  async data(id: string): Promise<ArrayBuffer | undefined> { const row = await idb.get<{ id: string; data: ArrayBuffer }>('bookData', id); return row?.data; },
  async update(id: string, patch: Partial<BookRecord>) { const ex = await idb.get<BookRecord>('books', id); if (ex) await idb.put('books', { ...ex, ...patch, lastReadAt: Date.now() }); },
  async remove(id: string) { await idb.del('books', id); await idb.del('bookData', id); },
  async setBookmark(id: string, delta: number) { const ex = await idb.get<BookRecord>('books', id); if (ex) await idb.put('books', { ...ex, bookmarkCount: Math.max(0, ex.bookmarkCount + delta) }); },
};
