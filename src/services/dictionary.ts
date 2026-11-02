import type { DictCharacter, DictEntry, LangCode } from '../types';
import { normalizeWord, lemmatize, registerZhWords, toSimplified, toTraditional } from './segmentation';
import { registerProvider, type DictionaryProvider } from '../dictionary/providers';
import { DATASETS } from '../dictionary/datasets';

type RawRow = [string, string, string, string, string, string, string, number, string[]?];
const loaders: Partial<Record<LangCode, () => Promise<RawRow[]>>> = {
  en: () => import('../dictionary/data/en.json').then(m => (m.default as unknown) as RawRow[]),
  fr: () => import('../dictionary/data/fr.json').then(m => (m.default as unknown) as RawRow[]),
  es: () => import('../dictionary/data/es.json').then(m => (m.default as unknown) as RawRow[]),
  de: () => import('../dictionary/data/de.json').then(m => (m.default as unknown) as RawRow[]),
  it: () => import('../dictionary/data/it.json').then(m => (m.default as unknown) as RawRow[]),
  pt: () => import('../dictionary/data/pt.json').then(m => (m.default as unknown) as RawRow[]),
  nl: () => import('../dictionary/data/nl.json').then(m => (m.default as unknown) as RawRow[]),
  ja: () => import('../dictionary/data/ja.json').then(m => (m.default as unknown) as RawRow[]),
  zh: () => import('../dictionary/data/zh.json').then(m => (m.default as unknown) as RawRow[]),
  ko: () => import('../dictionary/data/ko.json').then(m => (m.default as unknown) as RawRow[]),
  ru: () => import('../dictionary/data/ru.json').then(m => (m.default as unknown) as RawRow[]),
  ar: () => import('../dictionary/data/ar.json').then(m => (m.default as unknown) as RawRow[]),
  sv: () => import('../dictionary/data/sv.json').then(m => (m.default as unknown) as RawRow[]),
  da: () => import('../dictionary/data/da.json').then(m => (m.default as unknown) as RawRow[]),
  no: () => import('../dictionary/data/no.json').then(m => (m.default as unknown) as RawRow[]),
  fi: () => import('../dictionary/data/fi.json').then(m => (m.default as unknown) as RawRow[]),
  pl: () => import('../dictionary/data/pl.json').then(m => (m.default as unknown) as RawRow[]),
  uk: () => import('../dictionary/data/uk.json').then(m => (m.default as unknown) as RawRow[]),
  el: () => import('../dictionary/data/el.json').then(m => (m.default as unknown) as RawRow[]),
  tr: () => import('../dictionary/data/tr.json').then(m => (m.default as unknown) as RawRow[]),
  id: () => import('../dictionary/data/id.json').then(m => (m.default as unknown) as RawRow[]),
  vi: () => import('../dictionary/data/vi.json').then(m => (m.default as unknown) as RawRow[]),
  th: () => import('../dictionary/data/th.json').then(m => (m.default as unknown) as RawRow[]),
  yue: () => import('../dictionary/data/yue.json').then(m => (m.default as unknown) as RawRow[]),
};
const zhExtra: () => Promise<RawRow[]> = () => import('../dictionary/data/zh.extra.json').then(m => (m.default as unknown) as RawRow[]);

interface LangIndex { canonical: Map<string, DictEntry>; alias: Map<string, string>; pinyin: Map<string, DictEntry[]>; }
const MAX_CACHED_LANGS = 24;
const MAX_LOOKUP_CACHE = 5000;
const cache = new Map<LangCode, LangIndex>();
const loadOrder: LangCode[] = [];
const customCache = new Map<LangCode, Map<string, DictEntry>>();
const lookupCache = new Map<string, DictEntry | undefined>();

export const pinyinKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/g, 'u').replace(/[^a-z0-9]/gi, '').toLowerCase();
const entryId = (lang: LangCode, lemma: string) => `${lang}:${lemma}`;

function senseOf(r: RawRow, providerId: string) {
  return { definition: r[4], pos: r[3] || undefined, translation: r[5] && r[5] !== r[0] ? r[5] : undefined, examples: r[6] ? [r[6]] : [], source: providerId };
}
function mergeInto(e: DictEntry, r: RawRow, providerId: string): DictEntry {
  // Source-aware merging: never let a later, poorer row overwrite a richer entry.
  const sense = senseOf(r, providerId);
  e.senses = e.senses ?? [{ definition: e.definition, pos: e.pos, translation: e.translation !== e.word ? e.translation : undefined, examples: e.examples, source: e.providerId }];
  if (!e.senses.some(s => s.definition === sense.definition && s.pos === sense.pos)) e.senses.push(sense);
  if (r[2] && r[2] !== e.phonetic) { e.alternateReadings = [...new Set([...(e.alternateReadings ?? []), ...(e.phonetic ? [e.phonetic] : []), r[2]])]; }
  e.examples = [...new Set([...e.examples, ...(r[6] ? [r[6]] : [])])];
  e.frequency = Math.min(e.frequency, r[7] ?? 9999);
  e.forms = [...new Set([...(e.forms ?? []), ...(r[8] ?? [])])];
  return e;
}
function toCanonical(r: RawRow, lang: LangCode, providerId: string): DictEntry {
  const lemma = normalizeWord(r[1] || r[0], lang);
  return {
    id: entryId(lang, lemma), lang, word: r[0], lemma,
    phonetic: r[2] || undefined, pronunciation: r[2] || undefined, pos: r[3] || undefined,
    definition: r[4], translation: r[5], examples: r[6] ? [r[6]] : [], frequency: r[7] ?? 9999, forms: r[8] ?? [],
    senses: [senseOf(r, providerId)], alternateReadings: [], alternateSpellings: [],
    simplified: lang === 'zh' || lang === 'yue' ? toSimplified(r[0]) : undefined,
    traditional: lang === 'zh' || lang === 'yue' ? toTraditional(toSimplified(r[0])) : undefined,
    providerId, licenseId: providerId === 'bundled-zh-supplement' ? 'visus-zh-reference-supplement' : 'visus-bundled-legacy',
  };
}
function withCharacters(e: DictEntry, idx: LangIndex, lang: LangCode): DictEntry {
  if (lang !== 'zh' && lang !== 'yue') return e;
  const chars: DictCharacter[] = [...toSimplified(e.word)].map(ch => {
    const ce = idx.canonical.get(ch);
    return { char: ch, simplified: toSimplified(ch), traditional: toTraditional(toSimplified(ch)), phonetic: ce?.phonetic, definition: ce?.definition };
  });
  return { ...e, characters: chars };
}
async function ensure(lang: LangCode): Promise<LangIndex> {
  const hit = cache.get(lang); if (hit) return hit;
  const idx: LangIndex = { canonical: new Map(), alias: new Map(), pinyin: new Map() };
  const addRows = (rows: RawRow[], providerId: string) => {
    for (const r of rows) {
      if (!Array.isArray(r) || typeof r[0] !== 'string' || typeof r[4] !== 'string') continue;
      const lemmaKey = normalizeWord(r[1] || r[0], lang);
      const existing = idx.canonical.get(lemmaKey);
      const e = existing ? mergeInto(existing, r, providerId) : toCanonical(r, lang, providerId);
      idx.canonical.set(lemmaKey, e);
      idx.alias.set(normalizeWord(e.word, lang), lemmaKey); idx.alias.set(lemmaKey, lemmaKey);
      for (const f of e.forms ?? []) idx.alias.set(normalizeWord(f, lang), lemmaKey);
      if (e.phonetic) { const pk = pinyinKey(e.phonetic); const arr = idx.pinyin.get(pk) ?? []; if (!arr.includes(e)) arr.push(e); idx.pinyin.set(pk, arr); }
    }
  };
  const loader = loaders[lang];
  if (loader) {
    try {
      addRows(await loader(), 'bundled');
      if (lang === 'zh') { try { addRows(await zhExtra(), 'bundled-zh-supplement'); } catch { /* supplement optional */ } }
      if (lang === 'zh' || lang === 'yue') registerZhWords(idx.canonical.keys());
    } catch { /* dictionary not bundled for this language yet */ }
  }
  cache.set(lang, idx); loadOrder.push(lang);
  while (loadOrder.length > MAX_CACHED_LANGS) { const old = loadOrder.shift()!; if (old !== lang) cache.delete(old); }
  return idx;
}
function resolve(idx: LangIndex, lang: LangCode, word: string): DictEntry | undefined {
  const w = normalizeWord(word, lang);
  const key = idx.alias.get(w) ?? idx.alias.get(lemmatize(word, lang));
  const e = key ? idx.canonical.get(key) : undefined;
  return e ? withCharacters(e, idx, lang) : undefined;
}
function rankEntries(a: DictEntry, b: DictEntry): number {
  return (a.senses?.length ?? 1) !== (b.senses?.length ?? 1) ? (b.senses?.length ?? 1) - (a.senses?.length ?? 1) : a.frequency - b.frequency;
}

// ---- External licensed datasets: lazy sharded loading (Phase 9) ----
// Shards live in public/dictionaries/<dataset>/ (generated, never hand-edited).
// Only the shard for the looked-up word is fetched; indexes and shards are
// LRU-cached. In unit tests / offline, fetches simply fail and the bundled
// dictionaries keep working.
export const EXTERNAL_BY_LANG: Partial<Record<LangCode, Array<{ dataset: string; providerId: string }>>> = {
  zh: [{ dataset: 'cc-cedict', providerId: 'cc-cedict' }],
  ja: [{ dataset: 'jmdict', providerId: 'jmdict' }],
  ko: [{ dataset: 'wiktionary', providerId: 'wiktionary' }],
  // FreeDict eng-* pairs are English->foreign translations, not English
  // definitions, so English lookups use WordNet only (FreeDict serves fr/de/es/it).
  en: [{ dataset: 'wordnet', providerId: 'wordnet' }],
  fr: [{ dataset: 'freedict-fr', providerId: 'freedict' }],
  de: [{ dataset: 'freedict-de', providerId: 'freedict' }],
  es: [{ dataset: 'freedict-es', providerId: 'freedict' }],
  it: [{ dataset: 'freedict-it', providerId: 'freedict' }],
};
const HAN_LANGS = new Set(['zh', 'ja', 'ko', 'yue']);
export function shardKeyFor(word: string, lang: LangCode): string {
  const w = lang === 'zh' || lang === 'yue' ? toSimplified(word.trim()) : word.trim();
  if (!w) return 'other';
  if (HAN_LANGS.has(lang)) return 'c' + w.codePointAt(0)!.toString(16);
  const ch = w[0].toLowerCase();
  return /[a-zà-ÿа-яa-ö]/.test(ch) ? ch : 'other';
}
function dictAsset(path: string): string {
  const g = globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } }; browser?: { runtime?: { getURL?: (p: string) => string } } };
  const rt = g.chrome?.runtime ?? g.browser?.runtime;
  try { if (rt?.getURL) return rt.getURL(path); } catch { /* not an extension context */ }
  return path;
}
interface ExtIndex { shards: Record<string, string>; entries: number; version: string; license: string; attribution: string; }
const extIndexCache = new Map<string, Promise<ExtIndex | null>>();
const extShardCache = new Map<string, Map<string, DictEntry>>();
function fetchJson(url: string): Promise<unknown> {
  if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
  return fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<unknown>; });
}
function loadExtIndex(dataset: string): Promise<ExtIndex | null> {
  let p = extIndexCache.get(dataset);
  if (!p) { p = fetchJson(dictAsset(`dictionaries/${dataset}/index.json`)).catch(() => null) as Promise<ExtIndex | null>; extIndexCache.set(dataset, p); }
  return p;
}
async function loadExtShard(dataset: string, providerId: string, lang: LangCode, word: string): Promise<Map<string, DictEntry>> {
  const key = shardKeyFor(word, lang); const ck = `${dataset}:${key}`;
  const hit = extShardCache.get(ck); if (hit) return hit;
  const map = new Map<string, DictEntry>();
  try {
    const idx = await loadExtIndex(dataset); const file = idx?.shards?.[key];
    if (file) {
      const rows = await fetchJson(dictAsset(`dictionaries/${dataset}/${file}`)) as RawRow[];
      if (Array.isArray(rows)) for (const r of rows) {
        if (!Array.isArray(r) || typeof r[0] !== 'string') continue;
        const lemmaKey = normalizeWord(r[1] || r[0], lang);
        const ex = map.get(lemmaKey);
        map.set(lemmaKey, ex ? mergeInto(ex, r, providerId) : toCanonical(r, lang, providerId));
      }
    }
  } catch { /* dataset unavailable (test/offline) — bundled fallback applies */ }
  if (extShardCache.size >= 12) extShardCache.delete(extShardCache.keys().next().value as string);
  extShardCache.set(ck, map);
  return map;
}
export function clearExternalCaches(): void { extIndexCache.clear(); extShardCache.clear(); lookupCache.clear(); }
export async function lookupExternal(dataset: string, providerId: string, lang: LangCode, word: string): Promise<DictEntry | undefined> {
  const shard = await loadExtShard(dataset, providerId, lang, word);
  const w = normalizeWord(word, lang);
  return shard.get(w) ?? shard.get(lemmatize(word, lang));
}
/** Merge provider entries: richest entry wins, senses unioned, never downgraded. */
export function mergeEntries(entries: DictEntry[], lang: LangCode, idx?: LangIndex): DictEntry | undefined {
  const valid = entries.filter(Boolean); if (!valid.length) return undefined;
  const sorted = [...valid].sort(rankEntries); const base = { ...sorted[0] };
  const senses = new Map<string, NonNullable<DictEntry['senses']>[number]>();
  for (const e of sorted) for (const s of e.senses ?? [{ definition: e.definition, pos: e.pos, examples: e.examples, source: e.providerId }]) if (!senses.has(s.definition)) senses.set(s.definition, s);
  base.senses = [...senses.values()];
  base.definition = base.senses[0]?.definition ?? base.definition;
  base.examples = [...new Set(sorted.flatMap(e => e.examples ?? []))];
  base.alternateReadings = [...new Set(sorted.flatMap(e => [e.phonetic, ...(e.alternateReadings ?? [])]).filter((x): x is string => !!x))];
  const knownFreq = sorted.map(e => e.frequency).filter(f => f < 9000);
  base.frequency = knownFreq.length ? Math.min(...knownFreq) : 9999;
  base.providerId = sorted.map(e => e.providerId).filter(Boolean).join('+');
  return idx ? withCharacters(base, idx, lang) : base;
}

export const DictionaryService = {
  async lookup(lang: LangCode, word: string): Promise<DictEntry | undefined> {
    const ck = `${lang}:${normalizeWord(word, lang)}`;
    if (lookupCache.has(ck)) return lookupCache.get(ck);
    const idx = await ensure(lang);
    const custom = customCache.get(lang)?.get(normalizeWord(word, lang)) ?? customCache.get(lang)?.get(lemmatize(word, lang));
    const bundled = resolve(idx, lang, word);
    const externals: DictEntry[] = [];
    for (const ext of EXTERNAL_BY_LANG[lang] ?? []) { const e = await lookupExternal(ext.dataset, ext.providerId, lang, word); if (e) externals.push(e); }
    const out = mergeEntries([...(bundled ? [bundled] : []), ...externals, ...(custom ? [custom] : [])], lang, idx);
    if (lookupCache.size >= MAX_LOOKUP_CACHE) lookupCache.delete(lookupCache.keys().next().value as string);
    lookupCache.set(ck, out);
    return out;
  },
  /** All provider results for a word, richest first — never discards a sense. */
  async lookupAll(lang: LangCode, word: string): Promise<DictEntry[]> {
    const idx = await ensure(lang);
    const out: DictEntry[] = [];
    const b = resolve(idx, lang, word); if (b) out.push(b);
    for (const ext of EXTERNAL_BY_LANG[lang] ?? []) { const e = await lookupExternal(ext.dataset, ext.providerId, lang, word); if (e) out.push(e); }
    const c = customCache.get(lang)?.get(normalizeWord(word, lang)) ?? customCache.get(lang)?.get(lemmatize(word, lang));
    if (c && c.lemma !== b?.lemma) out.push(c);
    return out.sort(rankEntries);
  },
  lookupExternal, mergeEntries, shardKeyFor, clearExternalCaches,
  /** Full Chinese-style lookup: complete word + per-character information. */
  async lookupWord(lang: LangCode, word: string) {
    const entry = await this.lookup(lang, word);
    if (!entry) return undefined;
    return { entry, senses: entry.senses ?? [{ definition: entry.definition, pos: entry.pos, examples: entry.examples }], characters: entry.characters ?? [], alternateReadings: entry.alternateReadings ?? [] };
  },
  async search(lang: LangCode, query: string, limit = 30): Promise<DictEntry[]> {
    const idx = await ensure(lang); const q = query.trim(); if (!q) return [];
    const nq = normalizeWord(q, lang); const pk = pinyinKey(q); const lq = q.toLowerCase();
    const scored = new Map<string, { e: DictEntry; score: number }>();
    const put = (e: DictEntry, score: number) => { const k = e.lemma; const cur = scored.get(k); if (!cur || score > cur.score) scored.set(k, { e, score }); };
    for (const [key, lemma] of idx.alias) { if (key === nq) put(idx.canonical.get(lemma)!, 100); else if (key.startsWith(nq) && nq) put(idx.canonical.get(lemma)!, 70); }
    if (pk.length >= 2) for (const [k, arr] of idx.pinyin) { if (k === pk) arr.forEach(e => put(e, 90)); else if (k.startsWith(pk)) arr.forEach(e => put(e, 60)); }
    for (const e of idx.canonical.values()) { if (e.definition.toLowerCase().includes(lq) || (e.senses ?? []).some(s => s.definition.toLowerCase().includes(lq))) put(e, 40); }
    return [...scored.values()].sort((a, b) => b.score - a.score || rankEntries(a.e, b.e)).slice(0, limit).map(x => withCharacters(x.e, idx, lang));
  },
  async getCharacter(lang: LangCode, char: string): Promise<DictCharacter | undefined> {
    if (lang !== 'zh' && lang !== 'yue') return undefined;
    const idx = await ensure(lang); const s = toSimplified(char);
    const ce = idx.canonical.get(s);
    return { char: s, simplified: s, traditional: toTraditional(s), phonetic: ce?.phonetic, definition: ce?.definition };
  },
  async getExamples(lang: LangCode, word: string): Promise<string[]> { return (await this.lookup(lang, word))?.examples ?? []; },
  async getPronunciation(lang: LangCode, word: string): Promise<string | undefined> { return (await this.lookup(lang, word))?.phonetic; },
  getMetadata(lang: LangCode) { return { providerId: 'bundled', language: lang, datasetId: lang === 'zh' ? 'visus-bundled-legacy+visus-zh-reference-supplement' : 'visus-bundled-legacy', verified: false }; },
  async lookupMany(lang: LangCode, words: string[]): Promise<Map<string, DictEntry>> {
    const idx = await ensure(lang); const out = new Map<string, DictEntry>();
    for (const w of words) { const e = resolve(idx, lang, w); if (e) out.set(normalizeWord(w, lang), e); }
    return out;
  },
  async size(lang: LangCode) { return (await ensure(lang)).canonical.size; },
  async allEntries(lang: LangCode): Promise<DictEntry[]> { return [...(await ensure(lang)).canonical.values()]; },
  registerCustom(lang: LangCode, entries: DictEntry[]) {
    const m = customCache.get(lang) ?? new Map();
    for (const e of entries.slice(0, 5000)) if (e && typeof e.word === 'string') m.set(normalizeWord(e.word, lang), { ...e, senses: e.senses ?? [{ definition: e.definition, pos: e.pos, examples: e.examples ?? [] }], providerId: e.providerId ?? 'custom-import' });
    customCache.set(lang, m); lookupCache.clear();
  },
  // Import adapters with validation + resource limits (Phase 11 hardening).
  parseImport(text: string, format: 'json'|'csv'|'tsv'|'txt', lang: LangCode): DictEntry[] {
    void lang;
    if (typeof text !== 'string' || text.length > 5_000_000) throw new Error('Dictionary import too large (max 5 MB)');
    const clean = (v: unknown, max = 500) => typeof v === 'string' ? v.slice(0, max) : '';
    if (format === 'json') {
      const data = JSON.parse(text) as unknown;
      if (!Array.isArray(data)) throw new Error('Invalid dictionary JSON: expected an array');
      return data.slice(0, 5000).filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && !Array.isArray(d))
        .filter(d => d.word !== '__proto__' && d.word !== 'constructor' && typeof d.word === 'string' && (typeof d.definition === 'string' || typeof d.translation === 'string'))
        .map(d => ({ word: clean(d.word, 100), lemma: clean(d.lemma, 100) || clean(d.word, 100), phonetic: clean(d.phonetic, 100) || undefined, pos: clean(d.pos, 50) || undefined, definition: clean(d.definition), translation: clean(d.translation) || clean(d.definition), examples: Array.isArray(d.examples) ? d.examples.slice(0, 5).map(x => clean(x)) : [], frequency: typeof d.frequency === 'number' && Number.isFinite(d.frequency) ? d.frequency : 9999, providerId: 'custom-import' }));
    }
    const delim = format === 'tsv' || format === 'txt' ? '\t' : ',';
    return text.split(/\r?\n/).slice(0, 5001).filter(Boolean).map(line => {
      const parts = line.slice(0, 2000).split(delim).map(s => s.trim());
      const [word, definition = '', translation = '', phonetic = '', pos = ''] = parts;
      return { word: word.slice(0, 100), lemma: word.slice(0, 100), phonetic: phonetic || undefined, pos: pos || undefined, definition, translation: translation || definition, examples: [], frequency: 9999, providerId: 'custom-import' };
    }).filter(e => e.word && (e.definition || e.translation));
  },
  loadedLanguages: () => [...cache.keys()],
  clearLookupCache: () => lookupCache.clear(),
};

// Register one bundled provider per language against the strict interface.
for (const lang of Object.keys(loaders) as LangCode[]) {
  registerProvider({
    id: 'bundled', language: lang, version: '1.0.0',
    license: 'Project-authored (VISUS repository); no external source claimed',
    attribution: 'VISUS project seed dictionaries', datasetId: 'visus-bundled-legacy', active: true,
    lookup: (w) => DictionaryService.lookup(lang, w),
    lookupAll: (w) => DictionaryService.lookupAll(lang, w),
    search: (q, limit) => DictionaryService.search(lang, q, limit),
    getCharacter: (c) => DictionaryService.getCharacter(lang, c),
    getExamples: (w) => DictionaryService.getExamples(lang, w),
    getPronunciation: (w) => DictionaryService.getPronunciation(lang, w),
    getMetadata: () => ({ id: 'bundled', version: '1.0.0', license: 'Project-authored (VISUS repository)', attribution: 'VISUS project seed dictionaries', verified: false }),
  } satisfies DictionaryProvider);
}
// Register the vendored licensed datasets as active providers.
for (const d of DATASETS.filter(x => x.active && x.verified)) {
  const lang = d.language as LangCode; if (lang === ('multi' as LangCode)) continue;
  const datasetId = d.id === 'open-english-wordnet' ? 'wordnet' : d.id === 'wiktionary-ko' ? 'wiktionary' : d.id;
  registerProvider({
    id: d.providerId, language: lang, version: d.version,
    license: d.license, attribution: d.attribution, datasetId: d.id, active: true,
    lookup: (w) => lookupExternal(datasetId, d.providerId, lang, w),
    lookupAll: async (w) => { const e = await lookupExternal(datasetId, d.providerId, lang, w); return e ? [e] : []; },
    search: async () => [], getCharacter: async () => undefined,
    getExamples: async (w) => (await lookupExternal(datasetId, d.providerId, lang, w))?.examples ?? [],
    getPronunciation: async (w) => (await lookupExternal(datasetId, d.providerId, lang, w))?.phonetic,
    getMetadata: () => ({ id: d.providerId, version: d.version, license: d.license, attribution: d.attribution, verified: true }),
  } satisfies DictionaryProvider);
}
export type { DictionaryProvider };
