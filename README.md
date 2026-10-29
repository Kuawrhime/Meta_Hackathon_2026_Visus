# VISUS — Language Immersion Browser Extension

**See words. Learn worlds.** 言葉の旅

Learn a language by reading the real web. VISUS recognizes words on any website, highlights them by your knowledge level, gives definitions and pronunciation on click, and remembers every word across websites, books and videos. **Everything is local-first: no account, no server, your vocabulary never leaves your device.**

Inspired by the immersion concept of tools like Sluka, implemented as an independent product with original branding, UI and code.

## Quick start

```bash
npm install
npm run build:chrome     # or build:firefox / build:edge / build:brave / build:all
npm test                 # unit + integration tests (Vitest)
npm run test:e2e         # Playwright end-to-end (loads dist/chrome in Chromium)
npm run dev              # dashboard dev server on http://localhost:5173/dashboard.html
```

Then load the extension unpacked — see [docs/INSTALL.md](docs/INSTALL.md) for Chrome, Firefox, Edge and Brave instructions.

## What works

- **Highlighting engine** — DOM TreeWalker + MutationObserver; preserves links/buttons, skips scripts/editable fields, handles infinite scroll, SPA frameworks, chatbot streaming (ChatGPT/Claude/Gemini) and open shadow roots. Words are graded with keys `1–4`, `K`, `X`, `0`, `Esc`, `Alt+←/→`; grading updates every occurrence instantly and persists across pages.
- **Vocabulary colors** — New (blue), Learning 1–4 (yellows → underline), Known/Ignored (none). Colors are configurable.
- **Offline dictionaries** — bundled real dictionaries for English, French, Spanish, German, Italian, Portuguese, Dutch, Japanese, Chinese, Korean, Russian and Arabic, with definitions, phonetics, frequency ranks and examples. Import your own (JSON/CSV/TSV/TXT). Unknown words are never given invented definitions — optional Google Translate fallback is off by default.
- **Segmentation** — `Intl.Segmenter` morphology for Japanese/Korean/Thai, Chinese segmentation (Intl + dictionary max-match), standard tokenization + lemmatization for European languages, RTL support for Arabic.
- **Reader** — clutter-free article view with adjustable typography, phrase selection/translation and honest reading-time statistics (only while visible and focused).
- **Book reader** — EPUB (with TOC), PDF (text layer; optional local Tesseract.js OCR for scans) and TXT, with search, bookmarks, progress and the same vocabulary highlighting. Files stay in IndexedDB on your device.
- **YouTube subtitles** — uses the caption tracks YouTube exposes to the page: highlighted clickable words, translation line, auto-pause, loop/replay, sync offset, blur/reveal, fullscreen-safe overlay, shortcuts `A/S/D/Q/E/C/W`. No DRM bypass; platforms without accessible subtitles show a clear limitation.
- **Statistics** — known/learning vocabulary, words learned per day, reading/listening minutes, streaks, book progress — all computed from real IndexedDB activity.
- **Backup** — export/import JSON with duplicate detection, AES-GCM encrypted backups, automatic local backups.
- **Unlimited** — no tracked-word cap and no paywall: every feature works for every word in every language. Legacy `LF1-…` keys still verify offline for holders, but nothing is gated by them. No card data is ever stored.
- **Sluka-parity additions (clean-room, original code)** — Anki TSV export + AnkiConnect send (Vocabulary → Export for Anki / Send to Anki), spaced-repetition intervals (L1 1d · L2 3d · L3 7d · L4 21d, due queue in Review), CBZ comic books in the Library, offline OCR via the browser's built-in text detection for scanned PDFs (honest message where unavailable), generic HTML5 subtitle learning for Netflix/Disney+/Crunchyroll/Bilibili/Twitch/Viki from page-exposed WebVTT/SRT/text tracks (no DRM bypass), and localised popup chrome (en/fr/es/de/ja).
- **Premium rounded UI + video immersion** — a shared rounded design system (ivory, charcoal, terracotta, petrol) across the dark dictionary popup (20px), floating vocabulary pill (drag/collapse/hide, position persisted), premium launcher popup, and a resizable/draggable YouTube + Netflix learning sidebar (clickable words, dictionary, replay, speed, auto-pause, subtitle import, real learning statistics). Platform limits are documented honestly in [docs/VIDEO_LIMITATIONS.md](docs/VIDEO_LIMITATIONS.md).
- **Offline translation, voices, packs, deck & transcript** — dictionary-gloss local translation (Settings → Privacy → Offline local translation; unknown words pass through, never invented), on-device voice synthesis with offline-voice preference and a spoken queue, starter dictionary packs for Swedish, Danish, Norwegian, Finnish, Polish, Ukrainian, Greek, Turkish, Indonesian, Vietnamese, Thai and Cantonese (24 languages ready in total), an Audio deck (line queue, playlists, learning-words loader) and a Transcript page (WebVTT/SRT with highlighted clickable words, listen and offline gloss per line).
- **Optional AI** — with your own OpenAI key, explain expressions in context. Off by default; core features never require it.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Services are independent of React: `VocabularyService`, `DictionaryService`, `TranslationService`, `TextSegmentationService`, `HighlightingService`, `ReadingStatisticsService`, `VideoSubtitleService` (YouTube adapter), `BookReaderService`, `BackupService`, `SettingsService`, `AudioService`, `SyncService`, `LicenseService`.

```
src/{background,content,popup,dashboard,reader,books,videos,vocabulary,dictionary,
     languages,statistics,settings,audio,storage,services,workers,components,hooks,utils,types,assets}
```

## Brand

VISUS is the permanent product name (formerly Lingua Flow). Tagline: "See words. Learn worlds." Japanese subtitle: 言葉の旅. Identity, tokens and logo rules: [Brand guidelines](docs/brand-guidelines.md), logo: [VISUS logo](public/logo.svg). Existing vocabulary, settings, backups (`visus-backup.json`) and `LF1-…` license keys carry over unchanged — the rename is branding only.

## Privacy

Local-first by design: IndexedDB holds vocabulary, books and statistics; `chrome.storage` holds settings. No browsing history is collected, no analytics, host permissions are minimal, books/PDFs are never uploaded, and translation/AI calls happen only after you explicitly enable them in Settings → Privacy.

## Docs

- [Installation (all browsers + store packages)](docs/INSTALL.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API & services reference](docs/API.md)
- [Testing](docs/TESTING.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Brand guidelines](docs/brand-guidelines.md)
