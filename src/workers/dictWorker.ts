// Web Worker: off-main-thread text segmentation for large pages/books.
import { segmentText } from '../services/segmentation';
import type { LangCode } from '../types';
self.onmessage = (e: MessageEvent<{ id: number; text: string; lang: LangCode }>) => {
  const { id, text, lang } = e.data;
  const tokens = segmentText(text, lang);
  (self as unknown as Worker).postMessage({ id, tokens });
};
