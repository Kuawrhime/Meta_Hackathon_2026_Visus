import type { Settings } from '../types';
import { extStorage } from '../utils/browser';
export const DEFAULT_SETTINGS: Settings = {
  interfaceLang: 'en', learningLang: 'en', nativeLang: 'en', onboarded: false,
  theme: 'system', autoHighlight: true, localOnly: true, translationEnabled: false, aiEnabled: false,
  highlightColors: { new: '#bfdbfe', l1: '#fde047', l2: '#fef08a', l3: '#fef9c3', l4: 'transparent' },
  fontSize: 18, lineHeight: 1.7, readingWidth: 720, tooltipSize: 14, counterPosition: 'bottom-right',
  ttsRate: 1, ttsVoice: '', subtitleFontSize: 20, subtitleAutoPause: false, subtitleShowTranslation: true, subtitleBlur: false,
  syncOffsetMs: 0, licenseKey: '', premium: false, translationProvider: 'none', preferOfflineVoices: true, apiKeys: {},
};
const KEY = 'settings';
let cache: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();
export const SettingsService = {
  async get(force = false): Promise<Settings> {
    if (cache && !force) return cache;
    const raw = await extStorage.get<Settings>(KEY).catch(() => undefined);
    let fromLocal: Settings | undefined;
    try { const l = localStorage.getItem('lf:settings'); if (l) fromLocal = JSON.parse(l); } catch { /* noop */ }
    cache = { ...DEFAULT_SETTINGS, ...(raw ?? fromLocal ?? {}) };
    cache.highlightColors = { ...DEFAULT_SETTINGS.highlightColors, ...(cache.highlightColors ?? {}) };
    cache.apiKeys = cache.apiKeys ?? {};
    return cache;
  },
  async set(patch: Partial<Settings>): Promise<Settings> {
    // Allowlist: only known keys, only matching primitive shapes (never trust callers).
    const clean: Partial<Settings> = {};
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (!(k in DEFAULT_SETTINGS)) continue;
      const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
      if (def !== null && typeof def === 'object') { if (v && typeof v === 'object' && !Array.isArray(v)) (clean as Record<string, unknown>)[k] = v; }
      else if (typeof v === typeof def) (clean as Record<string, unknown>)[k] = v;
    }
    const cur = await this.get(); cache = { ...cur, ...clean };
    await extStorage.set(KEY, cache);
    try { localStorage.setItem('lf:settings', JSON.stringify(cache)); } catch { /* noop */ }
    listeners.forEach(f => f(cache!)); return cache;
  },
  subscribe(fn: (s: Settings) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  cached: () => cache,
};
