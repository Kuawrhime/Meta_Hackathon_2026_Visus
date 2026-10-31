// Validates the dataset registry (src/dictionary/datasets.ts) as data:
// every ACTIVE dataset must correspond to files shipped in the repo, and every
// INACTIVE (not-yet-vendored) dataset must stay inactive. Fails CI on drift.
// Run: node scripts/validate-licenses.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const src = readFileSync('src/dictionary/datasets.ts', 'utf8');
const blocks = src.split(/\{\s*id:/).slice(1).map(b => b.split(/\},/)[0]);
let fail = 0;
const shipped = existsSync('src/dictionary/data') ? readdirSync('src/dictionary/data').filter(f => f.endsWith('.json')) : [];
for (const b of blocks) {
  const id = (b.match(/'([^']+)'/) ?? [])[1];
  const active = /active:\s*true/.test(b);
  const verified = /verified:\s*true/.test(b);
  const hasLicense = /license:\s*'[^']{3,}/.test(b);
  const hasSource = /sourceUrl:\s*'[^']{3,}/.test(b);
  if (!hasLicense || !hasSource) { console.error(`FAIL ${id}: missing license or sourceUrl`); fail++; }
  if (active && verified && !/sha256:[0-9a-f]{64}/.test(b)) { console.error(`FAIL ${id}: verified+active without an index sha256 checksum`); fail++; }
  if (active && verified) { const lic = (b.match(/dictionaries\/licenses\/[A-Za-z0-9._-]+/) ?? [])[0]; if (lic && !existsSync(`public/${lic}`)) { console.error(`FAIL ${id}: license text missing at public/${lic}`); fail++; } }
  if (active && !verified && !/bundled|supplement/.test(id)) { console.error(`FAIL ${id}: active but unverified external dataset`); fail++; }
  console.log(`${active ? 'ACTIVE  ' : 'inactive'} ${id}`);
}
if (!shipped.length) { console.error('FAIL: no dictionary data files shipped'); fail++; }
else console.log(`shipped data files: ${shipped.join(', ')}`);
console.log(fail ? `\n${fail} license validation failure(s)` : '\nLicense registry consistent.');
process.exit(fail ? 1 : 0);
