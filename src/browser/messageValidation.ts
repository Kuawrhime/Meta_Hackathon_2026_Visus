import type { LangCode, WordStatus } from '../types';

// Strict runtime validation for every content-script -> background message.
// Webpage content is never trusted: unknown types, bad enums and oversized
// payloads are rejected before any privileged function runs.
export const LANGS: LangCode[] = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru', 'nl', 'ar', 'yue', 'th', 'vi', 'sv', 'da', 'no', 'fi', 'pl', 'uk', 'el', 'tr', 'id'];
export const STATUSES: WordStatus[] = ['new', 'l1', 'l2', 'l3', 'l4', 'known', 'ignored'];
const TYPES = ['LF_GET_SETTINGS', 'LF_SET_SETTINGS', 'LF_STATUS_MAP', 'LF_ENCOUNTERS', 'LF_SET_STATUS', 'LF_GET_WORD', 'LF_SET_DEF', 'LF_ADD_READING', 'LF_ADD_LISTENING', 'LF_OPEN_DASHBOARD', 'LF_OPEN_READER'] as const;
export type ExtMessageType = (typeof TYPES)[number];
export interface ValidMessage { type: ExtMessageType; lang?: LangCode; word?: string; status?: WordStatus; words?: string[]; def?: string; seconds?: number; url?: string; patch?: Record<string, unknown>; }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const lang = (v: unknown): LangCode | undefined => typeof v === 'string' && (LANGS as string[]).includes(v) ? v as LangCode : undefined;
const str = (v: unknown, max: number): string | undefined => typeof v === 'string' && v.length <= max ? v : undefined;
const clampSec = (v: unknown): number => { const n = typeof v === 'number' && Number.isFinite(v) ? v : 0; return Math.max(0, Math.min(60, n)); };

export function validateMessage(raw: unknown): ValidMessage | null {
  if (!isObj(raw) || typeof raw.type !== 'string' || !(TYPES as readonly string[]).includes(raw.type)) return null;
  const type = raw.type as ExtMessageType;
  switch (type) {
    case 'LF_GET_SETTINGS': case 'LF_OPEN_DASHBOARD': return { type };
    case 'LF_SET_SETTINGS': return isObj(raw.patch) ? { type, patch: raw.patch } : null;
    case 'LF_STATUS_MAP': { const l = lang(raw.lang); return l ? { type, lang: l } : null; }
    case 'LF_ENCOUNTERS': {
      const l = lang(raw.lang); if (!l || !Array.isArray(raw.words)) return null;
      return { type, lang: l, words: raw.words.slice(0, 500).filter((w): w is string => typeof w === 'string' && w.length <= 100) };
    }
    case 'LF_SET_STATUS': { const l = lang(raw.lang); const w = str(raw.word, 100); const s = typeof raw.status === 'string' && (STATUSES as string[]).includes(raw.status) ? raw.status as WordStatus : undefined; return l && w && s ? { type, lang: l, word: w, status: s } : null; }
    case 'LF_GET_WORD': { const l = lang(raw.lang); const w = str(raw.word, 100); return l && w ? { type, lang: l, word: w } : null; }
    case 'LF_SET_DEF': { const l = lang(raw.lang); const w = str(raw.word, 100); const d = str(raw.def, 1000); return l && w && d !== undefined ? { type, lang: l, word: w, def: d } : null; }
    case 'LF_ADD_READING': case 'LF_ADD_LISTENING': { const l = lang(raw.lang); return l ? { type, lang: l, seconds: clampSec(raw.seconds) } : null; }
    case 'LF_OPEN_READER': { const u = str(raw.url, 2048); return u && /^https?:\/\//i.test(u) ? { type, url: u } : null; }
    default: return null;
  }
}

/** Only our own extension contexts may invoke privileged handlers. */
export function isOwnSender(sender: unknown, ownId: string | undefined): boolean {
  if (!sender || typeof sender !== 'object') return false;
  const s = sender as { id?: string; url?: string };
  if (ownId && s.id) return s.id === ownId;
  // Content scripts have no extension-page URL; background/popup/dashboard do.
  // With no id available (unit tests), accept only extension-protocol URLs.
  return typeof s.url === 'string' && /^(chrome-extension|moz-extension):\/\//.test(s.url);
}
