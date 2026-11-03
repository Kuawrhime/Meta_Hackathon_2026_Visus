import type { SubtitleCue } from '../types';
import { findCaptionTracks, fetchCues, type CaptionTrack } from './youtube';
import { detectVideoSite, cuesFromTextTracks, type VideoSite } from './sites';
// Platform adapters — original VISUS implementation. Every adapter only
// uses interfaces the page itself exposes: YouTube caption tracks from
// player data, HTML5 text tracks, or subtitle text visibly rendered by
// the player. No DRM bypass, no protected buffers, no private APIs.
export interface VideoAdapter {
  site: VideoSite;
  isWatchPage(url: string): boolean;
  videoKey(url: string): string;
  getVideo(): HTMLVideoElement | null;
  getTitle(): string;
}
const videoEl = (): HTMLVideoElement | null => document.querySelector('video');
function ytId(url: string): string {
  try { const u = new URL(url); return u.searchParams.get('v') ?? u.pathname; } catch { return url; }
}
export const YouTubeAdapter: VideoAdapter & { tracks(): CaptionTrack[]; loadCues(langPrefix?: string): Promise<{ track: CaptionTrack; cues: SubtitleCue[] } | null> } = {
  site: 'youtube',
  isWatchPage: (url) => { try { const u = new URL(url); return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch'; } catch { return false; } },
  videoKey: (url) => 'yt:' + ytId(url),
  getVideo: videoEl,
  getTitle: () => document.querySelector('h1.ytd-watch-metadata, h1.title, #title h1')?.textContent?.trim() ?? document.title.replace(/ - YouTube$/, ''),
  tracks: () => findCaptionTracks(),
  async loadCues(langPrefix) {
    const tracks = findCaptionTracks(); if (!tracks.length) return null;
    const track = (langPrefix ? tracks.find(t => t.languageCode.startsWith(langPrefix)) : undefined) ?? tracks[0];
    return { track, cues: await fetchCues(track) };
  },
};
export const NETFLIX_TEXT_SELECTOR = '.player-timedtext-text-container, .player-timedtext, [data-uia="player-timedtext"]';
export function extractVisibleSubtitleText(root: Pick<Document, 'querySelectorAll'> = document): string {
  const parts: string[] = [];
  root.querySelectorAll(NETFLIX_TEXT_SELECTOR).forEach(el => {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t && !parts.includes(t)) parts.push(t);
  });
  return parts.join(' ').trim();
}
export const NetflixAdapter: VideoAdapter & { visibleSubtitle(): string; hasAccessibleSubtitles(): boolean } = {
  site: 'netflix',
  isWatchPage: (url) => { try { const u = new URL(url); return /(^|\.)netflix\.com$/.test(u.hostname) && /^\/(watch|title)/.test(u.pathname); } catch { return false; } },
  videoKey: (url) => { try { return 'nf:' + new URL(url).pathname; } catch { return 'nf:' + url; } },
  getVideo: videoEl,
  getTitle: () => document.querySelector('[data-uia="video-title"], .video-title, h1')?.textContent?.trim() ?? document.title.replace(/ - Netflix.*$/, ''),
  visibleSubtitle: () => extractVisibleSubtitleText(),
  hasAccessibleSubtitles: () => extractVisibleSubtitleText().length > 0,
};
export const GenericHTML5VideoAdapter: VideoAdapter & { loadCues(): SubtitleCue[] } = {
  site: 'generic',
  isWatchPage: () => !!document.querySelector('video'),
  videoKey: (url) => 'html5:' + url.split('?')[0],
  getVideo: videoEl,
  getTitle: () => document.title,
  loadCues: () => { const v = videoEl(); return v ? cuesFromTextTracks(v) : []; },
};
export function adapterFor(url: string): VideoAdapter {
  const site = detectVideoSite(new URL(url).hostname);
  if (site === 'youtube') return YouTubeAdapter;
  if (site === 'netflix') return NetflixAdapter;
  return GenericHTML5VideoAdapter;
}
export type { CaptionTrack };
