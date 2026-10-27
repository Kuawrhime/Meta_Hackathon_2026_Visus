# Dictionary Audit — Phase 1

> **Project:** VISUS (Lingua Flow)
> **Phase:** 1 — audit only. No source code edited by this deliverable.
> **Evidence basis:** prior result 3 (dictionary — counts below were **executed** by parsing every `src/dictionary/data/*.json` with node, not estimated) plus prior results 1, 4, 5. Where evidence is a judgment rather than a measurement, it is marked as such; anything not observed is **Unverified**.
> **Compatibility commitments:** IndexedDB name `lingua-flow`, LF1- license keys, backup format, `lf-*` identifiers, VISUS branding, and all working features must survive every data fix. See IMPLEMENTATION_PLAN.md Phase 2.

Severity scale: **Critical** users are shown wrong linguistic data as if authoritative · **High** systematic data loss or misleading fields · **Medium** coverage/lookup gaps · **Low** hygiene.

## D-01 — No provenance or license for any bundled data · Critical (auditability)

- **Files:** `src/dictionary/data/*.json` are bare arrays with no source, license, author, date, or attribution metadata (verified by parsing/sampling en/fr/zh/ar and grepping `src` for CC-CEDICT/Wiktionary/JMdict/provenance/attribution — no hits). `DictEntry` (`src/types/index.ts:6`) has no provenance field. `src/services/license.ts` is the product paywall (LF1-), not data licensing.
- **Proven (executed):** the metadata is absent; there is nothing in the repo to audit the data against.
- **Unverified:** whether the definitions/pinyin/readings are accurate. **Unverified and unauditable** until a source corpus/edition is declared. No test asserts provenance or translation correctness.

## D-02 — Invented-data risk across all 1,837 rows · Critical

- **Evidence (prior result 3, executed counts + reading):** all 1,837 definitions/examples read as short hand-authored glosses with a single invented example sentence each and no source to audit against. `frequency` is list position for fr/zh/ar (sequential 1..N) and a non-sequential rank for en — it is **not** corpus frequency and must be treated as an ordering hint only.
- **Proven (executed):** counts en=457 rows/417 lemmas, fr=139, es=128, de=124, it=127, pt=120, nl=122, ja=120, zh=130, ko=119, ru=124, ar=127; **total = 1,837 rows**. The only test asserts `size > 50` for the 12 languages (`tests/unit/dictionary.test.ts:18-22`); `size()` (`src/services/dictionary.ts:50`) counts Map keys (word+lemma+forms aliases), not rows.
- **Unverified:** gloss/example correctness for every row. **Unverified** — no reference exists to check against (see D-01).

## D-03 — `translation` field is a fake copy of the headword · High

- **Files:** raw rows are tuples `[word, lemma, phonetic, pos, definition(EN gloss), translation, example, frequency, forms?]` (`src/services/dictionary.ts:4`), mapped by `toEntry` (`:22-24`) into `DictEntry` (`src/types/index.ts:6`: word, lemma, phonetic?, pos?, definition, translation, examples[], frequency, forms?, plus unused pronunciation/grammar/related).
- **Proven (executed):** `r[5] === headword` in 130/130 zh, 139/139 fr, 120/120 ja, 127/127 ar, and 455/457 en rows. The real gloss lives in `definition` (e.g. zh 我 = `[wǒ, pronoun, 'I; me.', translation='我', 我学习中文。]`). No native-language translation is bundled; live translation is the separate opt-in service (`src/services/translation.ts:4-15`).
- **Risk (proven mechanism):** any consumer that renders `entry.translation` shows the headword back to the learner. Later phases must either populate, rename, or stop rendering this field — without breaking the backup/import tuple contract (Phase 2).

## D-04 — Multi-sense entries are silently discarded by Map overwrite · High

- **Files:** data contains duplicate-headword rows (en 38 headwords, e.g. `as`×3, `in`×2, `on`×2; zh 现在/工作×2; ja 法律/忙しい/有名×2), but `ensure()` overwrites with `Map.set` on word, lemma, and each form (`src/services/dictionary.ts:32`) and `lookup()` returns a single `DictEntry` (`:39-44`). No `senses[]` field exists (`src/types/index.ts:6`). `allEntries()` (`:51`) returns `[...map.values()]`, so the same entry repeats once per alias key. Bundled `forms[]` are empty for every row (`withForms=0` in all languages; en rows have only 8 fields), so inflection resolution relies solely on rule-based `lemmatize()` (`src/services/segmentation.ts:66-79`), proven only for en `books→book` (`tests/unit/dictionary.test.ts:8-10`).
- **Proven (code + executed data check):** authored senses are lost at load; the surviving gloss for polysemes (`as`/`on`/`in`, 工作 noun vs verb) depends on row order. Only `examples[0]` is ever displayed (`src/content/index.ts:103`; `src/dashboard/main.tsx:66,274`).
- **Consequence:** the reference-popup behaviours "multiple definitions" cannot work on the current model — this is a data-model gap, not a rendering bug.

## D-05 — Phonetics are unreliable per language · High

- **Proven (executed/reading, prior result 3):** en `phonetic` is empty in 422/457 rows; ko `phonetic` duplicates the hangul headword instead of a romanization; ar romanization is present only sporadically (e.g. `al-yawm`, `kitāb`) and empty for most rows. zh is the exception: `phonetic` holds tone-mark pinyin for all 130 rows (wǒ, nǐ, zhè…).
- **Files:** tuple field 3 → `DictEntry.phonetic` (`src/services/dictionary.ts:4,22-24`; `src/types/index.ts:6`). Only a single `phonetic` string exists — there are no structured alternate readings (ja readings are embedded inside the phonetic string in data, with no alternates UI).
- **Unverified:** correctness of the phonetics that are present. **Unverified** (no source, D-01).

## D-06 — Spot defect proves no QA pass: example not containing the headword · Medium

- **Proven (executed, prior result 3):** ar يفكر "to think" has example أظن ذلك, which does not contain the headword. One demonstrated defect of this class implies the class was never checked.
- **Unverified:** how many other rows have example/headword, gloss, or POS mismatches. **Unverified** — requires the Phase 5 QA sweep in the plan; do not quote an error rate until that sweep runs.

## D-07 — Chinese coverage: Simplified-only data, ~120-char Traditional folding, pinyin not searchable · Medium

- **Proven (executed):** `zh.json` is Simplified-only (0 Traditional headwords). Pinyin is display-only — it is not an index key (keys are word/lemma/forms, `src/services/dictionary.ts:32`), so pinyin lookup/search is impossible.
- **Files:** Traditional input is folded to Simplified by a hand table of ~120 chars `T2S` (`src/services/segmentation.ts:16`) inside `normalizeWord` (`:59-64`, "display keeps the original" comment at `:15`); `toTraditional` (`:18-19`) is a naive reverse map with collisions (发→髮/發 distinction lost, last wins). Characters outside the ~120-char table pass through unconverted and will miss the Simplified dictionary.
- **Unverified:** Traditional-input and pinyin lookup behaviour — **no tests** cover either (`tests/unit/segmentation.test.ts`, `tests/unit/searchAndFilter.test.ts:43-48` cover only Simplified segmentation, e.g. 学习/中文/今天 surviving).

## D-08 — Reference-popup behaviours are absent (missing features, brief Unverified) · High

- **Proven (code, prior results 4/5):** no "Meaning"/"Characters" tabs exist anywhere in `src` (zero search hits); dashboard `WordModal` (`src/dashboard/main.tsx:49-76`) and reading side-panel (`:267-284`) show a single definition + translation + one example; zh/yue display shows simplified/traditional + phonetic (`src/dashboard/main.tsx:64`; 繁體 at `:270`). Learning-level controls **do** exist (content panel buttons `src/content/index.ts:107-109`, `WordModal:70-74`, reading panel `:276-282`) and keyboard grading exists (content `:150-157`, `WordModal:55-58`), but only the `k` key is e2e-proven (`tests/e2e/extension.spec.ts:23`); level-button persistence in a real browser is unproven beyond that reload case.
- **Unverified (framing):** the "14-phase brief" document was **not found** in the repo (only `docs/brand-guidelines.md:33` design frames; screenshots in `screenshots/` are static committed artifacts plus `scripts/verify_ui.mjs` outputs, not CI assertions). These are therefore **missing-feature findings against the mission's named behaviours**, not verified defects against a located spec. **Unverified:** exact brief wording/acceptance criteria.

## D-09 — Language/segmentation engine limits · Medium

- **Files:** `segmentText` (`src/services/segmentation.ts:49-58`) prefers `Intl.Segmenter` (`segmentIntl:33-42`) for zh/yue/ja/ko/intl, falling back to `segmentZh` max-match (length 6..2 against the ~60-word `ZH_WORDS` seed at `:7`, extended by `registerZhWords` from loaded dict keys at `:8`, wired at `src/services/dictionary.ts:33`) or `segmentSpace` `WORD_RE` for others — so the space fallback makes a whole unspaced ja/ko/th run one token. `isWordToken` excludes numbers/URLs/emails (`:10-14`). `classifyText` (`src/services/languageFilter.ts:25-61`) uses script ratios then Latin stopword+accent scoring for en/fr/es/de/it/pt/nl/ru only (`STOPWORDS:11-20`); `shouldProcessText:63-71` is a strict gate (zh needs confidence ≥ 0.45; a single Han char yields exactly 0.45 at `:36`). `detectLanguage` (`src/services/segmentation.ts:80-93`) is script-only and distinct from `classifyText`.
- **Proven coverage:** zh multi-char segmentation and ja >3 tokens (`tests/unit/searchAndFilter.test.ts:43-48`; `tests/unit/segmentation.test.ts:14-17`) — both environment-dependent on `Intl.Segmenter` presence; zh/fr gating + number/URL rejection (`tests/unit/searchAndFilter.test.ts:24-42`); search-engine URL rules at URL level only (`:4-22` via `src/services/searchEngine.ts:18-33`, DOM fallback `:37-46` untested at DOM level).
- **Unverified:** segmentation quality in browsers without `Intl.Segmenter` (max-match/space fallbacks). **Unverified** — untested.
- **Dead code (proven by search):** `src/workers/dictWorker.ts:1-8` only re-runs `segmentText`; no constructing caller found. 24 language codes are listed (`src/languages/index.ts:2-27`) with `ready:true` for exactly the 12 bundled languages; yue/th/vi/sv/da/no/fi/pl/uk/el/tr/id are `ready:false` with no loader (`src/services/dictionary.ts:5-18`).

## D-10 — Audio and live translation are untested · Medium

- **Files:** `src/services/audio.ts:10-26` is Web Speech `speechSynthesis` only (zh→zh-CN, yue→yue-Hant-HK at `:16`; voice by lang prefix + `settings.ttsVoice` at `:5-9,18-20`). The header comment (`:3`) claims an "in-memory audio cache" that **does not exist** in the file. `src/services/translation.ts:4-15` returns null unless the user opts in (`localOnly`/`translationEnabled`/provider gates at `:7`), then calls the unofficial Google `gtx` endpoint (`:9`); `aiExplain` (`:16-26`) calls OpenAI `gpt-4o-mini` with the user's key; `LanguageDetectionService` (`:28-31`) delegates to `detectLanguage`.
- **Unverified:** all audio/translation runtime behaviour. **Unverified** — no unit tests exist for either service and neither was executed.

## Entry model (reference, proven)

Lazy dynamic import per language + `Map` cache (`src/services/dictionary.ts:5-37`); `src/dictionary/index.ts:1` is only a re-export. Loading/memory behaviour (all-12-languages retention from the dashboard) is covered in SECURITY_AUDIT.md §P-03.

## Proven vs unproven — dictionary

| Claim | Status |
|---|---|
| 1,837 rows; per-language counts; `translation` = headword; phonetic emptiness rates | Proven (executed parse) |
| Multi-sense rows exist in data and are overwritten at load | Proven (code + data) |
| No provenance/license metadata anywhere | Proven (parse + grep) |
| Gloss/example/phonetic **correctness** of any row | **Unverified** — unauditable without a source (D-01) |
| Traditional/pinyin lookup, audio, translation behaviour | **Unverified** — no code path proof, no tests |
| Full extent of example/headword mismatches | **Unverified** — one spot defect proven (D-06); rate unknown |

## Data-handling rules for later phases

Never silently overwrite senses again (preserve authored rows; surface or explicitly merge them); never render `entry.translation` as a translation until it is real; label `frequency` as an ordering hint; keep tuple/backup compatibility per Phase 2 or migrate with a tested, reversible transform.
