// VISUS offline OCR — original implementation, no remote code.
// Uses the browser's built-in Shape Detection TextDetector where Chrome
// exposes it. Where it is unavailable VISUS says so plainly instead of
// loading a remote OCR engine inside the extension page.
interface TextDetectorLike { detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>> }
export function textDetectorSupported(): boolean {
  return typeof (globalThis as { TextDetector?: unknown }).TextDetector === 'function';
}
export async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const Ctor = (globalThis as { TextDetector?: new () => TextDetectorLike }).TextDetector;
  if (!Ctor) throw new Error('Offline OCR is not available in this browser (no built-in text detection). Type or paste the page text, or open the PDF in a reader with a text layer.');
  const blocks = await new Ctor().detect(canvas);
  const text = blocks.map(b => b.rawValue ?? '').join('\n').trim();
  if (!text) throw new Error('No text was recognised on this page.');
  return text;
}
