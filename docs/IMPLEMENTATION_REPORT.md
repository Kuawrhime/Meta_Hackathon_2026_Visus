# IMPLEMENTATION REPORT — VISUS dictionary & vocabulary infrastructure

## Already functional (preserved, verified by tests)
Highlighting engine with sensitive-page exclusions, vocabulary grading/persistence
(29 baseline tests), books/EPUB/PDF/TXT, YouTube subtitles, backup/restore,
license keys (`LF1-`), Chrome/Firefox/Edge/Brave builds, VISUS washi UI.

## Implemented in this pass
- **Unified dictionary model** (`DictEntry.senses[]`, characters, alternate
  readings/spellings, simplified/traditional, provider/license ids). Multi-sense
  rows are merged, never overwritten (zh 工作 keeps noun+verb senses).
- **Provider architecture**: strict `DictionaryProvider` interface, per-language
  bundled providers, registry, language adapters. External datasets (CC-CEDICT,
  Wiktextract, Open English WordNet, JMdict, FreeDict) are registered with full
  upstream license metadata but **inactive** — VISUS does not activate data it
  has not vendored and verified. Registry machine-checked by
  `scripts/validate-licenses.mjs`; checksums in `docs/DATASETS.md`.
- **Chinese engine**: Traditional↔Simplified identity (圖像 = 图像， one entry,
  6,056th, túxiàng, per-character 图/像 breakdown), 張 with 6 senses, pinyin
  (tone-insensitive), character and English-definition search.
- **Vocabulary engine**: one record per (language, lemma) across web/article/
  book/video/manual with `contexts[]` and grade `history[]`; fixed `addPhrase`
  wiping graded records and stale `knownAt` corrupting learned-today stats.
- **Popup (reference screenshots)**: word + variant, audio, status pill,
  frequency, numbered senses, alternative readings, Meaning/Characters/Examples
  tabs, sense prev/next + arrow keys, segmented 1-4/Known/Ignore bar, immediate
  persistence, single popup, Esc close. Verified live in Chromium (圖像 panel).
- **Security**: strict message schemas + sender checks, settings allowlist,
  attribute escaping in the popup (quote-breakout fixed), backup/import
  validation with caps, EPUB zip-bomb caps, remote CDN OCR code execution
  removed, settings cache staleness across contexts fixed.
- **Storage**: repositories per store, `MigrationManager` (versioned, recorded,
  retry-on-failure, never resets the `lingua-flow` database).
- **Governance**: `docs/AGENT_RULES.md`, `SECURITY.md`, `DATA_MODEL.md`,
  `DICTIONARIES.md`, `DATASETS.md`, `CONTRIBUTING.md` + Phase 1 audits.

## Tests actually executed
- Baseline before changes: 29 passed. After the first pass: 52. After this
  pass: **61 unit/integration/security tests passed** (including live-data
  tests against every vendored dataset), **5 performance tests passed**,
  typecheck clean, `build:all` succeeds, **4/4 Playwright Chromium e2e
  passed**, Chinese popup exercised end-to-end in Chromium.
- **Firefox runtime evidence (executed 2026-11-03):** Firefox 157.0
  (Playwright build) driven via Marionette with system access; the Firefox
  build from `dist/firefox` was installed as a temporary add-on
  (`lingua-flow@example.local`, active), an English test page showed **15
  highlighted words + counter**, the dictionary panel opened with merged
  provider data, and pressing **K graded all 3 occurrences of the word to
  Known** through the Firefox event-page background. Screenshot:
  `screenshots/firefox-panel.png`. This also caught and fixed a real bug:
  the Firefox manifest used a Chrome-style service worker — it now declares
  an MV3 event page (`background.scripts`).
- **Performance (executed, see `docs/PERFORMANCE.md`):** on an Intel Core
  Ultra 7 155H / 32 GB / Node 24, cold shard lookups are 1.9–6.9 ms
  (CC-CEDICT/WordNet/JMdict), warm p95 ≤ 0.02 ms, bundled whole-pack cold
  52.5 ms — all far under the 100 ms target.

## Vendored datasets (this pass, all active + license-verified)
CC-CEDICT (196,450 sense-rows), Open English WordNet 2024 (160,327),
JMdict common-priority subset (42,460), Wiktextract Korean (67,018),
FreeDict fr/de/es/it/en (14k–270k per language) — downloaded from upstream,
converted by `scripts/build-dictionaries/convert-all.mjs` into lazy shards
under `public/dictionaries/`, with upstream license texts in
`public/dictionaries/licenses/` and SHA-256 index checksums in
`src/dictionary/datasets.ts` + `docs/DATASETS.md`. Lookups merge senses
across bundled + licensed providers (richest entry wins, senses unioned).
Korean and Arabic morphological handling is implemented as documented
rule-based lemmatizers (`lemmatizeKo`/`lemmatizeAr`, tested) — explicitly
not full morphological analyzers.

## Remaining limitations (not claimed as done)
- The bundled seed dictionaries remain project-authored with unverified
  provenance (frequency = ordering hint); licensed providers now supply the
  authoritative definitions where vendored, and merged entries say so via
  `providerId`.
- Dictionary shard work runs on the main thread with lazy loading + LRU
  caches; the Web Worker (`src/workers/dictWorker.ts`) is not yet wired.
- Package size is ~103 MB per browser (dictionary shards). Before store
  submission, gzip the shards (`DecompressionStream`) or ship datasets as
  optional downloads — see `docs/PERFORMANCE.md`.
- JMdict is the documented common-priority subset, not the full dictionary;
  Wiktionary coverage is the Korean Wiktextract extract (English/French
  extracts are multi-GB upstreams and were not mirrored).
- The proposed `visus/apps + packages` tree is mapped, not physically moved
  (see `docs/DATA_MODEL.md`), to avoid import churn with no user benefit.
