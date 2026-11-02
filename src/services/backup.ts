import type { BackupPayload } from '../types';
import { idb } from '../storage/db';
import { VocabularyService } from './vocabulary';
import { SettingsService } from './settings';
import { ReadingStatisticsService } from './stats';
import { BACKUP_FILENAME } from '../brand';
async function collect(): Promise<BackupPayload> {
  return { version: 1, exportedAt: Date.now(), vocab: await VocabularyService.all(), settings: await SettingsService.get(), stats: await ReadingStatisticsService.all(), books: await idb.all('books') };
}
async function aesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const BackupService = {
  async exportJSON(): Promise<string> { return JSON.stringify(await collect(), null, 2); },
  async exportEncrypted(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await aesKey(password, salt);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(await this.exportJSON()));
    // Format identifier kept as 'lingua-flow-encrypted' so encrypted backups made before the VISUS rebrand still decrypt.
    return JSON.stringify({ format: 'lingua-flow-encrypted', salt: b64(salt), iv: b64(iv), data: b64(cipher) });
  },
  async decryptBackup(text: string, password: string): Promise<string> {
    const obj = JSON.parse(text) as { salt: string; iv: string; data: string };
    const key = await aesKey(password, unb64(obj.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) as BufferSource }, key, unb64(obj.data) as BufferSource);
    return new TextDecoder().decode(plain);
  },
  async importJSON(text: string): Promise<{ added: number; skipped: number }> {
    // Validate before restoring anything: size, shape, then per-record checks.
    if (typeof text !== 'string' || text.length > 20_000_000) throw new Error('Backup too large (max 20 MB)');
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup: expected an object');
    const data = parsed as BackupPayload;
    if (!Array.isArray(data.vocab)) throw new Error('Invalid backup: missing vocab array');
    const res = await VocabularyService.importRecords(data.vocab);
    if (data.settings && typeof data.settings === 'object') await SettingsService.set(data.settings);
    for (const s of (Array.isArray(data.stats) ? data.stats : []).slice(0, 5000)) if (s && typeof s.date === 'string' && typeof s.lang === 'string') await idb.put('stats', { ...s, id: `${s.date}:${s.lang}` });
    if (Array.isArray(data.books)) for (const b of data.books.slice(0, 200)) if (b && typeof b === 'object' && typeof (b as { id?: unknown }).id === 'string') await idb.put('books', b);
    return res;
  },
  async autoBackup() { try { localStorage.setItem('lf:auto-backup', await this.exportJSON()); } catch { /* storage full */ } },
  download(filename: string, text: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
};
export const SyncService = {
  // Local-first sync stub: exports/imports via file; no server is contacted without explicit user action.
  exportToFile: async () => BackupService.download(BACKUP_FILENAME, await BackupService.exportJSON()),
  importFromText: (text: string) => BackupService.importJSON(text),
};
