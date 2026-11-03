import type { SubtitleCue } from '../types';

// YouTube adapter: reads caption tracks exposed by the player (ytInitialPlayerResponse).
// No DRM bypass: only tracks the platform itself makes available to the page.
export interface CaptionTrack { baseUrl: string; languageCode: string; name: string; }
export function findCaptionTracks(): CaptionTrack[] {
  try {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const t = s.textContent ?? '';
      const idx = t.indexOf('ytInitialPlayerResponse');
      if (idx < 0) continue;
      const start = t.indexOf('{', idx);
      if (start < 0) continue;
      // Balanced-brace extraction of the JSON object.
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let i = start; i < t.length; i++) {
        const c = t[i];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) continue;
      const data = JSON.parse(t.slice(start, end + 1)) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl: string; languageCode: string; name?: { simpleText?: string } }> } } };
      const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      return tracks.map(tr => ({ baseUrl: tr.baseUrl, languageCode: tr.languageCode, name: tr.name?.simpleText ?? tr.languageCode }));
    }
  } catch { /* player data not available yet */ }
  return [];
}

export async function fetchCues(track: CaptionTrack): Promise<SubtitleCue[]> {
  const url = track.baseUrl.includes('fmt=') ? track.baseUrl : track.baseUrl + '&fmt=json3';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Caption fetch failed: ' + res.status);
  const data = await res.json() as { events?: Array<{ tStartMs: number; dDurationMs?: number; segs?: Array<{ utf8: string }> }> };
  return (data.events ?? []).filter(e => e.segs?.length).map(e => ({
    start: e.tStartMs / 1000, end: (e.tStartMs + (e.dDurationMs ?? 2000)) / 1000,
    text: (e.segs ?? []).map(s => s.utf8).join('').replace(/\n/g, ' ').trim(),
  })).filter(c => c.text);
}

export function currentCueIndex(cues: SubtitleCue[], time: number): number {
  let lo = 0, hi = cues.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (cues[mid].start <= time) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans >= 0 && time <= cues[ans].end + 0.5 ? ans : (ans >= 0 && cues[ans + 1] && time < cues[ans + 1].start ? ans : ans);
}

export const isYouTube = () => /(^|\.)youtube\.com$/.test(location.hostname) || location.hostname === 'youtu.be';
export const isChatbotHost = () => /(chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|aistudio\.google\.com)/.test(location.hostname);
export const isVideoHost = () => isYouTube() || !!document.querySelector('video');
