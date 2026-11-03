// TextSegmentationService — Intl.Segmenter first; Chinese dictionary max-match fallback; never whitespace-only for ja/zh/ko/th.
import type { LangCode } from '../types';
import { langInfo } from '../languages';
export interface Token { text: string; start: number; end: number; isWord: boolean; }
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/u;
// Chinese seed lexicon for max-match fallback (extended at runtime from bundled dictionary keys).
const ZH_WORDS = new Set(['我们','你们','他们','学习','中文','中国','语言','学校','学生','老师','朋友','时间','现在','可以','需要','因为','所以','但是','如果','已经','没有','这个','那个','什么','怎么','为什么','非常','喜欢','知道','觉得','希望','问题','工作','生活','世界','大家','今天','明天','昨天','早上','晚上','谢谢','请问','对不起','没关系','苹果日报','传媒','报道','总裁','深圳','交流','访问','表示','自己','罪行','身份','骄傲','获释','提前','举行','活动','参加','惩教署','参观']);
export function registerZhWords(words: Iterable<string>) { for (const w of words) if (w.length > 1) ZH_WORDS.add(w); }
// Numbers, URLs and emails are never vocabulary.
export function isWordToken(t: string): boolean {
  if (!t || /^[\d\p{N}]+$/u.test(t)) return false;
  if (/^(https?:\/\/|www\.|mailto:)/i.test(t) || t.includes('://') || /^\S+@\S+\.\S+$/.test(t)) return false;
  return /\p{L}/u.test(t);
}
// Traditional -> Simplified for common characters (lookup/segmentation normalization; display keeps the original).
const T2S: Record<string, string> = { '圖':'图','張':'张','劍':'剑','歲':'岁','畢':'毕','曆':'历','擔':'担','編':'编','輯':'辑','陞':'升','壹':'一','歡':'欢','慶':'庆','聲':'声','譽':'誉','學':'学','習':'习','國':'国','語':'语','漢':'汉','字':'字','們':'们','這':'这','個':'个','為':'为','麼':'么','時':'时','間':'间','來':'来','還':'还','過':'过','後':'后','會':'会','對':'对','從':'从','到':'到','說':'说','讀':'读','書':'书','寫':'写','聽':'听','見':'见','開':'开','關':'关','門':'门','車':'车','馬':'马','魚':'鱼','鳥':'鸟','龍':'龙','愛':'爱','樂':'乐','藥':'药','醫':'医','院':'院','長':'长','員':'员','業':'业','產':'产','發':'发','現':'现','實':'实','際':'际','應':'应','該':'该','讓':'让','給':'给','向':'向','進':'进','遠':'远','運':'运','動':'动','場':'场','點':'点','線':'线','電':'电','話':'话','號':'号','碼':'码','錢':'钱','銀':'银','鐵':'铁','飛':'飞','機':'机','氣':'气','風':'风','雲':'云','雨':'雨','雪':'雪','山':'山','川':'川','島':'岛','海':'海','灣':'湾','港':'港','廣':'广','東':'东','西':'西','南':'南','北':'北','京':'京','滬':'沪','深':'深','圳':'圳','傳':'传','媒':'媒','報':'报','導':'导','總':'总','裁':'裁','訪':'访','問':'问','參':'参','懲':'惩','署':'署','觀':'观','並':'并','驕':'骄','傲':'傲','獄':'狱','釋':'释','獲':'获','識':'识','認':'认','歷':'历','史':'史','化':'化','統':'统','強':'强','調':'调','諧':'谐','與':'与','衡':'衡','紀':'纪','遺':'遗','斷':'断','髮':'发','展':'展','獨':'独','顯':'显','爲':'为','裡':'里','裏':'里','著':'着' };
export function toSimplified(text: string): string { return [...text].map(c => T2S[c] ?? c).join(''); }
const S2T: Record<string, string> = Object.fromEntries(Object.entries(T2S).map(([t, s]) => [s, t]));
export function toTraditional(text: string): string { return [...text].map(c => S2T[c] ?? c).join(''); }
function isCjk(ch: string) { return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(ch); }
function segmentZh(text: string): Token[] {
  const tokens: Token[] = []; let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { tokens.push({ text: ch, start: i, end: i + 1, isWord: false }); i++; continue; }
    if (!isCjk(ch)) { const m = text.slice(i).match(/^[^\s\u4e00-\u9fff\u3400-\u4dbf]+/); const t = m ? m[0] : ch; tokens.push({ text: t, start: i, end: i + t.length, isWord: WORD_RE.test(t) }); i += t.length; continue; }
    let matched = '';
    for (let len = Math.min(6, text.length - i); len >= 2; len--) { const cand = text.slice(i, i + len); if (ZH_WORDS.has(cand)) { matched = cand; break; } }
    const t = matched || ch; tokens.push({ text: t, start: i, end: i + t.length, isWord: true }); i += t.length;
  }
  return tokens;
}
function segmentIntl(text: string, lang: LangCode): Token[] | null {
  try {
    const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
    if (!Seg) return null;
    const seg = new Seg(lang === 'yue' ? 'zh' : lang, { granularity: 'word' });
    const out: Token[] = [];
    for (const part of seg.segment(text)) out.push({ text: part.segment, start: part.index, end: part.index + part.segment.length, isWord: !!part.isWordLike });
    return out;
  } catch { return null; }
}
function segmentSpace(text: string): Token[] {
  const tokens: Token[] = []; const re = new RegExp(WORD_RE.source, 'gu'); let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > last) tokens.push({ text: text.slice(last, m.index), start: last, end: m.index, isWord: false }); tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length, isWord: true }); last = m.index + m[0].length; }
  if (last < text.length) tokens.push({ text: text.slice(last), start: last, end: text.length, isWord: false });
  return tokens;
}
export function segmentText(text: string, lang: LangCode): Token[] {
  if (!text) return [];
  const info = langInfo(lang);
  let toks: Token[];
  if (info.segmenter === 'dict-zh' || lang === 'zh' || lang === 'yue') toks = segmentIntl(text, lang) ?? segmentZh(text);
  else if (info.segmenter === 'ja' || info.segmenter === 'ko' || info.segmenter === 'intl') toks = segmentIntl(text, lang) ?? segmentSpace(text);
  else if (lang === 'ja' || lang === 'ko' || lang === 'th') toks = segmentIntl(text, lang) ?? segmentSpace(text);
  else toks = segmentSpace(text);
  return toks.map(t => (t.isWord && !isWordToken(t.text) ? { ...t, isWord: false } : t));
}
export function normalizeWord(w: string, lang: LangCode): string {
  let s = w.trim().toLowerCase();
  if (lang === 'ar') s = s.replace(/[ً-ٓ]/g, '');
  if (lang === 'zh' || lang === 'yue') s = toSimplified(s);
  return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}
// Lightweight lemmatizer: dictionary forms first (handled by DictionaryService), then rule-based stripping.
export function lemmatize(word: string, lang: LangCode): string {
  const w = normalizeWord(word, lang); if (!w) return w;
  if (lang === 'en') {
    if (w.endsWith("'s")) return w.slice(0, -2);
    if (/(ies)$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(ing)$/.test(w) && w.length > 5) { const b = w.slice(0, -3); return b.endsWith(b[b.length - 1]) ? b.slice(0, -1) : b; }
    if (/(ed)$/.test(w) && w.length > 4) { const b = w.slice(0, -2); return b.endsWith(b[b.length - 1]) ? b.slice(0, -1) : b; }
    if (/(es)$/.test(w) && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) return w.slice(0, -1);
  }
  if (lang === 'fr' || lang === 'es' || lang === 'it' || lang === 'pt') { if (w.length > 4 && /(s|x)$/.test(w)) return w.slice(0, -1); }
  if (lang === 'de') { if (w.length > 5 && w.endsWith('en')) return w.slice(0, -2); }
  if (lang === 'ko') return lemmatizeKo(w);
  if (lang === 'ar') return lemmatizeAr(w);
  return w;
}
// Korean morphological handling (rule-based, documented limits): strips
// particles/postpositions and common verbal/adjectival endings to reach the
// dictionary stem. This is NOT a full morphological analyzer (no irregular
// conjugation restoration) — unknown stems fall back to the surface form.
const KO_PARTICLES = ['에서는', '에서는', '에게서', '으로부터', '으로부터', '에서', '에게', '으로', '부터', '까지', '처럼', '보다', '은', '는', '이', '가', '을', '를', '에', '도', '만', '의', '와', '과', '로', '이나', '나', '들'];
const KO_ENDINGS = ['습니다', '입니다', '했습니다', '었습', '았습', '겠습니다', '었어요', '았어요', '해요', '어요', '아요', '었다', '았다', '한다', '된다', '이다', '하고', '하면', '에서요'];
export function lemmatizeKo(w: string): string {
  let s = w;
  for (const e of KO_ENDINGS) if (s.length > e.length && s.endsWith(e)) { s = s.slice(0, -e.length); break; }
  for (const p of KO_PARTICLES) if (s.length > p.length && s.endsWith(p)) { s = s.slice(0, -p.length); break; }
  return s;
}
// Arabic morphological handling (rule-based, documented limits): strips
// diacritics/tatweel (in normalize), the definite article and proclitics,
// and common suffix pronouns/plurals; normalizes ة -> ه and hamza forms.
// This is NOT a root-and-pattern analyzer — broken plurals are not restored.
export function lemmatizeAr(w: string): string {
  let s = w.replace(/ـ/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  for (const pre of ['وبال', 'فبال', 'وب', 'فب', 'وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل']) if (s.length > pre.length + 2 && s.startsWith(pre)) { s = s.slice(pre.length); break; }
  for (const suf of ['هما', 'هم', 'هن', 'ها', 'نا', 'ني', 'ه', 'ون', 'ين', 'ات', 'ة']) if (s.length > suf.length + 2 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  return s;
}
export function detectLanguage(text: string): LangCode {
  const t = text.slice(0, 2000);
  if (/[\u0e00-\u0e7f]/.test(t)) return 'th';
  if (/[\u0370-\u03ff]/.test(t)) return 'el';
  if (/[\u3040-\u30ff]/.test(t)) return 'ja';
  if (/[\uac00-\ud7a3]/.test(t)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(t)) return 'zh';
  if (/[\u0600-\u06ff]/.test(t)) return 'ar';
  if (/[\u0400-\u04ff]/.test(t)) return /[іїєґ]/i.test(t) ? 'uk' : 'ru';
  if (/[àâçéèêëîïôûù]/i.test(t)) return 'fr';
  if (/[äöüß]/i.test(t)) return 'de';
  if (/[ñ¿¡]/i.test(t)) return 'es';
  if (/[ãõç]/i.test(t)) return 'pt';
  if (/[àèéìòù]/i.test(t)) return 'it';
  return 'en';
}
export const TextSegmentationService = { segmentText, normalizeWord, lemmatize, lemmatizeKo, lemmatizeAr, detectLanguage, registerZhWords, toSimplified, toTraditional, isWordToken };
