import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { VocabularyService } from '../../src/services/vocabulary';
describe('vocabulary persistence (IndexedDB)', () => {
  it('persists a graded word and reads it back across calls (cross-page consistency)', async () => {
    await VocabularyService.setStatus('en', 'treaty', 'known');
    const rec = await VocabularyService.get('en', 'treaty');
    expect(rec?.status).toBe('known');
    const map = await VocabularyService.statusMap('en');
    expect(map.get('treaty')).toBe('known');
  });
  it('counts encounters', async () => {
    await VocabularyService.encounter('fr', 'école'); const r = await VocabularyService.encounter('fr', 'école');
    expect(r.encounters).toBeGreaterThanOrEqual(2);
  });
  it('import detects duplicates', async () => {
    const rec = await VocabularyService.encounter('es', 'escuela');
    const res = await VocabularyService.importRecords([rec]);
    expect(res.skipped).toBe(1);
  });
});
