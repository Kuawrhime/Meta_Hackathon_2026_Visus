import { describe, it, expect } from 'vitest';
import { DictionaryService } from '../../src/services/dictionary';
import { toSimplified, toTraditional } from '../../src/services/segmentation';

describe('Chinese engine (screenshots reference: 圖像 / 張)', () => {
  it('converts Traditional <-> Simplified', () => {
    expect(toSimplified('圖像')).toBe('图像');
    expect(toSimplified('張劍虹')).toBe('张剑虹');
    expect(toTraditional('图像')).toBe('圖像');
  });
  it('圖像 lookup returns the complete word, not just characters', async () => {
    const full = await DictionaryService.lookupWord('zh', '圖像');
    expect(full).toBeTruthy();
    expect(full!.entry.word).toBe('图像');
    expect(full!.entry.simplified).toBe('图像');
    expect(full!.entry.traditional).toBe('圖像');
    expect(full!.entry.phonetic).toBe('túxiàng');
    expect(full!.senses.map(s => s.definition).join(' ')).toMatch(/image; picture; graphic/);
    expect(full!.entry.frequency).toBe(6056);
  });
  it('individual characters are distinguishable from the compound', async () => {
    const full = await DictionaryService.lookupWord('zh', '圖像');
    expect(full!.characters.map(c => c.char)).toEqual(['图', '像']);
    expect(full!.characters[1].traditional).toBe('像');
    const ch = await DictionaryService.getCharacter('zh', '圖');
    expect(ch?.simplified).toBe('图');
  });
  it('張 keeps alternative readings/senses (open up, spread, sheet, votes, surname)', async () => {
    const full = await DictionaryService.lookupWord('zh', '張');
    expect(full).toBeTruthy();
    const defs = full!.senses.map(s => s.definition).join(' | ');
    expect(defs).toMatch(/to open up/);
    expect(defs).toMatch(/surname Zhang/);
    expect(full!.senses.length).toBeGreaterThanOrEqual(5);
  });
  it('searches by pinyin without tones and by characters', async () => {
    expect((await DictionaryService.search('zh', 'tuxiang')).some(e => e.lemma === '图像')).toBe(true);
    expect((await DictionaryService.search('zh', '图像')).length).toBeGreaterThan(0);
    expect((await DictionaryService.search('zh', 'zhang')).some(e => e.lemma === '张')).toBe(true);
  });
  it('Simplified and Traditional input resolve to the same entry', async () => {
    const a = await DictionaryService.lookup('zh', '图像');
    const b = await DictionaryService.lookup('zh', '圖像');
    expect(a?.id).toBe(b?.id);
  });
});
