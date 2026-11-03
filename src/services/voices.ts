import type { LangCode } from '../types';
// VISUS local voice synthesis — original implementation.
// "Local" means voices the browser/OS provides on-device
// (SpeechSynthesisVoice.localService). VISUS prefers those voices,
// never uploads text for speech, and says so in the catalogue.
export interface VoiceInfo { name: string; lang: string; local: boolean; isDefault: boolean }
type VoiceLike = { name: string; lang: string; localService?: boolean; default?: boolean };
export function voiceCatalogue(lang?: LangCode, voices?: VoiceLike[]): VoiceInfo[] {
  let all: VoiceLike[] = voices ?? [];
  if (!voices) {
    try { all = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []; } catch { all = []; }
  }
  const want = lang ? (lang === 'zh' ? 'zh' : lang === 'yue' ? 'yue' : lang) : null;
  return all
    .filter(v => !want || v.lang.toLowerCase().startsWith(want))
    .map(v => ({ name: v.name, lang: v.lang, local: !!v.localService, isDefault: !!v.default }))
    .sort((a, b) => Number(b.local) - Number(a.local) || a.name.localeCompare(b.name));
}
export function pickVoice(lang: LangCode, preferredName: string, voices: VoiceLike[], offlineOnly: boolean): VoiceLike | undefined {
  const catalogue = voiceCatalogue(lang, voices);
  const byName = preferredName ? voices.find(v => v.name === preferredName) : undefined;
  if (byName && (!offlineOnly || byName.localService)) return byName;
  const pool = offlineOnly ? catalogue.filter(v => v.local) : catalogue;
  const match = pool.find(v => voices.some(x => x.name === v.name));
  return match ? voices.find(v => v.name === match.name) : voices[0];
}
