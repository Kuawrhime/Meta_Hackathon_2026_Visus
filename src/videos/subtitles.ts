import type { SubtitleCue } from '../types';
import { parseTimedText, normalizeCues } from './sites';
import { currentCueIndex } from './youtube';
// SubtitleParser + SubtitleSynchronizer — original VISUS implementation.
// Imported subtitle text is treated as plain text end to end: cues are
// rendered with text nodes only, never as HTML.
export type SubtitleFormat = 'srt' | 'vtt';
const MAX_SUBTITLE_BYTES = 2_000_000;
export function detectSubtitleFormat(text: string): SubtitleFormat {
  return /^\s*WEBVTT/.test(text) ? 'vtt' : 'srt';
}
export function parseSubtitleFile(text: string, format?: SubtitleFormat): { format: SubtitleFormat; cues: SubtitleCue[] } {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Subtitle file is empty.');
  if (text.length > MAX_SUBTITLE_BYTES) throw new Error('Subtitle file too large (max 2 MB).');
  if (!text.includes('-->')) throw new Error('No subtitle timings found — expected SRT or WebVTT.');
  const cues = parseTimedText(text.replace(/^\uFEFF/, ''));
  if (!cues.length) throw new Error('No readable subtitle lines found.');
  return { format: format ?? detectSubtitleFormat(text), cues };
}
export const parseSrt = (text: string) => parseSubtitleFile(text, 'srt').cues;
export const parseVtt = (text: string) => parseSubtitleFile(text, 'vtt').cues;
export function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export class SubtitleSynchronizer {
  cues: SubtitleCue[];
  constructor(cues: SubtitleCue[]) { this.cues = normalizeCues(cues); }
  indexAt(time: number, offsetMs = 0): number { return currentCueIndex(this.cues, time + offsetMs / 1000); }
  cueAt(time: number, offsetMs = 0): SubtitleCue | undefined { const i = this.indexAt(time, offsetMs); return i >= 0 ? this.cues[i] : undefined; }
  search(query: string): Array<{ index: number; cue: SubtitleCue }> {
    const q = query.trim().toLowerCase(); if (!q) return this.cues.map((cue, index) => ({ index, cue }));
    return this.cues.map((cue, index) => ({ index, cue })).filter(x => x.cue.text.toLowerCase().includes(q));
  }
}
export interface VideoStats { sentences: number; uniqueWords: number; newWords: number; learningWords: number; knownWords: number; seconds: number }
export function computeVideoStats(seenCues: SubtitleCue[], lemmasOf: (text: string) => string[], statusOf: (lemma: string) => string, seconds = 0): VideoStats {
  const words = new Set<string>(); let newWords = 0, learningWords = 0, knownWords = 0; const counted = new Set<string>();
  for (const cue of seenCues) for (const lemma of lemmasOf(cue.text)) {
    words.add(lemma); if (counted.has(lemma)) continue; counted.add(lemma);
    const st = statusOf(lemma);
    if (st === 'known') knownWords++; else if (st === 'new') newWords++; else if (st.startsWith('l')) learningWords++;
  }
  return { sentences: seenCues.length, uniqueWords: words.size, newWords, learningWords, knownWords, seconds };
}
