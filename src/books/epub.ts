import JSZip from 'jszip';
export interface EpubChapter { title: string; html: string; }
export interface EpubBook { title: string; chapters: EpubChapter[]; toc: string[] }
// Minimal EPUB reader: container.xml -> OPF manifest/spine -> XHTML chapters. Local files only.
const MAX_EPUB_BYTES = 50_000_000, MAX_ENTRIES = 2000, MAX_TOTAL_UNCOMPRESSED = 200_000_000, MAX_CHAPTERS = 500;
export async function parseEpub(buf: ArrayBuffer): Promise<EpubBook> {
  if (buf.byteLength > MAX_EPUB_BYTES) throw new Error('EPUB too large (max 50 MB)');
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ENTRIES) throw new Error('EPUB has too many entries');
  // JSZip internals expose uncompressed size per entry; refuse zip bombs.
  const totalRaw = entries.reduce((n, f) => n + (((f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize) ?? 0), 0);
  if (totalRaw > MAX_TOTAL_UNCOMPRESSED) throw new Error('EPUB expands too large');
  const container = await zip.file('META-INF/container.xml')?.async('text');
  if (!container) throw new Error('Invalid EPUB: missing container.xml');
  const opfPath = new DOMParser().parseFromString(container, 'application/xml').querySelector('rootfile')?.getAttribute('full-path') ?? 'OEBPS/content.opf';
  const opfText = await zip.file(opfPath)?.async('text'); if (!opfText) throw new Error('Invalid EPUB: missing OPF');
  const opf = new DOMParser().parseFromString(opfText, 'application/xml');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = opf.querySelector('title')?.textContent ?? 'Untitled';
  const manifest = new Map<string, string>();
  opf.querySelectorAll('manifest item').forEach(it => manifest.set(it.getAttribute('id') ?? '', it.getAttribute('href') ?? ''));
  const chapters: EpubChapter[] = [];
  for (const itemref of opf.querySelectorAll('spine itemref')) {
    if (chapters.length >= MAX_CHAPTERS) break;
    const href = manifest.get(itemref.getAttribute('idref') ?? ''); if (!href || !/\.x?html?$/i.test(href)) continue;
    const file = zip.file(base + href) ?? zip.file(href); if (!file) continue;
    const xhtml = await file.async('text');
    const doc = new DOMParser().parseFromString(xhtml, 'text/html');
    doc.querySelectorAll('script,style,link').forEach(n => n.remove());
    chapters.push({ title: doc.querySelector('h1,h2,title')?.textContent?.trim() ?? `Chapter ${chapters.length + 1}`, html: doc.body?.innerHTML ?? '' });
  }
  if (!chapters.length) throw new Error('EPUB contains no readable chapters');
  return { title, chapters, toc: chapters.map(c => c.title) };
}
export async function ocrPdfPage(canvas: HTMLCanvasElement): Promise<string> {
  // Offline only: delegates to the browser's built-in text detection.
  // VISUS never loads a remote OCR engine inside the extension page.
  const { ocrCanvas } = await import('../services/ocr');
  return ocrCanvas(canvas);
}
