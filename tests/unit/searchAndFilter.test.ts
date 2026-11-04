import { describe, it, expect } from 'vitest';
import { isSearchEngineUrl } from '../../src/services/searchEngine';
import { classifyText, shouldProcessText } from '../../src/services/languageFilter';
describe('SearchEngineDetector', () => {
  it('excludes Google/Bing/Yahoo/Baidu/DuckDuckGo search pages incl. regional domains', () => {
    expect(isSearchEngineUrl('https://www.google.com/search?q=bonjour')).toBe(true);
    expect(isSearchEngineUrl('https://www.google.fr/search?q=bonjour')).toBe(true);
    expect(isSearchEngineUrl('https://www.google.co.uk/search?q=hello')).toBe(true);
    expect(isSearchEngineUrl('https://www.google.com/imghp?hl=en')).toBe(true);
    expect(isSearchEngineUrl('https://www.bing.com/search?q=test')).toBe(true);
    expect(isSearchEngineUrl('https://www.bing.com/images/search?q=test')).toBe(true);
    expect(isSearchEngineUrl('https://search.yahoo.com/search?p=test')).toBe(true);
    expect(isSearchEngineUrl('https://www.baidu.com/s?wd=%E4%B8%AD%E6%96%87')).toBe(true);
    expect(isSearchEngineUrl('https://duckduckgo.com/?q=test')).toBe(true);
    expect(isSearchEngineUrl('https://html.duckduckgo.com/html/?q=test')).toBe(true);
  });
  it('does not exclude normal articles or the Google homepage', () => {
    expect(isSearchEngineUrl('https://www.bbc.com/news/article')).toBe(false);
    expect(isSearchEngineUrl('https://www.rainews.it/articoli/abc')).toBe(false);
    expect(isSearchEngineUrl('https://www.google.com/')).toBe(false);
    expect(isSearchEngineUrl('https://en.wikipedia.org/wiki/China')).toBe(false);
  });
});
describe('LanguageFilterService (selected language is authoritative)', () => {
  it('processes Chinese only when Chinese is selected', () => {
    expect(shouldProcessText('我今天想学习中文。', 'zh')).toBe(true);
    expect(shouldProcessText('香港传媒报道，他参加深圳参观活动。', 'zh')).toBe(true);
    expect(shouldProcessText('Bonjour, je vais à école aujourd hui avec mes amis.', 'zh')).toBe(false);
    expect(shouldProcessText('The treaty bans discrimination in school today.', 'zh')).toBe(false);
    expect(shouldProcessText('今日は暑いです。学校へ行きます。', 'zh')).toBe(false);
  });
  it('processes French only when French is selected', () => {
    expect(shouldProcessText("Bonjour, je vais à l'école avec mes amis aujourd'hui.", 'fr')).toBe(true);
    expect(shouldProcessText('我今天想学习中文。', 'fr')).toBe(false);
    expect(shouldProcessText('The treaty bans discrimination and the school opens in the morning.', 'fr')).toBe(false);
  });
  it('ignores numbers, URLs and low-confidence fragments', () => {
    expect(shouldProcessText('12345', 'en')).toBe(false);
    expect(shouldProcessText('https://www.example.com/page', 'en')).toBe(false);
    expect(classifyText('日本語を学ぶ').lang).toBe('ja');
    expect(classifyText('한국어를 배우다').lang).toBe('ko');
  });
  it('segments Chinese into multi-character words, not single chars only', async () => {
    const { segmentText } = await import('../../src/services/segmentation');
    const words = segmentText('我今天想学习中文', 'zh').filter(t => t.isWord).map(t => t.text);
    expect(words.join('')).toBe('我今天想学习中文');
    expect(words).toContain('学习'); expect(words).toContain('中文'); expect(words).toContain('今天');
  });
});
