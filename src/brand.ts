// VISUS brand identity — single source of truth for user-visible branding.
// Internal identifiers (IndexedDB name, message types, storage keys, license
// prefix) intentionally keep their legacy values so existing user data,
// backups and license keys keep working. Only display strings live here.
export const APP_NAME = 'VISUS';
export const APP_TAGLINE = 'See words. Learn worlds.';
export const APP_SUBTITLE_JA = '言葉の旅';
export const APP_DESCRIPTION =
  'VISUS — See words. Learn worlds. Learn languages by reading the real web: local-first vocabulary highlighting, dictionary, books and video subtitles.';
export const BACKUP_FILENAME = 'visus-backup.json';
export const BACKUP_ENCRYPTED_FILENAME = 'visus-backup-encrypted.json';
export const vocabExportFilename = (lang: string) => `visus-vocabulary-${lang}.json`;
