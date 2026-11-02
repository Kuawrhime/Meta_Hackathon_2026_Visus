// Reader extraction: readability-style main-content detection (largest text-density block), no external service.
export interface Article { title: string; html: string; text: string; url: string; }
const JUNK = 'script,style,noscript,nav,header,footer,aside,form,button,[role="navigation"],[class*="ad-"],[id*="cookie"],[class*="popup"],[class*="newsletter"]';
export function extractFromDocument(doc: Document, url: string): Article {
  const clone = doc.cloneNode(true) as Document;
  clone.querySelectorAll(JUNK).forEach(n => n.remove());
  let best: Element | null = null; let bestScore = 0;
  clone.querySelectorAll('article,main,section,div').forEach(el => {
    const text = (el.textContent ?? '').trim(); if (text.length < 200) return;
    const links = [...el.querySelectorAll('a')].reduce((a, aEl) => a + (aEl.textContent ?? '').length, 0);
    const score = text.length - links * 2 + el.querySelectorAll('p').length * 120;
    if (score > bestScore) { bestScore = score; best = el; }
  });
  const root = (best as Element | null) ?? clone.body;
  const html = root ? root.innerHTML : '';
  const text = (root?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { title: doc.title || url, html, text, url };
}
export async function fetchArticle(url: string): Promise<Article> {
  const res = await fetch(url); if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const htmlText = await res.text();
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  return extractFromDocument(doc, url);
}
