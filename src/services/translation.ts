import type { LangCode } from '../types';
import { SettingsService } from './settings';
// TranslationService — optional, OFF by default (local-only privacy). Never called unless the user enables it.
export const TranslationService = {
  async translate(text: string, from: LangCode, to: LangCode): Promise<string | null> {
    const s = await SettingsService.get();
    if (!s.translationEnabled || s.translationProvider === 'none') return null;
    if (s.translationProvider === 'local') {
      // Offline dictionary-gloss translation: works in local-only mode.
      const { translateLocally } = await import('./localTranslate');
      const r = await translateLocally(text, from, to);
      return r.text || null;
    }
    if (s.localOnly) return null;
    // Google Translate (gtx endpoint) — only reached with explicit user opt-in.
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const res = await fetch(url); if (!res.ok) return null;
      const data = await res.json() as [Array<[string]>];
      return data?.[0]?.map(p => p[0]).join('') ?? null;
    } catch { return null; }
  },
  async aiExplain(text: string, lang: LangCode): Promise<string | null> {
    const s = await SettingsService.get();
    if (!s.aiEnabled) return null;
    const key = s.apiKeys.openai; if (!key) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: `Explain the ${lang} expression "${text}": meaning, register/slang, grammar, one example. Be concise.` }] }) });
      if (!res.ok) return null;
      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices?.[0]?.message?.content ?? null;
    } catch { return null; }
  },
};
export const LanguageDetectionService = {
  // Delegates to segmentation heuristics; exposed as its own service per architecture spec.
  detect: async (text: string) => (await import('./segmentation')).detectLanguage(text),
};
