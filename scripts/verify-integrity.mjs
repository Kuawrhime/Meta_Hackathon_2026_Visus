// Prints SHA-256 checksums for every shipped dictionary dataset (Phase 9/11).
// Paste a digest into docs/DATASETS.md when a dataset changes; generated files
// must never be hand-edited (see docs/AGENT_RULES.md).
// Run: node scripts/verify-integrity.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
for (const f of readdirSync('src/dictionary/data').filter(x => x.endsWith('.json')).sort()) {
  const buf = readFileSync(`src/dictionary/data/${f}`);
  console.log(`${createHash('sha256').update(buf).digest('hex')}  src/dictionary/data/${f}  (${buf.length} bytes)`);
}
import { existsSync } from 'node:fs';
if (existsSync('public/dictionaries')) for (const d of readdirSync('public/dictionaries', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) {
  const p = `public/dictionaries/${d}/index.json`; if (!existsSync(p)) continue;
  const buf = readFileSync(p);
  console.log(`${createHash('sha256').update(buf).digest('hex')}  ${p}  (${buf.length} bytes)`);
}
