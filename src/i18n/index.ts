// VISUS interface strings — original translations, VISUS branding kept.
// Only chrome (popup/dashboard labels) is localised here; learning content
// always stays in the language being learned.
export const UI_STRINGS = {
  en: { dashboard: 'Dashboard', readPage: 'Read page', books: 'Books', settings: 'Settings', review: 'Review', highlighting: 'Highlighting', new: 'New', learning: 'Learning', known: 'Known' },
  fr: { dashboard: 'Tableau de bord', readPage: 'Lire la page', books: 'Livres', settings: 'Réglages', review: 'Révision', highlighting: 'Surlignage', new: 'Nouveau', learning: 'En cours', known: 'Connu' },
  es: { dashboard: 'Panel', readPage: 'Leer página', books: 'Libros', settings: 'Ajustes', review: 'Repaso', highlighting: 'Resaltado', new: 'Nuevo', learning: 'Aprendiendo', known: 'Conocido' },
  de: { dashboard: 'Übersicht', readPage: 'Seite lesen', books: 'Bücher', settings: 'Einstellungen', review: 'Wiederholen', highlighting: 'Hervorhebung', new: 'Neu', learning: 'Lernen', known: 'Bekannt' },
  ja: { dashboard: 'ダッシュボード', readPage: 'ページを読む', books: '本', settings: '設定', review: '復習', highlighting: 'ハイライト', new: '新規', learning: '学習中', known: '既知' },
} as const;
export type UiKey = keyof (typeof UI_STRINGS)['en'];
export function t(lang: string, key: UiKey): string {
  const table = (UI_STRINGS as Record<string, Record<string, string>>)[lang] ?? UI_STRINGS.en;
  return table[key] ?? UI_STRINGS.en[key] ?? key;
}
export const UI_LANGS = Object.keys(UI_STRINGS);
