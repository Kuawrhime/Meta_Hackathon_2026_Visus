import type { DictCharacter, DictEntry, LangCode } from '../types';
import { DATASETS, datasetById } from './datasets';

// Strict provider contract (Phase 2/4). Adding a language or dataset means
// registering a provider here — the core engine never changes per language.
export interface DictionaryProvider {
  id: string;
  language: LangCode | 'multi';
  version: string;
  license: string;
  attribution: string;
  datasetId: string;
  active: boolean;
  lookup(word: string): Promise<DictEntry | undefined>;
  lookupAll(word: string): Promise<DictEntry[]>;
  search(query: string, limit?: number): Promise<DictEntry[]>;
  getCharacter(char: string): Promise<DictCharacter | undefined>;
  getExamples(word: string): Promise<string[]>;
  getPronunciation(word: string): Promise<string | undefined>;
  getMetadata(): { id: string; version: string; license: string; attribution: string; verified: boolean };
}

export interface LanguageAdapter {
  code: LangCode;
  tokenization: 'space' | 'intl-segmenter' | 'dict-maxmatch' | 'morphology-required';
  lemmatization: 'rules-en' | 'rules-eu' | 'rules-ko' | 'rules-ar' | 'none' | 'morphology-required';
  normalization: string;
  search: string;
  script: string;
  morphology: string;
  status: 'bundled' | 'morphology-required' | 'planned';
}

// Language adapters (Phase 4). Korean/Arabic need a real morphological
// analyzer; until one is vendored they are honestly marked as such instead of
// pretending whitespace tokenization is morphology.
export const LANGUAGE_ADAPTERS: Record<string, LanguageAdapter> = {
  en: { code: 'en', tokenization: 'space', lemmatization: 'rules-en', normalization: 'lowercase + strip punctuation', search: 'lemma + forms + definition substring', script: 'Latin', morphology: 'suffix rules (ies/ing/ed/s)', status: 'bundled' },
  fr: { code: 'fr', tokenization: 'space', lemmatization: 'rules-eu', normalization: 'lowercase, accents kept', search: 'lemma + definition substring', script: 'Latin', morphology: 'plural -s/-x stripping', status: 'bundled' },
  es: { code: 'es', tokenization: 'space', lemmatization: 'rules-eu', normalization: 'lowercase, accents kept', search: 'lemma + definition substring', script: 'Latin', morphology: 'plural -s stripping', status: 'bundled' },
  de: { code: 'de', tokenization: 'space', lemmatization: 'rules-eu', normalization: 'lowercase, umlauts kept', search: 'lemma + definition substring', script: 'Latin', morphology: '-en stripping (light)', status: 'bundled' },
  it: { code: 'it', tokenization: 'space', lemmatization: 'rules-eu', normalization: 'lowercase, accents kept', search: 'lemma + definition substring', script: 'Latin', morphology: 'plural stripping (light)', status: 'bundled' },
  pt: { code: 'pt', tokenization: 'space', lemmatization: 'rules-eu', normalization: 'lowercase, accents kept', search: 'lemma + definition substring', script: 'Latin', morphology: 'plural stripping (light)', status: 'bundled' },
  nl: { code: 'nl', tokenization: 'space', lemmatization: 'none', normalization: 'lowercase', search: 'lemma + definition substring', script: 'Latin', morphology: 'none bundled', status: 'bundled' },
  ja: { code: 'ja', tokenization: 'intl-segmenter', lemmatization: 'none', normalization: 'as-is (kana/kanji)', search: 'headword + reading + definition substring', script: 'Kanji/Kana', morphology: 'Intl.Segmenter; Sudachi/Kuromoji not vendored', status: 'bundled' },
  zh: { code: 'zh', tokenization: 'dict-maxmatch', lemmatization: 'none', normalization: 'Traditional -> Simplified (T2S table)', search: 'characters + pinyin (tone-insensitive) + English definition', script: 'Han (Simplified/Traditional)', morphology: 'Jieba-style max-match against bundled lexicon; ICU via Intl.Segmenter when available', status: 'bundled' },
  ko: { code: 'ko', tokenization: 'intl-segmenter', lemmatization: 'rules-ko', normalization: 'as-is (Hangul)', search: 'headword + definition substring', script: 'Hangul', morphology: 'Rule-based particle/ending stripping (lemmatizeKo) — not a full morphological analyzer; irregular stems fall back to surface form', status: 'bundled' },
  ru: { code: 'ru', tokenization: 'space', lemmatization: 'none', normalization: 'lowercase', search: 'lemma + definition substring', script: 'Cyrillic', morphology: 'none bundled', status: 'bundled' },
  ar: { code: 'ar', tokenization: 'space', lemmatization: 'rules-ar', normalization: 'strip tatweel/diacritics, RTL aware', search: 'headword + definition substring', script: 'Arabic (RTL)', morphology: 'Rule-based proclitic/article/suffix stripping (lemmatizeAr) — not a root-and-pattern analyzer; broken plurals not restored', status: 'bundled' },
};
export const adapterFor = (lang: LangCode): LanguageAdapter | undefined => LANGUAGE_ADAPTERS[lang];

const registry = new Map<string, DictionaryProvider>();
export function registerProvider(p: DictionaryProvider): void { registry.set(`${p.language}:${p.id}`, p); }
export function providersFor(lang: LangCode): DictionaryProvider[] {
  return [...registry.values()].filter(p => p.language === lang || p.language === 'multi');
}
export function allProviders(): DictionaryProvider[] { return [...registry.values()]; }

// The bundled provider is registered by DictionaryService (it owns the data
// loading). External dataset providers stay registered-but-inactive until
// vendored + license-verified (see datasets.ts).
for (const d of DATASETS.filter(x => !x.active)) {
  const meta = datasetById(d.id)!;
  registerProvider({
    id: d.providerId, language: (d.language === 'multi' ? 'multi' : d.language) as LangCode | 'multi',
    version: d.version, license: d.license, attribution: d.attribution, datasetId: d.id, active: false,
    lookup: async () => undefined, lookupAll: async () => [], search: async () => [],
    getCharacter: async () => undefined, getExamples: async () => [], getPronunciation: async () => undefined,
    getMetadata: () => ({ id: d.providerId, version: d.version, license: d.license, attribution: d.attribution, verified: meta.verified }),
  });
}
