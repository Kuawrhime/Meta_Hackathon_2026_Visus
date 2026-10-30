// Converts downloaded dictionary sources in .dict-src/ into sharded,
// license-carrying datasets under public/dictionaries/<id>/.
// Sources must be downloaded first (see docs/DICTIONARIES.md). Never hand-edit
// the generated shards. Run: node scripts/build-dictionaries/convert-all.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, createReadStream } from 'node:fs';
import { gunzipSync, createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

const OUT = 'public/dictionaries';
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const HAN = new Set(['zh', 'ja', 'ko', 'yue']);
export function shardKey(word, lang) {
  const w = (word ?? '').trim(); if (!w) return 'other';
  if (HAN.has(lang)) return 'c' + w.codePointAt(0).toString(16);
  const ch = w[0].toLowerCase();
  return /[a-zà-ÿа-яa-ö]/.test(ch) ? ch : 'other';
}
function writeDataset(id, lang, rows, meta) {
  const dir = `${OUT}/${id}`; mkdirSync(dir, { recursive: true });
  const shards = new Map();
  for (const r of rows) { const k = shardKey(r[1] || r[0], lang); (shards.get(k) ?? shards.set(k, []).get(k)).push(r); }
  const files = {}; let totalBytes = 0;
  for (const [k, rs] of shards) { const name = `s-${k}.json`; const buf = Buffer.from(JSON.stringify(rs)); writeFileSync(`${dir}/${name}`, buf); files[k] = name; totalBytes += buf.length; }
  const index = { id, language: lang, version: meta.version, license: meta.license, attribution: meta.attribution, sourceUrl: meta.sourceUrl, downloadedAt: meta.downloadedAt, transformations: meta.transformations, entries: rows.length, shards: files, bytes: totalBytes };
  const buf = Buffer.from(JSON.stringify(index, null, 1)); writeFileSync(`${dir}/index.json`, buf);
  console.log(`${id}: ${rows.length} rows, ${Object.keys(files).length} shards, ${(totalBytes / 1048576).toFixed(1)} MB, index sha256 ${sha(buf).slice(0, 16)}…`);
  return index;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, '').trim();

// ---------- CC-CEDICT ----------
const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ', A: 'ĀÁǍÀ', E: 'ĒÉĚÈ', O: 'ŌÓǑÒ', U: 'ŪÚǓÙ' };
function pinyinMarks(num) {
  return num.split(' ').map((syl) => {
    const m = syl.match(/^(.*?)([aeiouüÜ]+)(.*?)([1-5])$/i); if (!m) return syl.replace(/u:/g, 'ü');
    const tone = parseInt(m[4]); if (tone === 5) return syl.slice(0, -1).replace(/u:/g, 'ü');
    let vow = m[2].replace(/u:/gi, (c) => c === 'U' ? 'Ü' : 'ü');
    let idx = vow.search(/a/i) >= 0 ? vow.search(/a/i) : vow.search(/e/i) >= 0 ? vow.search(/e/i) : vow.search(/ou/i) >= 0 ? vow.search(/ou/i) : vow.length - 1;
    const ch = vow[idx]; const rep = (TONES[ch.toLowerCase()] ?? '')[tone - 1] ?? ch;
    vow = vow.slice(0, idx) + (ch === ch.toUpperCase() && rep ? rep.toUpperCase() : rep) + vow.slice(idx + 1);
    return (m[1] + vow + m[3]).replace(/u:/g, 'ü');
  }).join(' ');
}
function convertCedict() {
  const text = gunzipSync(readFileSync('.dict-src/cedict.txt.gz')).toString('utf8');
  const rows = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+) (\S+) \[([^\]]+)\] \/(.+)\/$/); if (!m) continue;
    const defs = m[4].split('/').filter(Boolean).slice(0, 5); const py = pinyinMarks(m[3]);
    for (const d of defs) rows.push([m[2], m[2], py, '', d, d, '', 9999, m[1] !== m[2] ? [m[1]] : []]);
  }
  writeDataset('cc-cedict', 'zh', rows, { version: '1.0 (MDBG export, downloaded 2026-11-03)', license: 'CC BY-SA 3.0', attribution: 'CC-CEDICT — © MDBG / CC-CEDICT project', sourceUrl: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', downloadedAt: '2026-11-03', transformations: ['numbered pinyin -> tone marks', 'one row per sense (max 5 senses per entry)', 'traditional form kept in forms[]', 'frequency unknown -> 9999 (never invented)'] });
}

// ---------- JMdict (common-priority subset) ----------
function convertJmdict() {
  const xml = gunzipSync(readFileSync('.dict-src/JMdict_e.gz')).toString('utf8');
  const rows = []; const entries = xml.split('<entry>').slice(1);
  for (const e of entries) {
    const common = /<(ke_pri|re_pri)>(news1|ichi1|spec1|gai1|nf\d+)<\//.test(e);
    if (!common) continue;
    const keb = (e.match(/<keb>([^<]+)<\/keb>/) ?? [])[1]; const reb = (e.match(/<reb>([^<]+)<\/reb>/) ?? [])[1]; if (!reb) continue;
    const word = keb ?? reb;
    for (const sense of e.split('<sense>').slice(1, 4)) {
      const pos = decode((sense.match(/<pos>&([^;]+);/) ?? [])[1] ?? '');
      const gloss = (sense.match(/<gloss>([^<]+)<\/gloss>/) ?? [])[1]; if (!gloss) continue;
      rows.push([word, word, reb, pos, decode(gloss), decode(gloss), '', 9999, keb ? [reb] : []]);
    }
  }
  writeDataset('jmdict', 'ja', rows, { version: 'JMdict_e (downloaded 2026-11-03)', license: 'EDRDG License (CC BY-SA 3.0 conditions)', attribution: 'JMdict © Electronic Dictionary Research and Development Group (EDRDG)', sourceUrl: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz', downloadedAt: '2026-11-03', transformations: ['common-priority subset only (ke_pri/re_pri: news1, ichi1, spec1, gai1, nf*) — documented subset, not the full dictionary', 'one row per sense (max 3 senses)', 'reading (kana) as phonetic'] });
}

// ---------- Open English WordNet (Princeton format in the OEWN zip) ----------
function findFile(root, name) { for (const e of readdirSync(root, { withFileTypes: true })) { const p = `${root}/${e.name}`; if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; } else if (e.name === name) return p; } return undefined; }
function convertWordnet() {
  const dir = '.dict-src/wordnet'; const rows = [];
  const posName = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };
  for (const pos of ['noun', 'verb', 'adj', 'adv']) {
    const dataPath = findFile(dir, `data.${pos}`); if (!dataPath) continue;
    const gloss = new Map();
    for (const line of readFileSync(dataPath, 'utf8').split('\n')) {
      if (!line || line.startsWith(' ')) continue; const parts = line.split('|'); if (parts.length < 2) continue;
      gloss.set(line.slice(0, 8), parts[1].trim().split('; "')[0].trim());
    }
    const idxPath = findFile(dir, `index.${pos}`); if (!idxPath) continue;
    for (const line of readFileSync(idxPath, 'utf8').split('\n')) {
      if (!line || line.startsWith(' ')) continue; const f = line.trim().split(/\s+/); const lemma = f[0].replace(/_/g, ' ');
      // index.<pos>: lemma pos synset_cnt p_cnt [ptr_symbol...] sense_cnt tagsense_cnt synset_offset...
      const senseCnt = parseInt(f[2 + 1 + parseInt(f[3] ?? '0') + 1] ?? '0', 10); void senseCnt;
      const offs = f.slice(-parseInt(f[2], 10) || 0);
      const first = offs.map(o => gloss.get(o)).find(Boolean); if (!first) continue;
      rows.push([lemma, lemma.toLowerCase(), '', posName[f[1]] ?? f[1], first, first, '', 9999, []]);
    }
  }
  writeDataset('wordnet', 'en', rows, { version: 'Open English WordNet 2024 (Princeton WordNet format)', license: 'CC BY 4.0 (OEWN) / WordNet License (Princeton)', attribution: 'Open English WordNet 2024 © Global WordNet Association; derived from Princeton WordNet', sourceUrl: 'https://github.com/globalwordnet/english-wordnet/releases/download/2024-edition/english-wordnet-2024.zip', downloadedAt: '2026-11-03', transformations: ['index+data files joined on synset offset', 'first gloss per lemma as definition (examples after ; dropped)', 'frequency unknown -> 9999'] });
}

// ---------- FreeDict (TEI, reverse pairs: target language -> English) ----------
function convertFreedict() {
  const pairs = [['fra-eng', 'fr'], ['deu-eng', 'de'], ['spa-eng', 'es'], ['ita-eng', 'it'], ['eng-fra', 'en'], ['eng-deu', 'en'], ['eng-spa', 'en'], ['eng-ita', 'en']];
  const byLang = new Map();
  for (const [pair, lang] of pairs) {
    const base = `.dict-src/fd-${pair}`; if (!existsSync(base)) continue;
    const tei = readdirSync(base, { recursive: true }).map(String).find(f => f.endsWith('.tei')); if (!tei) continue;
    const xml = readFileSync(`${base}/${tei.replace(/\\/g, '/')}`, 'utf8');
    for (const e of xml.split('<entry').slice(1)) {
      const orth = decode((e.match(/<orth>([^<]+)<\/orth>/) ?? [])[1] ?? ''); if (!orth) continue;
      const pron = decode((e.match(/<pron>([^<]+)<\/pron>/) ?? [])[1] ?? '');
      const pos = decode((e.match(/<pos>([^<]+)<\/pos>/) ?? [])[1] ?? '');
      const trans = [...e.matchAll(/<cit type="trans"[^>]*>.*?<quote>([^<]+)<\/quote>/gs)].map(m => decode(m[1])).filter(Boolean).slice(0, 3);
      const defs = trans.length ? trans : [...e.matchAll(/<def>([^<]+)<\/def>/g)].map(m => decode(m[1])).slice(0, 2);
      for (const d of defs) (byLang.get(lang) ?? byLang.set(lang, []).get(lang)).push([orth, orth.toLowerCase(), pron, pos, d, d, '', 9999, []]);
    }
    const copying = readdirSync(base, { recursive: true }).map(String).find(f => /(^|\/)COPYING$/.test(f.replace(/\\/g, '/')));
    if (copying) { mkdirSync('public/dictionaries/licenses', { recursive: true }); writeFileSync(`public/dictionaries/licenses/freedict-${pair}.txt`, readFileSync(`${base}/${copying.replace(/\\/g, '/')}`)); }
  }
  for (const [lang, rows] of byLang) writeDataset(`freedict-${lang}`, lang, rows, { version: 'FreeDict (downloaded 2026-11-03)', license: 'Per-pair license in public/dictionaries/licenses/freedict-*.txt (GPL/CC family — see file)', attribution: 'FreeDict project (freedict.org)', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', transformations: ['TEI entries parsed (orth/pron/pos/translation)', 'reverse pairs included so headwords are in the learning language', 'max 3 translations per entry as separate senses'] });
}

// ---------- Wiktionary / Wiktextract (Korean kaikki extract, streamed) ----------
async function convertWiktionaryKo() {
  const rows = []; const rl = createInterface({ input: createReadStream('.dict-src/kaikki-ko.jsonl'), crlfDelay: Infinity });
  for await (const line of rl) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.lang_code !== 'ko' || !e.word || e.word.length > 10) continue;
    const roman = e.forms?.find(f => f.roman)?.roman ?? e.sounds?.find(s => s.roman)?.roman ?? '';
    for (const s of (e.senses ?? []).slice(0, 3)) { const g = s.glosses?.[0]; if (g) rows.push([e.word, e.word, roman, e.pos ?? '', g, g, '', 9999, []]); }
  }
  writeDataset('wiktionary', 'ko', rows, { version: 'kaikki.org Wiktextract Korean extract (downloaded 2026-11-03)', license: 'CC BY-SA 4.0 (Wiktionary) / GFDL', attribution: 'Wiktionary contributors, extracted by Wiktextract (kaikki.org)', sourceUrl: 'https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl', downloadedAt: '2026-11-03', transformations: ['streamed JSONL, Korean entries only', 'max 3 senses, first gloss each', 'romanization from forms/sounds when present', 'words >10 chars skipped'] });
}

const only = process.argv[2];
if (!only || only === 'cedict') convertCedict();
if (!only || only === 'jmdict') convertJmdict();
if (!only || only === 'wordnet') convertWordnet();
if (!only || only === 'freedict') convertFreedict();
if (!only || only === 'wiktionary') await convertWiktionaryKo();
console.log('done');
