import type { LangCode, VocabContext, VocabRecord, WordStatus } from '../types';
import { idb } from '../storage/db';
import { normalizeWord, lemmatize } from './segmentation';
import { checkLicenseForNewWord } from './license';
import { nextReviewDue } from './srs';
export const vocabId = (lang: LangCode, lemma: string) => `${lang}:${lemma}`;
export const VocabularyService = {
  async get(lang: LangCode, word: string): Promise<VocabRecord | undefined> {
    const lemma = lemmatize(word, lang);
    return (await idb.get<VocabRecord>('vocab', vocabId(lang, lemma))) ?? (await idb.get<VocabRecord>('vocab', vocabId(lang, normalizeWord(word, lang))));
  },
  async getByLemma(lang: LangCode, lemma: string) { return idb.get<VocabRecord>('vocab', vocabId(lang, lemma)); },
  async all(lang?: LangCode): Promise<VocabRecord[]> {
    const rows = await idb.all<VocabRecord>('vocab');
    return lang ? rows.filter(r => r.lang === lang) : rows;
  },
  async statusMap(lang: LangCode): Promise<Map<string, WordStatus>> {
    const rows = await this.all(lang); const m = new Map<string, WordStatus>();
    for (const r of rows) { m.set(r.lemma, r.status); m.set(r.word, r.status); }
    return m;
  },
  async encounter(lang: LangCode, word: string, source: VocabContext['source'] = 'web', contextText?: string): Promise<VocabRecord> {
    const lemma = lemmatize(word, lang); const w = normalizeWord(word, lang); const now = Date.now();
    const existing = await idb.get<VocabRecord>('vocab', vocabId(lang, lemma));
    const ctx = { source, text: contextText?.slice(0, 240), at: now };
    if (existing) { existing.encounters++; existing.lastSeen = now; existing.contexts = [...(existing.contexts ?? []), ctx].slice(-20); await idb.put('vocab', existing); return existing; }
    const gate = await checkLicenseForNewWord(lang);
    const rec: VocabRecord = { id: vocabId(lang, lemma), lang, word: w, lemma, status: gate.allowed ? 'new' : 'ignored', encounters: 1, firstSeen: now, lastSeen: now, contexts: [ctx], history: [{ status: gate.allowed ? 'new' : 'ignored', at: now }] };
    await idb.put('vocab', rec); return rec;
  },
  async setStatus(lang: LangCode, word: string, status: WordStatus): Promise<VocabRecord> {
    const lemma = lemmatize(word, lang); const w = normalizeWord(word, lang); const now = Date.now();
    const existing = await idb.get<VocabRecord>('vocab', vocabId(lang, lemma));
    const rec: VocabRecord = existing ?? { id: vocabId(lang, lemma), lang, word: w, lemma, status: 'new', encounters: 1, firstSeen: now, lastSeen: now };
    rec.status = status; rec.lastSeen = now;
    if (status === 'known') { if (!existing?.knownAt) rec.knownAt = now; } else { delete rec.knownAt; }
    rec.history = [...(existing?.history ?? []), { status, at: now }].slice(-50);
    rec.reviewDue = nextReviewDue(status, now);
    await idb.put('vocab', rec);
    try { window.dispatchEvent(new CustomEvent('lf:vocab-changed', { detail: { lang, lemma, status } })); } catch { /* noop */ }
    try { const bc = new BroadcastChannel('lingua-flow'); bc.postMessage({ type: 'vocab-changed', lang, lemma, status }); bc.close(); } catch { /* noop */ }
    return rec;
  },
  async setCustomDefinition(lang: LangCode, word: string, def: string) {
    const rec = await this.encounter(lang, word); rec.customDefinition = def; await idb.put('vocab', rec); return rec;
  },
  async addPhrase(lang: LangCode, phrase: string, status: WordStatus = 'new') {
    const now = Date.now(); const lemma = normalizeWord(phrase.trim(), lang) || phrase.trim().toLowerCase();
    const existing = await idb.get<VocabRecord>('vocab', vocabId(lang, lemma));
    if (existing) { existing.lastSeen = now; existing.isPhrase = true; await idb.put('vocab', existing); return existing; }
    const rec: VocabRecord = { id: vocabId(lang, lemma), lang, word: lemma, lemma, status, encounters: 1, firstSeen: now, lastSeen: now, isPhrase: true, contexts: [{ source: 'manual', at: now }], history: [{ status, at: now }] };
    await idb.put('vocab', rec); return rec;
  },
  async setNote(lang: LangCode, word: string, note: string) {
    const rec = await this.encounter(lang, word, 'manual'); rec.note = note.slice(0, 1000); await idb.put('vocab', rec); return rec;
  },
  async remove(lang: LangCode, word: string) { await idb.del('vocab', vocabId(lang, lemmatize(word, lang))); },
  async counts(lang: LangCode) {
    const rows = await this.all(lang);
    const c = { total: rows.length, new: 0, learning: 0, known: 0, ignored: 0, l1: 0, l2: 0, l3: 0, l4: 0 };
    for (const r of rows) { if (r.status === 'new') c.new++; else if (r.status === 'known') c.known++; else if (r.status === 'ignored') c.ignored++; else { c.learning++; (c as Record<string, number>)[r.status]++; } }
    return c;
  },
  async importRecords(records: VocabRecord[]): Promise<{ added: number; skipped: number }> {
    let added = 0, skipped = 0;
    const STATUSES: WordStatus[] = ['new', 'l1', 'l2', 'l3', 'l4', 'known', 'ignored'];
    for (const r of records.slice(0, 100000)) {
      // Validate before trusting imported records (no prototype pollution, no malformed rows).
      if (!r || typeof r !== 'object' || typeof r.word !== 'string' || typeof r.lemma !== 'string' || typeof r.lang !== 'string' || !STATUSES.includes(r.status)) { skipped++; continue; }
      const id = vocabId(r.lang, normalizeWord(r.lemma, r.lang) || r.lemma);
      const clean: VocabRecord = { id, lang: r.lang, word: String(r.word).slice(0, 200), lemma: String(r.lemma).slice(0, 200), status: r.status, encounters: Math.max(1, Math.min(1_000_000, Number(r.encounters) || 1)), firstSeen: Number(r.firstSeen) || Date.now(), lastSeen: Number(r.lastSeen) || Date.now(), customDefinition: typeof r.customDefinition === 'string' ? r.customDefinition.slice(0, 1000) : undefined, note: typeof r.note === 'string' ? r.note.slice(0, 1000) : undefined, isPhrase: !!r.isPhrase };
      const ex = await idb.get('vocab', clean.id); if (ex) { skipped++; continue; } await idb.put('vocab', clean); added++;
    }
    return { added, skipped };
  },
};
