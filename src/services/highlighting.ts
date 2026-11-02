import type { LangCode, WordStatus } from '../types';
import { segmentText, normalizeWord, lemmatize } from './segmentation';
import { shouldProcessText, tokenMatchesLearning } from './languageFilter';

export const SKIP_SELECTOR = 'script,style,noscript,textarea,input,select,option,code,pre,kbd,samp,[contenteditable="true"],[data-lf-skip],.lf-ui,#lf-tooltip,#lf-panel,#lf-counter,#lf-subtitles';
export const WORD_CLASS = 'lf-w';

export interface HighlightCallbacks {
  onEncounter?: (lemma: string, word: string) => void;
}
export interface HighlightStats { total: number; byStatus: Record<string, number>; }

export function statusOf(word: string, lang: LangCode, map: Map<string, WordStatus>): WordStatus {
  return map.get(lemmatize(word, lang)) ?? map.get(normalizeWord(word, lang)) ?? 'new';
}

const BLOCK_SELECTOR = 'p,li,h1,h2,h3,h4,h5,h6,td,dd,dt,blockquote,figcaption,article,section,div,span';
const blockTextCache = new WeakMap<Node, boolean>();
export function blockAllows(node: Text, lang: LangCode): boolean {
  const block = (node.parentElement?.closest(BLOCK_SELECTOR) as Element | null) ?? node.parentElement;
  if (!block) return true;
  const cached = blockTextCache.get(block); if (cached !== undefined) return cached;
  const text = (block.textContent ?? '').slice(0, 600);
  // Short fragments (menu items, labels) are interface text: only process when their own script matches.
  const ok = shouldProcessText(text, lang, text.trim().length < 40 ? 0.45 : 0.5);
  blockTextCache.set(block, ok); return ok;
}
/** Wrap word tokens of a single text node in <span class="lf-w">. Returns number of words wrapped. */
export function highlightTextNode(node: Text, lang: LangCode, map: Map<string, WordStatus>, cb?: HighlightCallbacks): number {
  const text = node.nodeValue ?? '';
  if (!text.trim()) return 0;
  if (!blockAllows(node, lang)) return 0;
  const tokens = segmentText(text, lang);
  if (!tokens.some(t => t.isWord)) return 0;
  const frag = document.createDocumentFragment();
  let count = 0;
  for (const tok of tokens) {
    if (!tok.isWord || !tokenMatchesLearning(tok.text, lang)) { frag.appendChild(document.createTextNode(tok.text)); continue; }
    const span = document.createElement('span');
    const status = statusOf(tok.text, lang, map);
    const lemma = lemmatize(tok.text, lang);
    span.className = `${WORD_CLASS} lf-${status}`;
    span.dataset.lemma = lemma; span.dataset.word = normalizeWord(tok.text, lang); span.dataset.status = status; span.dataset.lang = lang;
    span.textContent = tok.text;
    frag.appendChild(span); count++;
    cb?.onEncounter?.(lemma, tok.text);
  }
  node.parentNode?.replaceChild(frag, node);
  return count;
}

export function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const parent = (n as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (parent.classList.contains(WORD_CLASS)) return NodeFilter.FILTER_REJECT;
      const text = n.nodeValue ?? '';
      return text.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let cur: Node | null;
  while ((cur = walker.nextNode())) nodes.push(cur as Text);
  return nodes;
}

export function highlightRoot(root: Node, lang: LangCode, map: Map<string, WordStatus>, cb?: HighlightCallbacks): HighlightStats {
  const stats: HighlightStats = { total: 0, byStatus: {} };
  for (const node of collectTextNodes(root)) {
    try { const c = highlightTextNode(node, lang, map, cb); stats.total += c; } catch { /* node detached mid-walk */ }
  }
  root instanceof Element && root.querySelectorAll(`.${WORD_CLASS}`).forEach(el => {
    const s = (el as HTMLElement).dataset.status ?? 'new'; stats.byStatus[s] = (stats.byStatus[s] ?? 0) + 1;
  });
  return stats;
}

/** Update every rendered occurrence of a lemma after grading — no re-scan of the page needed. */
export function refreshWordEverywhere(lemma: string, status: WordStatus, root: ParentNode = document) {
  root.querySelectorAll(`.${WORD_CLASS}[data-lemma="${CSS.escape(lemma)}"]`).forEach(el => {
    const h = el as HTMLElement; h.dataset.status = status; h.className = `${WORD_CLASS} lf-${status}`;
  });
}

export function pageCounts(root: ParentNode = document): HighlightStats {
  const stats: HighlightStats = { total: 0, byStatus: {} };
  root.querySelectorAll(`.${WORD_CLASS}`).forEach(el => { const s = (el as HTMLElement).dataset.status ?? 'new'; stats.byStatus[s] = (stats.byStatus[s] ?? 0) + 1; stats.total++; });
  return stats;
}

export const HighlightingService = { highlightRoot, highlightTextNode, refreshWordEverywhere, pageCounts, statusOf };
