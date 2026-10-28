# Implementation Plan — Phases 2–14 (VISUS Dictionary & Vocabulary Mission)

> **Phase 1 (complete):** ARCHITECTURE_AUDIT.md, SECURITY_AUDIT.md, DICTIONARY_AUDIT.md. No source code was edited in Phase 1.
> **Evidence rule:** every phase below cites the audit finding it closes. Claims marked **Unverified** in the audits stay marked until the phase's own tests/runs settle them. Do not quote audit severities as runtime facts — the security/perf evidence is code-proven, not run-proven.
> **Note on the "14-phase brief":** the brief document itself was **not found** in the repo (only design frames at `docs/brand-guidelines.md:33`). This plan defines phases 2–14 for the dictionary/vocabulary mission from the audit findings. **Unverified:** exact brief wording — if the brief surfaces, reconcile phase names at the Phase 2 gate before building.

## Phase 2 — Compatibility constitution & regression baseline (do first, never skip)

**Preserve exactly (verified against current code):**

- IndexedDB database name `'lingua-flow'`, `DB_VERSION=1` with its 6 stores (`src/storage/db.ts:3,9-16`) — any future schema change is an additive version bump with a tested upgrade path, never a rename or destructive recreate.
- LF1- license keys: the checksum format in `src/services/license.ts:7-17` and `FREE_LIMIT=1000` (`:4-22`) must keep validating already-issued keys. Hardening, if ever approved, is additive verification only — never invalidation.
- Backup format: `src/services/backup.ts:7-8,31-37` export shape and the PBKDF2-100k/AES-GCM-256 encryption (`tests/unit/services.test.ts:23-28`) keep importing files written by today's build.
- `lf-*` identifiers: every `lf-` prefix, storage key (`'lf:settings'`, `'lf:vocab-changed'`, CustomEvent/BroadcastChannel `'lingua-flow'`), CSS class (`.lf-w`, `.lf-ui`), and context-menu id (`lf-known`, `lf-lookup`, `lf-dashboard`) is frozen.
- VISUS branding and all working features: the e2e-proven behaviours (`tests/e2e/extension.spec.ts:14,23,37,48`) plus the unit/integration suites are the baseline.

**Work:** freeze the above as contract tests (backup round-trip on a golden file from the current build; LF1- golden keys; DB-open-on-existing-data test); record the green baseline by running `npm` unit/integration + Playwright suites. **Gate:** baseline green and contracts pinned before any behaviour change. **Unverified until run:** current suite pass/fail state (audits executed no tests).

## Phase 3 — Security fixes I: injection & message validation

Closes S-02, S-03. Fix `escapeHtml`/attribute handling at `src/content/index.ts:80,106` (escape quotes or set the value via DOM property); add sender + per-type schema validation to `src/background/index.ts:36-50`; clamp `LF_ADD_READING`/`LF_ADD_LISTENING` to `[0,60]` and bump `newSeen` by the sliced count (`:43,47-48`). Add failing-first tests incl. a malicious `customDefinition` case. **Preserves:** all `LF_*` message names and shapes.

## Phase 4 — Security fixes II: imports, secrets posture, remote code

Closes S-01, S-04, S-05, S-06. First **run** the built dist to settle S-01's CSP/reachability question (**Unverified** today), then bundle Tesseract locally or remove the path — no runtime CDN code. Add backup/dictionary/EPUB/book import validation with size/entry caps (keeping the Phase 2 backup format importable), fix books-on-import data loss (`backup.ts:31-37`), and guard the base64 spread (`backup.ts:14`). Document the plaintext-key storage (`settings.ts:25-28`) and move keys out of the `localStorage` mirror if feasible without breaking settings migration. Do not widen manifest permissions or `<all_urls>` exposure.

## Phase 5 — Dictionary data QA sweep & provenance

Closes D-01, D-02, D-06. Declare a source/edition/license per language pack (or label packs explicitly as project-authored with no external source — never invent an attribution). Run an automated sweep over all 1,837 rows: example-contains-headword (the يفكر class), empty-field rates, POS sanity; publish the measured defect counts (replacing today's single spot check). Add `provenance` to the entry model additively. **Unverified until swept:** total defect count.

## Phase 6 — Dictionary model: multi-sense & honest fields

Closes D-03, D-04, D-05. Extend `DictEntry` (`src/types/index.ts:6`) with `senses[]` (additive; old single-sense consumers keep working), stop `Map.set` overwrite data loss (`dictionary.ts:32`), dedupe `allEntries()` alias repeats (`:51`), and either populate `translation` truthfully or rename/stop rendering it (D-03) — with a tested data transform that still imports old backups. Backfill phonetics per language (en IPA, ko romanization, ar romanization) from the Phase 5 declared sources. Gate: polyseme fixtures (`as`, `in`, 工作) return all authored senses.

## Phase 7 — Word popup parity (reference behaviours)

Closes D-08 and the popup gaps in S/P test evidence. Build multi-definition display, structured alternate readings (incl. ja readings, zh simplified/traditional + pinyin at `dashboard/main.tsx:64,270`), and Meaning/Characters tabs across all three surfaces (content panel `content/index.ts:82-125`, `WordModal:49-77`, reading panel `:267-284`) by first extracting the shared panel/grade logic (A-07) so the surfaces cannot drift. Prove level controls + full keyboard maps (`1-4/X/0/Esc/Alt+arrows`, YouTube `A/S/D/Q/E/C/W`) with e2e, including persistence across reload for every level — not only `k`.

## Phase 8 — Chinese completeness

Closes D-07. Replace/augment the ~120-char `T2S` table (`segmentation.ts:16-19`) with a complete mapping, resolve reverse-map collisions (发→髮/發), and index pinyin as a lookup key (`dictionary.ts:32`) so pinyin and Traditional input both resolve. Add Traditional/pinyin tests (none exist today). Display keeps the user's original characters.

## Phase 9 — Vocabulary storage correctness

Closes A-09 and prior-result-1 gaps. Add a tested DB upgrade path beyond `DB_VERSION=1` (additive only; existing `'lingua-flow'` data untouched); fix `addPhrase` overwrite (`vocabulary.ts:42-46`) and `knownAt` semantics (`:29-34`); test the `FREE_LIMIT` gate in `encounter()`, backup with malformed/missing records, and settings-cache invalidation (add `storage.onChanged` or equivalent). Backup books restore is fixed in Phase 4; verify end-to-end here.

## Phase 10 — Sync & messaging consolidation

Closes A-02, A-03, A-08, A-05. Route content/background/popup/dashboard through the single `src/utils/browser.ts` wrapper (retire the hand-rolled `msg()` copies), make `browserKind()` honest about brave or drop the claim, collapse the double notification (BroadcastChannel vs `LF_VOCAB_CHANGED`) into one idempotent channel, and implement or remove the dead `lf-lookup` menu (`background/index.ts:24-34`). Add equivalence tests for the previously triplicated grade/stats/count logic (A-07) incl. the subtitle `normalizeWord` vs `lemmatize` divergence (`content/index.ts:188-192`).

## Phase 11 — Permissions & browser-matrix verification

Closes A-01, A-04. Request the optional `tabs` permission at the moment of need (or degrade loudly instead of swallowing, `background/index.ts:16`); run the built dist in Firefox 128+ and Edge/Brave and add per-browser smoke tests so "works in Firefox" becomes **proven**, replacing today's Chromium-only e2e (`extension.spec.ts:7-12`). Decide the fate of the unused `webextension-polyfill` dependency (`package.json:27`) — adopt it in the wrapper or remove it.

## Phase 12 — Content-script robustness

Closes A-06 and the perf risks in P-01. Cover `contenteditable=''`/`'plaintext-only'`/inherited editability and explicit password exclusion in `SKIP_SELECTOR` (`highlighting.ts:5`), extend the keydown guard (`content/index.ts:156`), and make highlighting incremental (dirty-subtree only, invalidate `blockTextCache` on vocab change) with a large-page performance budget test. Wire `dictWorker` for segmentation or delete it (A-10). SERP exclusion behaviour stays byte-identical (e2e-proven today).

## Phase 13 — Audio & translation services

Closes D-10. Remove or implement the phantom "in-memory audio cache" claim (`audio.ts:3`); add unit tests with mocked `speechSynthesis` for voice selection (zh-CN, yue-Hant-HK, `ttsVoice`). Pin the translation opt-in gates (`translation.ts:7,18`) with tests; document the unofficial Google `gtx` endpoint risk and keep it off by default (`localOnly`). No behaviour change for opted-out users.

## Phase 14 — Performance hardening, coverage & release gate

Closes P-01–P-03 residuals. Batch `LF_ENCOUNTERS` writes, debounce/throttle `autoBackup` (`backup.ts:39`) instead of full-export-per-grade, lazy-load dictionary packs with eviction (dashboard must not retain all 12 packs, `dashboard/main.tsx:560`), and profile against budgets set in Phase 12. Final gate: full unit/integration/e2e matrix green (all browsers from Phase 11), malicious-input e2e (Phases 3–4 cases), backup golden-file import from the Phase 2 baseline build, LF1- golden keys still valid, DB upgrade from a v1 fixture — then ship. Any **Unverified** item left open at this gate is listed in release notes, not silently dropped.

## Invariants checklist (every phase, all phases)

- [ ] IndexedDB still named `'lingua-flow'`; existing user data opens unchanged.
- [ ] LF1- keys issued before the phase still verify; `FREE_LIMIT` semantics unchanged unless separately approved.
- [ ] Backups written by the pre-phase build still import; new backups import into the pre-phase build or the format change is versioned + tested both ways.
- [ ] No `lf-*` identifier renamed or removed; no VISUS branding change.
- [ ] Every feature e2e-proven before the phase is still e2e-proven after it.
- [ ] New behaviour ships with a failing-first test; **Unverified** claims are never restated as facts.
