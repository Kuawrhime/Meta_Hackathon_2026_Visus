# DATA_MODEL — VISUS

## Dictionary entry (normalized, Phase 5)
`DictEntry` in `src/types/index.ts`: `id` (`lang:lemma`), `lang`, `word`, `lemma`,
`senses[]` (definition, part of speech, translation, examples, source provider),
`alternateReadings[]`, `alternateSpellings[]`, `simplified`, `traditional`,
`characters[]` (per-character simplified/traditional/pinyin/definition),
`phonetic`, `frequency` (bundled packs: ordering hint only — not corpus frequency),
`providerId`, `licenseId`. Merging is source-aware: a poorer provider row never
overwrites a richer entry; senses are unioned and de-duplicated.

Identity: one canonical entry per (`language`, normalized lemma). Traditional
Chinese input is normalized to Simplified for identity, and both forms are kept
on the entry (`simplified`/`traditional`), so 圖像 and 图像 are one word.

## Vocabulary record (Phase 6)
`VocabRecord`: one record per (`language`, lemma) — `vocabId()` in
`src/services/vocabulary.ts`. A word met on websites, articles, books, EPUB/PDF
and videos updates the same record; `contexts[]` (capped at 20, source + snippet)
preserves where it was met, `history[]` (capped at 50) preserves grade changes,
`reviewDue` marks SRS-due words, `knownAt` is set only while status is `known`.

Statuses: `new`, `l1`, `l2`, `l3`, `l4`, `known`, `ignored`.

## Storage (IndexedDB `lingua-flow`, v1)
Stores: `vocab` (index `lang`, `lemma`), `books`, `bookData`, `stats` (index
`date`), `dictCache`, `meta`. Dictionary datasets ship as versioned files under
`src/dictionary/data/` and are never written into user stores. Migrations run
through `MigrationManager` in `src/storage/db.ts`; the database is never reset.

## Proposed package layout vs current layout
The target monorepo tree (`visus/apps`, `visus/packages/...`) maps onto the
current single-package layout without moving files: `apps/extension` =
`src/{background,content,popup,dashboard}` + `scripts/manifests.mjs`;
`packages/dictionary-engine` = `src/dictionary/` + `src/services/dictionary.ts`;
`packages/vocabulary-engine` = `src/services/vocabulary.ts`;
`packages/storage` = `src/storage/`; `packages/browser` = `src/browser/` +
`src/utils/browser.ts`; `packages/ui` = `src/components/` + dashboard/popup.
A physical move is deferred: it would churn every import for no user benefit.
