# Security & Performance Audit — Phase 1

> **Project:** VISUS (Lingua Flow)
> **Phase:** 1 — audit only. No source code edited by this deliverable.
> **Evidence basis:** prior result 4 (security-perf, code/test inspection only — **no tests executed**, so runtime claims are code-proven, not run-proven) and prior result 5 (critic). Anything requiring a run is marked **Unverified**.
> **Compatibility commitments:** IndexedDB name `lingua-flow`, LF1- license keys, backup format, `lf-*` identifiers, VISUS branding, and all working features must be preserved by every fix. See IMPLEMENTATION_PLAN.md Phase 2.

Severity scale: **Critical** remotely triggerable code execution / credential exposure · **High** stored injection, key exposure, or unbounded-resource DoS · **Medium** hardening/validation gaps with limited reachability · **Low** hygiene.

## Security findings

### S-01 — Remote code execution via dynamic import of CDN Tesseract · Critical (reachability Unverified)

- **Files:** `src/books/epub.ts:30` — `Function('u','return import(u)')` dynamically imports `https://cdn.jsdelivr.net/npm/tesseract.js@5/…`. Also `scripts/convert_dicts.mjs:22` uses `Function(...)` on text from repo-local `scripts/gen_dicts.py` (build-time only, trusted input — Low). `scripts/build.mjs:13` runs fixed `npx tsc --noEmit` with `shell:true`, no user input (Low).
- **Proven (code):** the remote-import expression exists and fetches executable code from a third-party CDN at runtime if reached.
- **Unverified:** whether MV3 extension-page CSP blocks it in the built dist, and whether the code path is reachable from shipped UI. **Unverified** — not run (prior results 4/5). Treat as Critical until disproven by a run; the fix (bundle locally or remove) must not change any working OCR-adjacent feature's user-visible contract without a Phase gate.

### S-02 — Stored quote-breakout injection via custom definition · High

- **Files:** `src/content/index.ts:80` `escapeHtml` (via `textContent`→`innerHTML`) escapes `<>&` but **not** double-quote; panel `src/content/index.ts:99-111` inserts the stored custom definition into a double-quoted `value` attribute at `:106`. Tooltip `:70-72` and all other fields at `:99-104` are escaped; `entry.frequency:101` is unescaped but bundled-numeric.
- **Proven (code):** a `customDefinition` containing `"` breaks out of the attribute — stored attribute injection from user/backup-supplied data.
- **Safe sinks (proven):** subtitle translation escaped (`:181`), holder text via `textContent` (`:184-191`); `src/services/highlighting.ts:44` uses `span.textContent`; dashboard/popup are React JSX with no `dangerouslySetInnerHTML` found in `src`. EPUB: `src/books/epub.ts:21-23` strips only `script/style/link` (retains event handlers/`javascript:` URLs in `EpubChapter.html`), but the consumer `src/dashboard/main.tsx:323` re-parses and uses only `body.textContent` — no raw-rendering path proven. `src/reader/extract.ts:15,22` returns `innerHTML`/DOM-parses fetched HTML with no `innerHTML` rendering consumer found (text-based `HighlightedText`, `src/dashboard/main.tsx:88`).

### S-03 — Unvalidated background message surface · Medium

- **Files:** `src/background/index.ts:36` handler ignores `_sender` (no `sender.id/url/tab` validation) and casts `lang/word/status/words` without schema checks (`:42-50`). Content listener `src/content/index.ts:254` accepts `LF_VOCAB_CHANGED`/`LF_REHIGHLIGHT` (→ `location.reload`) on `type`/`lemma` truthiness only.
- **Mitigants (proven):** no `externally_connectable` in `scripts/manifests.mjs`; content scripts match only `http://*/*`+`https://*/*` (`:17`), so runtime messages originate from the extension's own content/extension contexts.
- **Proven gaps:** `LF_ENCOUNTERS` (`:43`) slices the loop to 500 but bumps `newSeen` by the **unsliced** `message.words.length` (stat inflation); `LF_ADD_READING`/`LF_ADD_LISTENING` (`:47-48`) apply `Math.min(60,…)` with **no lower bound**, so negative values decrement stats (`src/services/stats.ts:14-15`).

### S-04 — Secrets stored in plaintext; license key is forgeable · High (exposure) / Medium (license)

- **Files:** no hardcoded API keys/secrets found in `src`/`scripts` (searched). The user-entered OpenAI key (`src/dashboard/main.tsx:624`) is stored plaintext via `SettingsService` (`src/services/settings.ts:25-28`) into `chrome.storage.local` **and** the `localStorage` fallback `'lf:settings'` (full settings including `apiKeys` + license key), and sent only as `Bearer` to `api.openai.com` (`src/services/translation.ts:21`). Google Translate sends word/cue text (`src/services/translation.ts:9-13`) only when `localOnly` is off + `translationEnabled` + provider set (`:7`); `aiExplain` is gated on `aiEnabled` + key (`:18`).
- **License (proven):** `src/services/license.ts:7-17` is an FNV/checksum-only verifier (`FREE_LIMIT=1000` per-lang via `byIndex('vocab','lang')`, premium bypass requires `premium && verifyLicenseKey`, `:4-22`). Anyone can generate a valid LF1- key — the repo's own test proves generate/verify (`tests/unit/services.test.ts:9-12`). The checksum has no expiry despite a comment claiming otherwise. **This is a known product constraint:** later phases must keep LF1- keys validating (see plan Phase 2) — hardening, if any, must be additive and backward-compatible.
- **Proven (code):** storage locations and gating exactly as above. **Unverified:** at-rest exposure impact on a shared profile — not measured.

### S-05 — Import/backup surface has almost no validation and no size limits · High

- **Files:** `src/services/backup.ts:32-37` `importJSON` checks only `Array.isArray(data.vocab)` — no version, record/settings/stats/books shape, count, or byte-size limits; `SettingsService.set(data.settings)` spreads directly (spread is prototype-safe; no `__proto__` pollution via merge found, no `Object.assign` merge in the backup path). `VocabularyService.importRecords` (`src/services/vocabulary.ts:54-57`) trusts `r.id/lang/…` and does sequential awaited get+put per record (oversized backup = slow DoS, no cap). Books are exported (`backup.ts:7-8`) but **never restored** on import (`:31-37`) — a data-loss bug, proven by code. `src/services/dictionary.ts:58` import casts `DictEntry[]` unchecked (non-array throws on `.map`); `:60-64` CSV split is unbounded. `src/books/library.ts:6-11` has no file-size cap (whole file → `arrayBuffer` → IndexedDB). `src/books/epub.ts:6` `JSZip.loadAsync` has no entry-count/expanded-size limits (zip-bomb risk). `src/services/backup.ts:14` base64 via `String.fromCharCode(...Uint8Array)` spread risks stack overflow on very large backups. Encrypted path itself is sound: PBKDF2-100k/AES-GCM-256 with wrong-password rejection tested (`tests/unit/services.test.ts:23-28`).

### S-06 — Manifest posture · Medium

- **Files:** `scripts/manifests.mjs:13-18` — `permissions=[storage,activeTab,contextMenus,alarms]`, optional `tabs`, `host_permissions=[]`, optional hosts for youtube/chatgpt/claude.ai/gemini, content scripts on `http://*/*`+`https://*/*` (broad by design), `web_accessible_resources` exposing `dashboard.html` to `<all_urls>` (`:18`). No CSP field (MV3 defaults apply).
- **Proven (code):** as written. Broad content-script match + `<all_urls>` page exposure are the standing attack-surface facts every later phase must avoid widening.

## Performance findings (all code-proven, none measured — **Unverified** magnitudes)

### P-01 — Main-thread highlighting of the whole page · High (risk)

- **Files:** content init highlights the whole body synchronously via `TreeWalker` (`src/content/index.ts:225-230` + `src/services/highlighting.ts:52-77`); `MutationObserver` re-highlights added subtrees on a 250 ms debounce (`src/content/index.ts:238-243`); `blockTextCache` `WeakMap` (`src/services/highlighting.ts:18-26`) caches the first 600-char language decision and is never invalidated; `pageCounts` scans all `.lf-w` DOM nodes per update (`:87-90`); plus a 1 s `navWatch` and 30 s/10 s intervals (`src/content/index.ts:232,248,196`). Segmentation runs on the main thread because `src/workers/dictWorker.ts:4-7` is never instantiated (zero `new Worker` sites).
- **Unverified:** actual cost on large pages. **Unverified** — no profile exists.

### P-02 — Sequential IndexedDB writes and full-export auto-backup · Medium

- **Files:** `LF_ENCOUNTERS` performs up to 500 sequential awaited encounters (`src/background/index.ts:43`); every `LF_SET_STATUS` (`:44`) triggers `BackupService.autoBackup()` — a full-export `JSON.stringify` into `localStorage` (`src/services/backup.ts:39`). `VocabularyService.statusMap/all` (`src/services/vocabulary.ts:12-20`) loads all rows via `idb.getAll` and filters in memory. PDF import loops pages sequentially (`src/dashboard/main.tsx:328-331`); `segmentZh` tries up to 6 lengths per char (`src/services/segmentation.ts:27-28`).

### P-03 — Dictionary loading retains everything forever · Medium

- **Files:** loaders `src/services/dictionary.ts:5-18` dynamic-import 12 JSON packs (measured 9.1–39.3 KB each); `ensure()` (`:25-36`) builds a `Map` with up to 3 keys per entry (word+lemma+forms), cached forever in `cache` (`:19`), no eviction; zh `registerZhWords` (`src/services/segmentation.ts:8`) grows `ZH_WORDS` monotonically. Dashboard Dictionaries view (`src/dashboard/main.tsx:560`) sequentially `size()`s — thus fully loads and retains — all 12 languages.

## Test-coverage evidence (what would/would not catch the above)

- **Proven coverage:** 5 unit/integration files — dictionary lookup/lemma/unknown/TSV/12-language smoke (`tests/unit/dictionary.test.ts:4-22`), backup round-trip + AES-GCM (`tests/unit/services.test.ts:17-28`), vocab persistence (`tests/unit/vocabulary.test.ts:5-20`), highlighting DOM behaviour (`tests/integration/highlighting.test.ts:5-32`). Playwright: single project, 60 s timeout, no screenshot/trace/video config (`playwright.config.mjs:4-8`).
- **Proven e2e:** only 4 tests (`tests/e2e/extension.spec.ts:14` highlight+counter, `:23` click + press `k` recolor + persist across reload, `:37` Google SERP exclusion, `:48` onboarding opens). Screenshots come only from ad-hoc `scripts/verify_ui.mjs:20,27,33` (not asserted, not in `package.json:16-18` test scripts); committed `screenshots/` are static artifacts, not CI assertions.
- **Proven gaps (no test exists):** popup.html, tooltip, panel grading keys `1-4/X/0/Esc/Alt+arrows` (`src/content/index.ts:150-157`), YouTube keys `A/S/D/Q/E/C/W` (`:197-206`), EPUB/PDF, backup-import UI, any malicious-input case. No malicious-input e2e exists for S-01/S-02/S-05.

## Proven vs unproven — security & performance

| Claim | Status |
|---|---|
| Quote-breakout at `content/index.ts:106`; safe React/`textContent` sinks | Proven (code) |
| Remote-import expression at `epub.ts:30` | Proven (code) · **Unverified:** CSP block + reachability (needs a run) |
| Plaintext key storage locations; forgeable LF1- checksum | Proven (code + generate/verify test) |
| Import validation absence; books never restored; no size caps | Proven (code) · **Unverified:** failure thresholds (needs oversized-input runs) |
| Highlight/encounter/autoBackup bottlenecks | Proven (code) · **Unverified:** all magnitudes (no measurements taken) |
| "14-phase brief" popup behaviours (multi-sense, alt readings, Meaning/Characters tabs) | **Unverified as defects** — brief doc not in repo; see DICTIONARY_AUDIT.md §D-08 |

## Handling notes for later phases

Every fix must be regression-gated against the existing suite plus a new failing-first test, and must preserve the Phase 2 compatibility commitments. Do not "fix" the LF1- checksum by invalidating issued keys; do not rename the DB, backup format, or any `lf-*` id. CSP/reachability for S-01 must be settled by running the built dist before choosing bundle-vs-remove.
