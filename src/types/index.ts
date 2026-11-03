export type LangCode = 'en'|'fr'|'es'|'de'|'it'|'pt'|'ja'|'zh'|'ko'|'ru'|'nl'|'ar'|'yue'|'th'|'vi'|'sv'|'da'|'no'|'fi'|'pl'|'uk'|'el'|'tr'|'id';
export type WordStatus = 'new'|'l1'|'l2'|'l3'|'l4'|'known'|'ignored';
export type ThemeMode = 'light'|'dark'|'system';

export interface LangInfo { code: LangCode; name: string; native: string; rtl?: boolean; segmenter: 'space'|'intl'|'dict-zh'|'ja'|'ko'; ready: boolean; }
export interface DictSense { definition: string; pos?: string; translation?: string; examples: string[]; source?: string; }
export interface DictCharacter { char: string; simplified: string; traditional: string; phonetic?: string; definition?: string; }
export interface DictEntry {
  id?: string; lang?: LangCode;
  word: string; lemma: string; phonetic?: string; pronunciation?: string; pos?: string;
  definition: string; translation: string; examples: string[]; frequency: number;
  forms?: string[]; grammar?: string; related?: string[];
  senses?: DictSense[]; alternateReadings?: string[]; alternateSpellings?: string[];
  simplified?: string; traditional?: string; characters?: DictCharacter[];
  providerId?: string; licenseId?: string;
}
export interface DatasetManifest {
  id: string; providerId: string; language: LangCode | 'multi'; version: string;
  sourceUrl: string; downloadedAt: string; license: string; licenseUrl?: string;
  attribution: string; checksum: string; transformations: string[]; verified: boolean; active: boolean;
}
export interface VocabContext { source: 'web'|'article'|'book'|'epub'|'pdf'|'video'|'manual'; text?: string; at: number; }
export interface VocabRecord { id: string; lang: LangCode; word: string; lemma: string; status: WordStatus; encounters: number; firstSeen: number; lastSeen: number; knownAt?: number; customDefinition?: string; note?: string; isPhrase?: boolean; dictId?: string; contexts?: VocabContext[]; history?: Array<{ status: WordStatus; at: number }>; reviewDue?: number; }
export interface BookRecord { id: string; title: string; format: 'epub'|'pdf'|'txt'|'cbz'; lang: LangCode; progress: number; chapter: number; addedAt: number; lastReadAt: number; size: number; bookmarkCount: number; }
export interface StatDay { date: string; lang: LangCode; knownMarked: number; newSeen: number; readingSec: number; listeningSec: number; }
export interface Settings {
  interfaceLang: string; learningLang: LangCode; nativeLang: LangCode; onboarded: boolean;
  theme: ThemeMode; autoHighlight: boolean; localOnly: boolean; translationEnabled: boolean; aiEnabled: boolean;
  highlightColors: Record<string,string>; fontSize: number; lineHeight: number; readingWidth: number;
  tooltipSize: number; counterPosition: 'bottom-right'|'bottom-left'|'top-right'|'hidden';
  ttsRate: number; ttsVoice: string; subtitleFontSize: number; subtitleAutoPause: boolean; subtitleShowTranslation: boolean; subtitleBlur: boolean;
  syncOffsetMs: number; licenseKey: string; premium: boolean; translationProvider: 'google'|'local'|'none'; preferOfflineVoices: boolean; apiKeys: Record<string,string>;
}
export interface SubtitleCue { start: number; end: number; text: string; translation?: string; }
export interface BackupPayload { version: number; exportedAt: number; vocab: VocabRecord[]; settings: Settings; stats: StatDay[]; books: BookRecord[]; }
export const STATUS_ORDER: WordStatus[] = ['new','l1','l2','l3','l4','known','ignored'];
export const STATUS_LABEL: Record<WordStatus,string> = { new:'New', l1:'Learning 1', l2:'Learning 2', l3:'Learning 3', l4:'Learning 4', known:'Known', ignored:'Ignored' };
