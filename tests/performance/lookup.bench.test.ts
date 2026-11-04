import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { DictionaryService } from '../../src/services/dictionary';

// Reference-machine lookup measurements (see docs/PERFORMANCE.md for the
// machine spec and recorded numbers). Cold = first lookup incl. shard fetch
// + JSON parse (fetch stubbed to the real files on disk); warm = cached.
beforeAll(() => {
  (globalThis as { fetch?: unknown }).fetch = async (url: string) => {
    const p = `public/${String(url).replace(/^\//, '')}`;
    if (!existsSync(p)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(p, 'utf8')) };
  };
});
const pct = (xs: number[], q: number) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
async function bench(label: string, fn: () => Promise<unknown>, n = 100) {
  const t0 = performance.now(); await fn(); const cold = performance.now() - t0;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) { const s = performance.now(); await fn(); xs.push(performance.now() - s); }
  console.log(`[perf] ${label}: cold=${cold.toFixed(1)}ms warm avg=${(xs.reduce((a, b) => a + b, 0) / n).toFixed(2)}ms p95=${pct(xs, 0.95).toFixed(2)}ms (n=${n}, node ${process.version}, ${process.platform}/${process.arch})`);
  return { cold, p95: pct(xs, 0.95) };
}
describe('lookup performance (reference machine: this host, Node vitest)', () => {
  it('bundled en cold+warm < 100ms warm', async () => {
    const r = await bench('bundled en "school"', () => DictionaryService.lookup('en', 'school'));
    expect(r.p95).toBeLessThan(100);
  });
  it('CC-CEDICT zh shard cold+warm < 100ms warm', async () => {
    DictionaryService.clearExternalCaches();
    const r = await bench('cc-cedict zh "学校"', () => DictionaryService.lookupExternal('cc-cedict', 'cc-cedict', 'zh', '学校'));
    expect(r.p95).toBeLessThan(100);
  });
  it('WordNet en shard warm < 100ms', async () => {
    DictionaryService.clearExternalCaches(); const r = await bench('wordnet en "university"', () => DictionaryService.lookupExternal('wordnet', 'wordnet', 'en', 'university'), 50);
    expect(r.p95).toBeLessThan(100);
  });
  it('shard-warm (new words, shard cached, result cache cold) stays < 100ms avg', async () => {
    DictionaryService.clearExternalCaches();
    await DictionaryService.lookupExternal('cc-cedict', 'cc-cedict', 'zh', '学校');
    const words = ['学生', '学习', '学校', '学期', '学科'];
    const xs: number[] = [];
    for (let r = 0; r < 4; r++) for (const w of words) { DictionaryService.clearLookupCache(); const s = performance.now(); await DictionaryService.lookupExternal('cc-cedict', 'cc-cedict', 'zh', w); xs.push(performance.now() - s); }
    console.log(`[perf] cc-cedict shard-warm new words: avg=${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)}ms p95=${pct(xs, 0.95).toFixed(2)}ms (n=${xs.length})`);
    expect(xs.reduce((a, b) => a + b, 0) / xs.length).toBeLessThan(100);
  });
  it('JMdict ja shard warm < 100ms', async () => {
    DictionaryService.clearExternalCaches(); const r = await bench('jmdict ja "学生"', () => DictionaryService.lookupExternal('jmdict', 'jmdict', 'ja', '学生'), 50);
    expect(r.p95).toBeLessThan(100);
  });
});
