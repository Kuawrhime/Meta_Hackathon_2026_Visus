# DICTIONARIES — providers, datasets, licenses

Registry: `src/dictionary/datasets.ts` (machine-checked by
`scripts/validate-licenses.mjs`). Provider contract: `DictionaryProvider` in
`src/dictionary/providers.ts` (`lookup`, `lookupAll`, `search`, `getCharacter`,
`getExamples`, `getPronunciation`, `getMetadata`). Language adapters:
`LANGUAGE_ADAPTERS` in the same file.

| Provider | Language | Status in VISUS | License (upstream) |
|---|---|---|---|
| VISUS bundled seed packs | en fr es de it pt nl ja zh ko ru ar | **Active** (shipped files) | Project-authored; provenance unverified — see [DICTIONARY_AUDIT.md](DICTIONARY_AUDIT.md) |
| VISUS zh reference supplement | zh | **Active** (圖像/图像， 張/张 from supplied reference screenshots) | Project-authored |
| CC-CEDICT | zh | **Active** — vendored, sharded in public/dictionaries | CC BY-SA 3.0 |
| Wiktionary / Wiktextract | ko (kaikki Korean extract) | **Active** — vendored, sharded in public/dictionaries | CC BY-SA 4.0 / GFDL |
| Open English WordNet | en | **Active** — vendored, sharded in public/dictionaries | CC BY 4.0 / WordNet License |
| JMdict | ja | **Active** — vendored, sharded in public/dictionaries | EDRDG licence |
| FreeDict | de es it + others | **Active** — vendored, sharded in public/dictionaries | Per-pack (GFDL / CC BY-SA) |

Activation rule: a dataset becomes active only when its files are vendored
into the repo with source URL, version, download date, license text and a
SHA-256 from `scripts/verify-integrity.mjs`. Nothing is downloaded at runtime.
VISUS never invents definitions, frequency rankings or example sentences;
bundled frequency values are ordering hints only.

Chinese specifics: Traditional→Simplified normalization is the identity key;
entries carry both forms and per-character breakdowns. Search works by
characters, by pinyin (tone-insensitive), and by English definition text.

## Rebuilding the datasets

Download the sources listed in src/dictionary/datasets.ts into .dict-src/ (CC-CEDICT .txt.gz, JMdict_e.gz, english-wordnet-2024.zip extracted, FreeDict TEI .src.tar.xz extracted, kaikki.org Korean JSONL), then run npm run dict:build and npm run dict:licenses. Conversion: scripts/build-dictionaries/convert-all.mjs. Korean/Arabic morphology: rule-based lemmatizeKo/lemmatizeAr in src/services/segmentation.ts (documented limits — not full analyzers).

FreeDict eng-* pairs are English-to-foreign translations, so English definitions use WordNet only; FreeDict serves fr/de/es/it headwords.
