import { describe, it, expect } from 'vitest';
import { parseSubtitleFile, parseSrt, parseVtt, SubtitleSynchronizer, formatTimestamp, computeVideoStats } from '../../src/videos/subtitles';
import { YouTubeAdapter, NetflixAdapter, extractVisibleSubtitleText } from '../../src/videos/adapters';
import { RADII, COLORS, loadState, saveState } from '../../src/design/tokens';

describe('SubtitleParser', () => {
  it('parses SRT and VTT, rejects invalid files', () => {
    expect(parseSrt('1\n00:00:01,000 --> 00:00:02,500\nHola mundo\n')).toHaveLength(1);
    expect(parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nBonjour <b>monde</b>\n')[0].text).toBe('Bonjour monde');
    expect(parseSubtitleFile('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n').format).toBe('vtt');
    expect(() => parseSubtitleFile('not subtitles')).toThrow(/timings/);
    expect(() => parseSubtitleFile('')).toThrow(/empty/);
  });
  it('keeps imported markup as text, never HTML', () => {
    const cues = parseSrt('1\n00:00:01,000 --> 00:00:02,000\n<script>alert(1)</script>Hello\n');
    expect(cues[0].text).toBe('alert(1)Hello');
    expect(cues[0].text).not.toContain('<script>');
  });
});

describe('SubtitleSynchronizer', () => {
  const sync = new SubtitleSynchronizer([{ start: 0, end: 2, text: 'a' }, { start: 2, end: 4, text: 'b' }, { start: 5, end: 7, text: 'c' }]);
  it('finds cues and searches lines', () => {
    expect(sync.cueAt(0.5)?.text).toBe('a');
    expect(sync.cueAt(3)?.text).toBe('b');
    expect(sync.search('c')).toHaveLength(1);
    expect(formatTimestamp(65)).toBe('1:05');
  });
  it('computes real session statistics', () => {
    const stats = computeVideoStats(sync.cues, t => t.split(' '), () => 'new', 30);
    expect(stats.sentences).toBe(3);
    expect(stats.newWords).toBe(3);
    expect(stats.seconds).toBe(30);
  });
});

describe('platform adapters', () => {
  it('detects watch pages and video keys', () => {
    expect(YouTubeAdapter.isWatchPage('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(YouTubeAdapter.isWatchPage('https://www.youtube.com/feed')).toBe(false);
    expect(YouTubeAdapter.videoKey('https://www.youtube.com/watch?v=abc')).toBe('yt:abc');
    expect(NetflixAdapter.isWatchPage('https://www.netflix.com/watch/123')).toBe(true);
    expect(NetflixAdapter.isWatchPage('https://www.netflix.com/browse')).toBe(false);
  });
  it('reads only visible Netflix subtitle text', () => {
    const el = (text: string) => ({ textContent: text });
    const root = { querySelectorAll: (_s: string) => [el('  Bonjour   le  monde '), el('Bonjour le monde')] } as unknown as Pick<Document, 'querySelectorAll'>;
    expect(extractVisibleSubtitleText(root)).toBe('Bonjour le monde');
    const empty = { querySelectorAll: (_s: string) => [] } as unknown as Pick<Document, 'querySelectorAll'>;
    expect(extractVisibleSubtitleText(empty)).toBe('');
  });
});

describe('design tokens + persisted chrome state', () => {
  it('keeps the rounded premium scale', () => {
    expect(RADII.panel).toBeGreaterThanOrEqual(20);
    expect(RADII.panel).toBeLessThanOrEqual(24);
    expect(RADII.popup).toBe(20);
    expect(RADII.sidebar).toBe(20);
    expect(COLORS.terracotta).toBe('#a9714b');
    expect(COLORS.charcoal).toBe('#2b251d');
  });
  it('persists widget/sidebar state', () => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    saveState('visus:test', { w: 400, collapsed: true });
    expect(loadState('visus:test', { w: 340, collapsed: false })).toMatchObject({ w: 400, collapsed: true });
  });
});
