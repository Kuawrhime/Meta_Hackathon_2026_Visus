import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { DictionaryService } from '../../src/services/dictionary';
import { providersFor } from '../../src/dictionary/providers';
import { DATASETS } from '../../src/dictionary/datasets';
import { lemmatize } from '../../src/services/segmentation';

// Serve the generated public/dictionaries shards through a fetch stub so the
// real lazy shard loader is exercised against the real vendored data.
beforeAll(() => {
  (globalThis as { fetch?: unknown }).fetch = async (url: string) => {
    const p = `public/${String(url).replace(/^\//, '')}`;
    if (!existsSync(p)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(p, 'utf8')) };
  };
});

describe('vendored licensed datasets (active providers)', () => {
  it('CC-CEDICT: traditional input resolves, pinyin has tone marks, senses preserved', async () => {
    const e = await DictionaryService.lookupExternal('cc-cedict', 'cc-cedict', 'zh', '學校');
    expect(e).toBeTruthy();
    expect(e!.phonetic).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
    expect(e!.senses!.length).toBeGreaterThanOrEqual(1);
    expect(e!.definition).toMatch(/school/i);
  });
  it('WordNet: English definitions come from synsets', async () => {
    const e = await DictionaryService.lookupExternal('wordnet', 'wordnet', 'en', 'school');
    expect(e?.definition).toMatch(/educational institution|teaching/i);
  });
  it('JMdict: Japanese headword with kana reading', async () => {
    const e = await DictionaryService.lookupExternal('jmdict', 'jmdict', 'ja', '学校');
    expect(e).toBeTruthy();
    expect(e!.phonetic).toContain('がっこう');
  });
  it('FreeDict: French headword gives an English translation sense', async () => {
    const e = await DictionaryService.lookupExternal('freedict-fr', 'freedict', 'fr', 'école');
    expect(e?.definition ?? e?.translation).toBeTruthy();
  });
  it('Wiktionary (Korean): Hangul headword with an English gloss', async () => {
    const e = await DictionaryService.lookupExternal('wiktionary', 'wiktionary', 'ko', '학교');
    expect(e).toBeTruthy();
    expect(e!.definition).toMatch(/school/i);
  });
  it('merged lookup unions senses across providers without downgrading', async () => {
    const all = await DictionaryService.lookupAll('en', 'school');
    expect(all.length).toBeGreaterThanOrEqual(2);
    const merged = await DictionaryService.lookup('en', 'school');
    expect(merged!.senses!.length).toBeGreaterThanOrEqual(2);
  });
  it('every active external dataset is verified, licensed and checksummed', () => {
    for (const d of DATASETS.filter(x => x.active && !x.id.startsWith('visus-'))) {
      expect(d.verified, d.id).toBe(true);
      expect(d.checksum, d.id).toMatch(/sha256:[0-9a-f]{64}/);
      expect(existsSync(`public/dictionaries/${d.id === 'open-english-wordnet' ? 'wordnet' : d.id === 'wiktionary-ko' ? 'wiktionary' : d.id}/index.json`), d.id).toBe(true);
    }
    expect(providersFor('zh').some(p => p.id === 'cc-cedict' && p.active)).toBe(true);
    expect(providersFor('ja').some(p => p.id === 'jmdict' && p.active)).toBe(true);
    expect(providersFor('ko').some(p => p.id === 'wiktionary' && p.active)).toBe(true);
  });
});

describe('Korean & Arabic morphological handling', () => {
  it('Korean: strips particles and polite endings to the stem', () => {
    expect(lemmatize('학교에서', 'ko')).toBe('학교');
    expect(lemmatize('학교를', 'ko')).toBe('학교');
    expect(lemmatize('먹습니다', 'ko')).not.toContain('습니다');
  });
  it('Arabic: strips article/proclitics/suffixes and normalizes letters', () => {
    expect(lemmatize('الكتاب', 'ar')).toBe('كتاب');
    expect(lemmatize('كتابها', 'ar')).toBe('كتاب');
    expect(lemmatize('أحمد', 'ar')).toBe('احمد');
  });
});
