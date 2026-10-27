# Architecture Audit — Phase 1

> **Project:** VISUS (Lingua Flow)
> **Phase:** 1 — audit only. No source code edited by this deliverable.
> **Evidence basis:** prior results 1 (vocab-storage), 2 (architecture), 4 (security-perf), 5 (critic). All file:line refs below are from those audited bodies. Anything not observed in that evidence is marked **Unverified**.
> **Compatibility commitments (must hold in every later phase):** IndexedDB name `lingua-flow`, LF1- license-key format, backup file format, `lf-*` identifiers, VISUS branding, and every working feature keep working. See IMPLEMENTATION_PLAN.md Phase 2.

## Summary

The extension is a Manifest V3 (MV3) cross-browser build for Chrome/Edge/Brave/Firefox from one codebase (`scripts/manifests.mjs`, `scripts/build.mjs`, `package.json:9-14`). React popup + dashboard import services and IndexedDB directly; the content script reaches the same data only through the background service worker's `LF_*` messages. Two sync channels, three copies of several rules, and an unused compat dependency are the main architectural risks. The happy paths are code-proven; Firefox/Brave runtime behaviour is **Unverified** (no run evidence).

Severity scale: **Critical** blocks a core promise · **High** likely user-visible breakage or silent data loss · **Medium** divergence/degradation risk · **Low** hygiene/dead code.

## Findings

### A-01 — Firefox target ships MV3 `service_worker` + `sidebar_action` with no load evidence · High

- **Files:** `scripts/manifests.mjs:4,24,27` (`manifest_version:3`, Firefox `background:{service_worker:'background.js',type:'module'}`, `browser_specific_settings.gecko{id:'lingua-flow@example.local',strict_min_version:'128.0'}` + `sidebar_action` → `dashboard.html`); Chrome `:31` (`minimum_chrome_version:'116'`); `scripts/build.mjs:11-22,29-30` (per-browser `dist/<browser>/`, Vite IIFE `content.js`, ES `background.js`, React popup+dashboard); `tests/e2e/extension.spec.ts:7-12` launches only Chromium `dist/chrome`.
- **Proven (code):** the manifest/build emit that combination for both engines; dist chrome/firefox manifests corroborate `manifests.mjs`.
- **Unverified:** whether Firefox 128 accepts the `service_worker`/`sidebar_action` combo and loads at all. **Unverified** — no Firefox e2e or manual evidence exists in the repo.

### A-02 — Compat layer is bypassed; Brave is undetectable · Medium

- **Files:** `src/utils/browser.ts:4-15` (`rawApi()` prefers `chrome.storage` else `browser.storage`; promisify with `chrome.runtime.lastError`), `:24-37` (`extStorage` arity-sniffs `storage.local.get/set`, in-memory/`localStorage` fallback), `:46-49` (`extensionUrl`), `:17-22` (`browserKind()` never returns `'brave'` — Firefox/Edg else `'chrome'`), `:2` (only mention of the polyfill). `package.json:27` declares `webextension-polyfill` but it is never imported. `src/background/index.ts:10` and `src/content/index.ts:14-17` hand-roll their own `(chrome??browser)`/`chrome?.runtime` + dual callback/promise `msg()`; `src/popup/main.tsx:9,18` imports `sendMessage`/`extensionUrl` yet also calls raw `chrome.tabs.create`.
- **Proven (code):** three messaging wrappers coexist (`browser.ts:38-45`, content `msg():15-17`, background raw `api:10`); `browserKind()` cannot return `'brave'` despite a brave build target (`manifests.mjs:30-31` — same manifest as Chrome, no version delta).
- **Unverified:** Firefox promise/callback interop of the hand-rolled wrappers, and any Edge/Brave distinct behaviour. **Unverified** — no per-browser tests.

### A-03 — Message flow is sound but unbounded and unauthenticated in shape · Medium

- **Files:** `src/background/index.ts:36-56` — async `onMessage` (`return true:55`) switch: `LF_GET_SETTINGS:40`, `LF_SET_SETTINGS:41`, `LF_STATUS_MAP:42`, `LF_ENCOUNTERS:43` (slices to 500), `LF_SET_STATUS:44` (known bump + `broadcastVocab` + autoBackup), `LF_GET_WORD:45`, `LF_SET_DEF:46`, `LF_ADD_READING:47`/`LF_ADD_LISTENING:48` (clamp `Math.min(60,…)`), `LF_OPEN_DASHBOARD:49`, `LF_OPEN_READER:50`, default `undefined:51`, errors as `{error}:53`. Content sends at `src/content/index.ts:33,61,85,96,122,196,216,222,248`; content listens `:254` for `LF_VOCAB_CHANGED`/`LF_REHIGHLIGHT` (reload). Reverse channel `src/background/index.ts:12-17` `broadcastVocab` does `tabs.query({})` → `tabs.sendMessage` per tab, errors swallowed.
- **Proven (code):** full request/response surface enumerated above; no `externally_connectable` in `scripts/manifests.mjs`, content scripts only `http://*/*`+`https://*/*` (`:17`), so senders are the extension's own contexts.
- **Unverified:** runtime delivery/ordering under real multi-tab load. **Unverified** (inspection only, prior result 4).

### A-04 — Optional `tabs` permission is relied on but never requested · High

- **Files:** `scripts/manifests.mjs:13` `permissions=[storage,activeTab,contextMenus,alarms]`, `:14` `optional_permissions=[tabs]`, `:15` `host_permissions=[]`, `:16` optional hosts (youtube/chatgpt/claude.ai/gemini), `:18` `web_accessible_resources` `dashboard.html` to `<all_urls>`. No `permissions.request` call exists anywhere in `src`/`scripts` (verified by search, prior results 2/5). Yet `src/background/index.ts:14,22,33,49-50` uses `tabs.query/create`; failure is silently caught (`/*tabs permission unavailable*/:16`).
- **Proven (code):** the request call is absent; the swallow is present.
- **Unverified:** whether `broadcastVocab`/install-open actually no-op in production. **Unverified** — only the swallowed-catch code was seen; no test proves it works.

### A-05 — Dead context-menu item `lf-lookup` · Low

- **Files:** `src/background/index.ts:24-26` creates `lf-known`/`lf-lookup`/`lf-dashboard`; `onClicked:30-34` handles only `lf-known` + `lf-dashboard`.
- **Proven (code):** `lf-lookup` has no handler. User-visible dead menu entry.

### A-06 — Search-engine exclusion is implemented and e2e-proven; editable exclusion is partial · Medium

- **Files:** `src/content/index.ts:212-215` `init()` returns before settings/style/highlight on `isSearchEnginePage(location.href,document)`; `src/services/searchEngine.ts:4-16` host regexes (google/bing/yahoo/baidu/ddg/startpage/ecosia/brave/yandex/sogou/naver/aol/ask/qwant), `:18-33` `isSearchEngineUrl`, `:37-46` DOM fallback requiring search-input AND results landmark. Proven by `tests/e2e/extension.spec.ts:37-47` (google.com/search → 0 `.lf-w`/`#lf-counter`/`#lf-tooltip`). SPA teardown `src/content/index.ts:232-237` (1s `navWatch` removes counter/tooltip/panel, unwraps `.lf-w`).
- **Files (editable):** `src/services/highlighting.ts:5` `SKIP_SELECTOR='script,style,noscript,textarea,input,select,option,code,pre,kbd,samp,[contenteditable="true"],[data-lf-skip],.lf-ui,…'` enforced `:52-62` via `FILTER_REJECT` on `closest(SKIP_SELECTOR)`; `MutationObserver:240` also skips `.lf-ui`. Password fields are excluded only indirectly by the bare `input` tag — no `type=password` selector exists anywhere.
- **Proven (code):** search exclusion + skip list as written.
- **Gaps (proven absences):** `[contenteditable="true"]` misses `contenteditable=''`/`'plaintext-only'`/inherited editability; keydown guard `src/content/index.ts:156` excludes only `input,textarea` (not `select`/contentEditable) when the panel is open; shadow-DOM closed roots are best-effort open-only (`:246`). **Unverified:** editable/password edge behaviour — no test covers it (e2e has only static/search/onboarding tests `:14-55`; no unit test for `searchEngine.ts` itself).

### A-07 — Pervasive duplication: one rule, two or three implementations · Medium

- **Files:** (1) data path — dashboard `src/dashboard/main.tsx:8-20` and popup `src/popup/main.tsx:5-9` import Vocabulary/Settings/Stats/Dictionary/Highlighting + IndexedDB directly, bypassing the background `LF_*` handlers wrapping the identical services (`src/background/index.ts:1-5,40-50`); `useSettings` (`src/hooks/useSettings.ts:4-17`) serves both React surfaces while content re-implements settings fetch (`LF_GET_SETTINGS` + `DEFAULT_SETTINGS` merge, `src/content/index.ts:216`, without the nested `highlightColors` merge done in `src/services/settings.ts:15-29`). (2) word panel/modal — content `openPanel/grade:82-125` duplicated by dashboard `WordModal:49-77` and `ReadingPage` panel `:208-213,283`, same grade→`setStatus`+known-bump logic (also `src/background/index.ts:44`, dashboard `:54,213`). (3) grade key map `{'1'..'4',k,x,0,Esc}` triplicated: content `:154-156`, dashboard `WordModal:56`, subtitle keys `:197-206`; `WordModal` keydown effect (`:55-58`) has no dependency array and re-registers every render. (4) highlighting — dashboard `HighlightedText:79-89` reuses `HighlightingService.highlightRoot` while the content YouTube path (`:186-192`) hand-rolls `segmentText`/`normalizeWord`/statusMap spans. (5) colors — `src/content/styles.ts:3-8` CSS-var defaults duplicate `src/services/settings.ts:6` `DEFAULT_SETTINGS.highlightColors` and dashboard `swatch():47`/`COLOR_ROWS:42-46`. (6) stats id `` `${date}:${lang}` `` duplicated: `src/services/stats.ts:4-7` and literally in `src/services/backup.ts:36`; status counting duplicated (`VocabularyService.counts` `src/services/vocabulary.ts:48-53`, dashboard inline filters, content `pageCounts/updateCounter` `src/content/index.ts:43-49`, `src/services/highlighting.ts:87-91`); subtitle lemma lookup uses `normalizeWord` vs `lemmatize` elsewhere (`src/content/index.ts:188-192` vs `src/services/highlighting.ts:40-43`) — inconsistent for inflected forms.
- **Proven (code):** every duplicate located above.
- **Unverified:** whether the copies currently agree on all inputs. **Unverified** — no equivalence test exists (prior result 5).

### A-08 — Two sync channels notify the same change · Medium

- **Files:** `src/services/vocabulary.ts:35-36` `setStatus` dispatches window `CustomEvent 'lf:vocab-changed'` **and** `BroadcastChannel('lingua-flow')`; background additionally sends `LF_VOCAB_CHANGED` via `tabs.sendMessage` (`src/background/index.ts:12-17,44`). Content listens to both the BroadcastChannel (`src/content/index.ts:250-253`) and the runtime message (`:254`).
- **Proven (code):** double notification on every status change.
- **Unverified:** idempotence in content (double-highlight/reload safety). **Unverified** — untested (prior result 1).

### A-09 — Storage architecture (detail in vocab-storage evidence, prior result 1) · Medium

- **Files:** single DB `'lingua-flow'`, `DB_VERSION=1`, 6 stores `vocab{keyPath:id,indexes lang,lemma}, books{id}, bookData{id}, stats{id,index date}, dictCache{id}, meta{key}` (`src/storage/db.ts:3,9-16,11`); `migrateIfNeeded` only writes `schemaVersion=1` if missing, no upgrade branch (`:39-43`). Vocab id is `` `${lang}:${lemma}` `` via `lemmatize()` (`src/services/vocabulary.ts:5,22`); `get()` falls back lemma→`normalizeWord` (`:7-10`). Settings use a never-invalidated in-memory cache + `extStorage` + `localStorage 'lf:settings'` mirror (`src/services/settings.ts:15-29`, `src/utils/browser.ts:24-35`); no `storage.onChanged` listener exists.
- **Proven (code):** schema, identity rule, and cache shape as written.
- **Unverified:** any upgrade past v1, and cross-context cache freshness. **Unverified** — no migration or invalidation test.

### A-10 — Dead/underused pieces · Low

- **Files:** `webextension-polyfill` unused (`package.json:27`); `src/workers/dictWorker.ts:1-8` only re-runs `segmentText` off-thread and does no dictionary lookup despite the name — no `new Worker` construction site found in `src`/`tests`, so it is dead code and segmentation runs on the main thread; `yue` dictionary branch (`src/services/dictionary.ts:33`) is unreachable because no `yue` loader exists (`:5-18`) and `yue` is `ready:false` in `src/languages/index.ts:2-27`.
- **Proven (code):** absence of call sites by search.
- **Unverified:** whether the build wires `dictWorker` by filename convention. **Unverified** (prior result 3).

## Proven vs unproven — architecture

| Area | Proven (code/test) | Unverified |
|---|---|---|
| Manifest/build matrix | `manifests.mjs` + `build.mjs` + dist manifests agree | Firefox 128 load; Edge/Brave distinctness |
| Messaging | `LF_*` surface, dual sync channels | Runtime ordering; Firefox interop; double-notify idempotence |
| Permissions | `tabs` never requested; failures swallowed | Production no-op impact |
| Exclusions | SERP exclusion e2e-proven; skip selector as written | Editable/contenteditable/shadow-DOM edges; password explicitness |
| Duplication | All copies located | Behavioural equivalence of copies |

## Out of scope / not audited here

Security sinks, imports, and performance measurements are in SECURITY_AUDIT.md; dictionary data quality is in DICTIONARY_AUDIT.md. The "14-phase brief" document itself was **not found** in `docs/` (only 14 design frames referenced at `docs/brand-guidelines.md:33`, prior result 4) — phase numbering in IMPLEMENTATION_PLAN.md therefore follows the mission's phase list, not a located brief. **Unverified:** exact brief wording.
