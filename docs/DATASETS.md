# DATASETS — shipped dictionary files and checksums

Regenerate with `npm run dict:licenses`. Never hand-edit generated files;
rebuild with `npm run dict:build` (sources in `.dict-src/`, git-ignored).

## Bundled seed packs (`src/dictionary/data/`, project-authored, unverified)

| File | SHA-256 |
|---|---|
| en/fr/es/de/it/pt/nl/ja/zh/ko/ru/ar + zh.extra | see `scripts/verify-integrity.mjs` output |

## Vendored licensed datasets (`public/dictionaries/<id>/`, lazy shards)

| Dataset | Rows | Shards | Size | Index SHA-256 | License text |
|---|---|---|---|---|---|
| cc-cedict (zh) | 196,450 | 10,820 | 21.7 MB | `2699bceca4202e56ff284ed13d7b24ac378e352f9b680bbe0d44eb243a881aaa` | licenses/cc-by-sa-3.0.txt |
| wordnet (en) | 160,327 | 27 | 29.0 MB | `250c284a40036d5cd7d2322ded6b0020e7bbb1c6c477e59592cace719b8f11ae` | licenses/open-english-wordnet.txt |
| jmdict (ja, common subset) | 42,460 | 2,728 | 4.2 MB | `78d0271e199f104b74955c5532e01261cb16b41304eb7a42b68bbf7922b97788` | licenses/jmdict-edrdg.html |
| wiktionary (ko) | 67,018 | 6,214 | 8.8 MB | `364486ce0e995c3bfd70b1955ba731fc38a74eb5700644fbfd261af8e7cc9ea3` | licenses/cc-by-sa-4.0.txt |
| freedict-fr | 14,163 | 33 | 1.0 MB | `61bf2ee4cf43ad4a439d79fc5d55cac80ab860f9091516e51ac3bcb4daae1787` | licenses/freedict-fra-eng.txt |
| freedict-de | 111,600 | 30 | 9.5 MB | `15152e79976d57053e039c1bf59e069d946fa9a9c555c59bbc828701b28320fd` | licenses/freedict-deu-eng.txt |
| freedict-es | 7,627 | 32 | 0.4 MB | `0fe24878ae996539dfe7f0c6b60cf338639f57bd0b6e1a86fe1076728f03d8eb` | licenses/freedict-spa-eng.txt |
| freedict-it | 34,922 | 27 | 2.6 MB | `3efe393d66bbff0295938b89ab4c0cb74fc1fcd73cfe271d53567f7320fa1d8c` | licenses/freedict-ita-eng.txt |
| freedict-en | 270,340 | 35 | 21.4 MB | `6d08696ce1510fc9d5fab8dcd5de420d1a0424987447e10fc9f73f2704c72871` | licenses/freedict-eng-fra.txt (et al.) |

All vendored datasets were downloaded 2026-11-03 from their upstream sources
(see `src/dictionary/datasets.ts` for exact URLs, versions, transformations).
Shards are fetched lazily per looked-up word; nothing loads at install time.
