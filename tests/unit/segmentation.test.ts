import { describe, it, expect } from 'vitest';
import { segmentText, lemmatize, detectLanguage, normalizeWord } from '../../src/services/segmentation';
describe('segmentation', () => {
  it('tokenizes European text by words, keeping punctuation separate', () => {
    const toks = segmentText('The treaty bans discrimination.', 'en').filter(t => t.isWord).map(t => t.text);
    expect(toks).toEqual(['The', 'treaty', 'bans', 'discrimination']);
  });
  it('segments Chinese without whitespace (no whitespace-only splitting)', () => {
    const words = segmentText('香港传媒报道，他参加活动。', 'zh').filter(t => t.isWord).map(t => t.text);
    expect(words.length).toBeGreaterThan(3); expect(words.join('')).toContain('香港');
    // Multi-char dictionary words must survive as single tokens when Intl.Segmenter is unavailable or via fallback list.
    expect(words.some(w => w.length >= 2)).toBe(true);
  });
  it('segments Japanese text into word-like tokens', () => {
    const words = segmentText('私は学生です。学校は九時に始まる。', 'ja').filter(t => t.isWord);
    expect(words.length).toBeGreaterThan(3);
  });
  it('detects languages from script', () => {
    expect(detectLanguage('今日は暑い')).toBe('ja'); expect(detectLanguage('香港传媒报道')).toBe('zh');
    expect(detectLanguage('Привет, мир')).toBe('ru'); expect(detectLanguage('مرحبا بالعالم')).toBe('ar');
  });
  it('lemmatizes English inflections', () => {
    expect(lemmatize('running', 'en')).toBe('run'); expect(lemmatize('studies', 'en')).toBe('study'); expect(lemmatize('books', 'en')).toBe('book');
  });
  it('normalizes case and punctuation', () => { expect(normalizeWord('  Treaty.', 'en')).toBe('treaty'); });
});
