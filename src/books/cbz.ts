import JSZip from 'jszip';
// VISUS CBZ (comic archive) support — original implementation.
// A .cbz is a ZIP of page images; VISUS lists pages in read order and
// keeps the archive local in IndexedDB like every other book format.
const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;
const MAX_ENTRIES = 2000;
export async function listCbzPages(buf: ArrayBuffer): Promise<string[]> {
  if (buf.byteLength > 100_000_000) throw new Error('CBZ too large (max 100 MB)');
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir && IMAGE_RE.test(n));
  if (names.length > MAX_ENTRIES) throw new Error('CBZ has too many pages');
  return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
export const isCbzFile = (name: string) => /\.cbz$/i.test(name);
