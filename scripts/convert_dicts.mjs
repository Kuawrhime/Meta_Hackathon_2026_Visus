// Converts the Python-authored lexicons in scripts/gen_dicts.py into JSON dictionaries (no Python runtime needed).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = readFileSync(new URL('./gen_dicts.py', import.meta.url), 'utf8');
function extractArray(name) {
  const m = src.match(new RegExp('\\n' + name + '\\s*=\\s*\\[')); const start = m ? m.index : -1; if (start < 0) throw new Error('not found ' + name);
  let i = src.indexOf('[', start); const begin = i; let depth = 0; let inStr = false; let esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[' || c === '(') depth++;
    if (c === ']' || c === ')') { depth--; if (depth === 0) { i++; break; } }
  }
  const raw = src.slice(begin, i);
  // Convert Python tuples to JS arrays outside strings.
  let out = ''; inStr = false; esc = false;
  for (const c of raw) {
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    out += c === '(' ? '[' : c === ')' ? ']' : c;
  }
  return Function('"use strict"; return (' + out + ')')();
}
function conv(rows) { return rows.map((r, i) => [r[0], r[0], r[1], r[2], r[3], r[0], r[4], i + 1, []]); }
mkdirSync(new URL('../src/dictionary/data', import.meta.url), { recursive: true });
const direct = { en: 'EN' };
for (const [file, name] of Object.entries(direct)) writeFileSync(new URL(`../src/dictionary/data/${file}.json`, import.meta.url), JSON.stringify(extractArray(name)));
for (const [file, name] of Object.entries({ fr: 'FR', es: 'ES', de: 'DE', it: 'IT', pt: 'PT', nl: 'NL' })) writeFileSync(new URL(`../src/dictionary/data/${file}.json`, import.meta.url), JSON.stringify(conv(extractArray(name))));
console.log('converted: en fr es de it pt nl');
