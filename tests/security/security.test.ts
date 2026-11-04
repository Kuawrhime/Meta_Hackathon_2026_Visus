import { describe, it, expect } from 'vitest';
import { validateMessage, isOwnSender } from '../../src/browser/messageValidation';
import { BackupService } from '../../src/services/backup';
import { DictionaryService } from '../../src/services/dictionary';
import { VocabularyService } from '../../src/services/vocabulary';
import 'fake-indexeddb/auto';

describe('message validation (content scripts are untrusted)', () => {
  it('accepts well-formed messages and rejects everything else', () => {
    expect(validateMessage({ type: 'LF_SET_STATUS', lang: 'zh', word: '圖像', status: 'l1' })?.status).toBe('l1');
    expect(validateMessage({ type: 'LF_SET_STATUS', lang: 'zh', word: 'x', status: 'evil' })).toBeNull();
    expect(validateMessage({ type: 'LF_DROP_TABLE' })).toBeNull();
    expect(validateMessage({ type: 'LF_ENCOUNTERS', lang: 'xx', words: [] })).toBeNull();
    expect(validateMessage(null)).toBeNull();
    expect(validateMessage('LF_GET_SETTINGS')).toBeNull();
  });
  it('caps oversized payloads', () => {
    const m = validateMessage({ type: 'LF_ENCOUNTERS', lang: 'en', words: Array.from({ length: 900 }, (_, i) => 'w' + i) });
    expect(m?.words?.length).toBe(500);
    expect(validateMessage({ type: 'LF_SET_DEF', lang: 'en', word: 'a', def: 'x'.repeat(2000) })).toBeNull();
    expect(validateMessage({ type: 'LF_OPEN_READER', url: 'javascript:alert(1)' })).toBeNull();
    expect(validateMessage({ type: 'LF_ADD_READING', lang: 'en', seconds: 9999 })?.seconds).toBe(60);
  });
  it('sender check only trusts our own extension contexts', () => {
    expect(isOwnSender({ id: 'abc' }, 'abc')).toBe(true);
    expect(isOwnSender({ id: 'evil' }, 'abc')).toBe(false);
    expect(isOwnSender({ url: 'https://evil.example/' }, undefined)).toBe(false);
    expect(isOwnSender({ url: 'chrome-extension://abc/dashboard.html' }, undefined)).toBe(true);
  });
});

describe('backup & import hardening', () => {
  it('rejects corrupt and oversized backups before restoring', async () => {
    await expect(BackupService.importJSON('{"nope":1}')).rejects.toThrow(/vocab/);
    await expect(BackupService.importJSON('not json')).rejects.toThrow();
    await expect(BackupService.importJSON('x'.repeat(20_000_001))).rejects.toThrow(/too large/);
  });
  it('rejects prototype-pollution shaped dictionary imports', () => {
    const rows = DictionaryService.parseImport('[{"word":"__proto__","definition":"x"},{"word":"ok","definition":"fine"}]', 'json', 'en');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(rows.map(r => r.word)).toContain('ok');
  });
  it('vocabulary import sanitizes malformed records', async () => {
    const res = await VocabularyService.importRecords([
      { word: 'hola', lemma: 'hola', lang: 'es', status: 'known' },
      { word: 42, lemma: 'bad', lang: 'es', status: 'known' },
      { word: 'x', lemma: 'x', lang: 'es', status: 'pwned' },
    ] as never);
    expect(res.added).toBe(1);
    expect((await VocabularyService.get('es', 'hola'))?.status).toBe('known');
  });
  it('knownAt is cleared when a word leaves known (stats integrity)', async () => {
    await VocabularyService.setStatus('en', 'integrityword', 'known');
    expect((await VocabularyService.get('en', 'integrityword'))?.knownAt).toBeTypeOf('number');
    await VocabularyService.setStatus('en', 'integrityword', 'l2');
    const rec = await VocabularyService.get('en', 'integrityword');
    expect(rec?.knownAt).toBeUndefined();
    expect(rec?.history?.map(h => h.status)).toEqual(['known', 'l2']);
  });
  it('addPhrase never wipes an existing graded record', async () => {
    await VocabularyService.setStatus('en', 'keep me', 'l3');
    const before = await VocabularyService.get('en', 'keep me');
    await VocabularyService.addPhrase('en', 'keep me');
    const after = await VocabularyService.get('en', 'keep me');
    expect(after?.status).toBe(before?.status);
    expect(after?.isPhrase).toBe(true);
  });
  it('one record per word across sources, contexts preserved', async () => {
    await VocabularyService.encounter('en', 'ubiquitous', 'web', 'seen on a page');
    const r = await VocabularyService.encounter('en', 'ubiquitous', 'book', 'seen in a book');
    expect(r.encounters).toBeGreaterThanOrEqual(2);
    expect(r.contexts?.map(c => c.source)).toContain('book');
  });
});
