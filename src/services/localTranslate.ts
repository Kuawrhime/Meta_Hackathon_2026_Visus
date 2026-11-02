import type { LangCode } from '../types';
import { DictionaryService } from './dictionary';
import { segmentText } from './segmentation';
// VISUS offline translation — original dictionary-gloss engine.
// No network, no neural model download: each word is glossed from the
// bundled offline dictionaries (English definitions), and when the
// target is not English the gloss is mapped back through the target
// dictionary. Unknown words pass through unchanged and are reported,
// never invented. This is a reading gloss, not literary translation.
export interface LocalTranslation { text: string; covered: number; total: number; unknown: string[] }
const MAX_CHARS = 2000;
export function shortGloss(definition: string): string {
  const first = String(definition ?? '').split(/[.;]/)[0].trim();
  return first.replace(/^(a|an|the|to)\s+/i, '').replace(/\s+/g, ' ').slice(0, 60);
}
const reverseCache = new Map<string, string | undefined>();
async function wordForGloss(lang: LangCode, gloss: string): Promise<string | undefined> {
  const heads = gloss.toLowerCase().split(/[^a-zà-ÿ]+/).filter(w => w.length > 2).slice(0, 4);
  for (const head of heads) {
    const key = `${lang}:${head}`;
    if (reverseCache.has(key)) { const hit = reverseCache.get(key); if (hit) return hit; continue; }
    const entries = await DictionaryService.allEntries(lang);
    const found = entries.find(e => e.definition.toLowerCase().includes(head));
    reverseCache.set(key, found?.word);
    if (found) return found.word;
  }
  return undefined;
}
export async function translateLocally(text: string, from: LangCode, to: LangCode): Promise<LocalTranslation> {
  const input = String(text ?? '').slice(0, MAX_CHARS);
  if (!input.trim() || from === to) return { text: input, covered: 0, total: 0, unknown: [] };
  const tokens = segmentText(input, from);
  let covered = 0, total = 0; const unknown: string[] = []; let out = '';
  for (const tok of tokens) {
    if (!tok.isWord) { out += tok.text; continue; }
    total++;
    const entry = await DictionaryService.lookup(from, tok.text);
    const gloss = entry ? shortGloss(entry.definition) : '';
    if (!gloss) { unknown.push(tok.text); out += tok.text; continue; }
    let rendered = gloss;
    if (to !== 'en') rendered = (await wordForGloss(to, gloss)) ?? gloss;
    if (/^\p{Lu}/u.test(tok.text) && rendered) rendered = rendered[0].toUpperCase() + rendered.slice(1);
    covered++; out += rendered;
  }
  return { text: out, covered, total, unknown: [...new Set(unknown)].slice(0, 20) };
}
