import { describe, it, expect } from 'vitest';
import { DictionaryService } from '../../src/services/dictionary';
import { providersFor, adapterFor, LANGUAGE_ADAPTERS } from '../../src/dictionary/providers';
import { DATASETS, activeDatasets } from '../../src/dictionary/datasets';

describe('unified dictionary model & providers', () => {
  it('keeps multiple senses instead of overwriting polysemes (zh 工作)', async () => {
    const full = await DictionaryService.lookupWord('zh', '工作');
    expect(full).toBeTruthy();
    expect((full!.senses.length)).toBeGreaterThanOrEqual(2);
    const defs = full!.senses.map(s => s.definition).join(' | ');
    expect(defs).toMatch(/work|job/);
  });
  it('allEntries returns one canonical entry per lemma', async () => {
    const all = await DictionaryService.allEntries('zh');
    const lemmas = all.map(e => e.lemma);
    expect(new Set(lemmas).size).toBe(lemmas.length);
    for (const e of all.slice(0, 20)) { expect(e.id).toBe(`zh:${e.lemma}`); expect(e.senses?.length).toBeGreaterThanOrEqual(1); }
  });
  it('searches by English definition and by headword prefix', async () => {
    expect((await DictionaryService.search('en', 'school')).length).toBeGreaterThan(0);
    expect((await DictionaryService.search('zh', '历史')).length).toBeGreaterThan(0);
  });
  it('unknown words return undefined, never invented entries', async () => {
    expect(await DictionaryService.lookup('en', 'zzqqxxyy')).toBeUndefined();
    expect(await DictionaryService.lookup('zh', '龘龘龘')).toBeUndefined();
  });
  it('provider registry: bundled + vendored externals active per language', () => {
    const zh = providersFor('zh');
    expect(zh.some(p => p.id === 'bundled' && p.active)).toBe(true);
    expect(zh.some(p => p.id === 'cc-cedict' && p.active)).toBe(true);
    for (const d of DATASETS) expect(d.license.length).toBeGreaterThan(2);
    // Bundled seed packs stay honestly unverified; vendored externals are verified.
    expect(activeDatasets().filter(d => d.id.startsWith('visus-')).every(d => !d.verified)).toBe(true);
    expect(activeDatasets().filter(d => !d.id.startsWith('visus-')).every(d => d.verified)).toBe(true);
  });
  it('language adapters declare morphology honestly (ko/ar rule-based with limits)', () => {
    expect(adapterFor('ko')?.morphology).toMatch(/not a full morphological analyzer/i);
    expect(adapterFor('ar')?.morphology).toMatch(/not a root-and-pattern analyzer/i);
    expect(adapterFor('zh')?.tokenization).toBe('dict-maxmatch');
    expect(Object.keys(LANGUAGE_ADAPTERS).length).toBeGreaterThanOrEqual(12);
  });
  it('custom import validation caps and cleans rows', () => {
    const rows = DictionaryService.parseImport(JSON.stringify([{ word: 'mot', definition: 'word' }, { bad: 1 }, { word: 'x' }]), 'json', 'fr');
    expect(rows.length).toBe(1);
    expect(() => DictionaryService.parseImport('x'.repeat(5_000_001), 'json', 'fr')).toThrow(/too large/);
  });
  it('cached lookup is fast (warm, local) — documented-machine smoke bound', async () => {
    await DictionaryService.lookup('en', 'school');
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) await DictionaryService.lookup('en', 'school');
    expect((performance.now() - t0) / 50).toBeLessThan(100);
  });
});
