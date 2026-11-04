import { describe, it, expect } from 'vitest';
import { DictionaryService } from '../../src/services/dictionary';
describe('offline dictionary', () => {
  it('looks up bundled English entries with definition + frequency', async () => {
    const e = await DictionaryService.lookup('en', 'discrimination');
    expect(e?.definition).toContain('Unfair treatment'); expect(e!.frequency).toBeGreaterThan(0);
  });
  it('resolves inflected forms to lemmas', async () => {
    const e = await DictionaryService.lookup('en', 'books'); expect(e?.word).toBe('book');
  });
  it('returns undefined for unknown words (no fabricated definitions)', async () => {
    expect(await DictionaryService.lookup('en', 'zzzznotaword')).toBeUndefined();
  });
  it('parses TSV dictionary imports', () => {
    const rows = DictionaryService.parseImport('mot\tun mot français\tword', 'tsv', 'fr');
    expect(rows[0].word).toBe('mot'); expect(rows[0].definition).toContain('français');
  });
  it('has dictionaries for all 12 initial languages', async () => {
    for (const l of ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ja', 'zh', 'ko', 'ru', 'ar'] as const) {
      expect(await DictionaryService.size(l), l).toBeGreaterThan(50);
    }
  });
});
