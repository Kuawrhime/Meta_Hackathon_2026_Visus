import type { LangCode } from '../types';
import { SettingsService } from './settings';
import { voiceCatalogue, pickVoice } from './voices';
// AudioService — local voice synthesis via the browser's on-device
// SpeechSynthesis voices (offline voices preferred), with a spoken
// queue for the Audio deck. Text is never uploaded for speech.
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
export function listVoices(lang?: LangCode): SpeechSynthesisVoice[] {
  const s = synth(); if (!s) return [];
  const vs = s.getVoices(); if (!lang) return vs;
  return vs.filter(v => v.lang.toLowerCase().startsWith(lang === 'zh' ? 'zh' : lang));
}
export { voiceCatalogue };
let queueToken = 0;
export const AudioService = {
  async speak(text: string, lang: LangCode): Promise<boolean> {
    const s = synth(); if (!s || !text.trim()) return false;
    const settings = await SettingsService.get();
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : lang === 'yue' ? 'yue-Hant-HK' : lang;
    u.rate = settings.ttsRate || 1;
    const chosen = pickVoice(lang, settings.ttsVoice, s.getVoices(), settings.preferOfflineVoices);
    if (chosen) u.voice = chosen as SpeechSynthesisVoice;
    s.speak(u); return true;
  },
  speakWord: (word: string, lang: LangCode) => AudioService.speak(word, lang),
  speakSentence: (text: string, lang: LangCode) => AudioService.speak(text, lang),
  /** Speak lines one after another; resolves with the count started. */
  async speakQueue(items: Array<{ text: string; lang: LangCode }>): Promise<number> {
    const s = synth(); if (!s || !items.length) return 0;
    const settings = await SettingsService.get();
    const token = ++queueToken; s.cancel(); let started = 0;
    const lines = items.map(i => i.text.trim()).filter(Boolean).slice(0, 2000);
    await new Promise<void>(resolve => {
      const next = (idx: number) => {
        if (token !== queueToken || idx >= lines.length) { resolve(); return; }
        const u = new SpeechSynthesisUtterance(lines[idx]);
        const lang = items[idx]?.lang ?? settings.learningLang;
        u.lang = lang === 'zh' ? 'zh-CN' : lang; u.rate = settings.ttsRate || 1;
        const chosen = pickVoice(lang, settings.ttsVoice, s.getVoices(), settings.preferOfflineVoices);
        if (chosen) u.voice = chosen as SpeechSynthesisVoice;
        u.onend = () => next(idx + 1); u.onerror = () => next(idx + 1);
        started++; s.speak(u);
      };
      next(0);
    });
    return started;
  },
  stop() { queueToken++; synth()?.cancel(); },
  supported: () => !!synth(),
};
