import type { SubtitleCue } from '../types';
// VISUS generic video-site support — original implementation.
// Sluka-class players differ, but accessible captions converge on two
// shapes VISUS can read without any DRM bypass: timed-text files
// (WebVTT / SRT) and HTML5 <track> elements the page itself exposes.
export type VideoSite = 'youtube' | 'netflix' | 'disney' | 'crunchyroll' | 'bilibili' | 'twitch' | 'viki' | 'generic';
export function detectVideoSite(hostname: string): VideoSite {
  const h = hostname.toLowerCase();
  if (/(^|\.)youtube\.com$/.test(h) || h === 'youtu.be') return 'youtube';
  if (/(^|\.)netflix\.com$/.test(h)) return 'netflix';
  if (/(^|\.)disneyplus\.com$/.test(h) || /(^|\.)hotstar\.com$/.test(h)) return 'disney';
  if (/(^|\.)crunchyroll\.com$/.test(h)) return 'crunchyroll';
  if (/(^|\.)bilibili\.com$/.test(h) || h === 'b23.tv') return 'bilibili';
  if (/(^|\.)twitch\.tv$/.test(h)) return 'twitch';
  if (/(^|\.)viki\.com$/.test(h)) return 'viki';
  return 'generic';
}
export const SITE_LABEL: Record<VideoSite, string> = {
  youtube: 'YouTube', netflix: 'Netflix', disney: 'Disney+', crunchyroll: 'Crunchyroll',
  bilibili: 'Bilibili', twitch: 'Twitch', viki: 'Viki', generic: 'HTML5 video',
};
const stamp = (s: string) => {
  const p = s.trim().replace(',', '.').split(':').map(Number);
  if (p.some(Number.isNaN)) return 0;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] ?? 0;
};
export function parseTimedText(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const block of String(text ?? '').replace(/^WEBVTT.*$/m, '').split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const timing = lines.find(l => l.includes('-->'));
    if (!timing) continue;
    const [a, b] = timing.split('-->');
    const body = lines.filter(l => l !== timing && !/^\d+$/.test(l)).join(' ')
      .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (body) cues.push({ start: stamp(a), end: stamp(b.trim().split(/\s+/)[0]), text: body });
  }
  return normalizeCues(cues);
}
export function normalizeCues(cues: SubtitleCue[]): SubtitleCue[] {
  const seen = new Set<string>();
  return [...cues].filter(c => c.text?.trim() && c.end > c.start)
    .sort((a, b) => a.start - b.start)
    .filter(c => { const k = `${c.start}|${c.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
/** Cues from <track> elements the page exposes (never DRM-protected streams). */
export function cuesFromTextTracks(video: HTMLVideoElement): SubtitleCue[] {
  const out: SubtitleCue[] = [];
  for (const track of [...video.textTracks]) {
    if (!track.cues) continue;
    for (const cue of [...track.cues]) out.push({ start: cue.startTime, end: cue.endTime, text: ((cue as VTTCue).text ?? '').replace(/<[^>]+>/g, '').trim() });
  }
  return normalizeCues(out);
}
