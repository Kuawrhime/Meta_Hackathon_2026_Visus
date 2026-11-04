// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { HighlightingService, refreshWordEverywhere } from '../../src/services/highlighting';
describe('highlight rendering (DOM)', () => {
  it('wraps words in status spans and preserves links/buttons', () => {
    document.body.innerHTML = '<p>The treaty bans discrimination.</p><a href="/x">link text</a><script>var treaty=1;</script>';
    const stats = HighlightingService.highlightRoot(document.body, 'en', new Map([['treaty', 'known']]));
    expect(stats.total).toBeGreaterThan(3);
    expect(document.querySelector('.lf-w[data-lemma="treaty"]')?.classList.contains('lf-known')).toBe(true);
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/x');
    expect(document.querySelector('script')?.textContent).toContain('var treaty=1;');
    expect(document.querySelectorAll('script .lf-w').length).toBe(0);
  });
  it('updates colors immediately when a word is graded', () => {
    document.body.innerHTML = '<p>The law bans discrimination in the school and the city.</p>';
    HighlightingService.highlightRoot(document.body, 'en', new Map());
    refreshWordEverywhere('discrimination', 'known');
    expect(document.querySelector('.lf-w[data-lemma="discrimination"]')?.classList.contains('lf-known')).toBe(true);
  });
  it('does not highlight editable fields', () => {
    document.body.innerHTML = '<textarea>The treaty is here.</textarea><p>The treaty is here and the school is open.</p>';
    HighlightingService.highlightRoot(document.body, 'en', new Map());
    expect(document.querySelectorAll('textarea .lf-w').length).toBe(0);
    expect(document.querySelectorAll('p .lf-w').length).toBeGreaterThan(3);
  });
  it('ignores text that is not in the selected learning language', () => {
    document.body.innerHTML = '<p>Bonjour, je vais à école avec mes amis aujourd hui.</p><p>我今天想学习中文。</p>';
    HighlightingService.highlightRoot(document.body, 'zh', new Map());
    const zh = document.querySelectorAll('p:nth-of-type(2) .lf-w').length;
    const fr = document.querySelectorAll('p:nth-of-type(1) .lf-w').length;
    expect(zh).toBeGreaterThan(2); expect(fr).toBe(0);
  });
});
