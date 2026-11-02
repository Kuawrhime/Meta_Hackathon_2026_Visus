import type { DatasetManifest } from '../types';

// Dataset provenance registry. Rule: a dataset is only `active` in VISUS when
// shipped in the repo. External providers below are registered but INACTIVE
// until their data files, checksum and license text are vendored and verified
// by scripts/validate-licenses.mjs — VISUS never downloads dictionary data at
// runtime and never invents provenance.
export const DATASETS: DatasetManifest[] = [
  {
    id: 'visus-bundled-legacy', providerId: 'bundled', language: 'multi', version: '1.0.0',
    sourceUrl: 'in-repo: src/dictionary/data/*.json (project-authored seed packs)',
    downloadedAt: '2025-01-01', license: 'Project-authored (VISUS repository); no external source claimed',
    attribution: 'VISUS project seed dictionaries — unverified provenance, ordering-hint frequency only',
    checksum: 'computed-at-build: scripts/verify-integrity.mjs', transformations: ['tuple rows -> DictEntry', 'multi-sense grouping by lemma'],
    verified: false, active: true,
  },
  {
    id: 'visus-zh-reference-supplement', providerId: 'bundled-zh-supplement', language: 'zh', version: '1.0.0',
    sourceUrl: 'in-repo: src/dictionary/data/zh.extra.json (entries transcribed from the VISUS reference screenshots supplied by the project owner)',
    downloadedAt: '2026-11-03', license: 'Project-authored (VISUS repository)',
    attribution: 'VISUS reference-screenshot supplement (圖像/图像, 張/张)',
    checksum: 'computed-at-build: scripts/verify-integrity.mjs', transformations: ['sense-split into separate rows per part of speech'],
    verified: false, active: true,
  },
  { id: 'cc-cedict', providerId: 'cc-cedict', language: 'zh', version: '1.0 (MDBG export 2026-11-03)', sourceUrl: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz', downloadedAt: '2026-11-03', license: 'CC BY-SA 3.0', licenseUrl: 'dictionaries/licenses/cc-by-sa-3.0.txt', attribution: 'CC-CEDICT — © MDBG / CC-CEDICT project', checksum: 'index sha256:2699bceca4202e56ff284ed13d7b24ac378e352f9b680bbe0d44eb243a881aaa', transformations: ['numbered pinyin -> tone marks', 'one row per sense (max 5)', 'traditional kept in forms[]', 'frequency unknown -> 9999'], verified: true, active: true },
  { id: 'wiktionary-ko', providerId: 'wiktionary', language: 'ko', version: 'kaikki.org Wiktextract Korean (2026-11-03)', sourceUrl: 'https://kaikki.org/dictionary/Korean/kaikki.org-dictionary-Korean.jsonl', downloadedAt: '2026-11-03', license: 'CC BY-SA 4.0 (Wiktionary) / GFDL', licenseUrl: 'dictionaries/licenses/cc-by-sa-4.0.txt', attribution: 'Wiktionary contributors, via Wiktextract (kaikki.org)', checksum: 'index sha256:364486ce0e995c3bfd70b1955ba731fc38a74eb5700644fbfd261af8e7cc9ea3', transformations: ['streamed JSONL, Korean entries only', 'max 3 senses, first gloss each', 'words >10 chars skipped'], verified: true, active: true },
  { id: 'open-english-wordnet', providerId: 'wordnet', language: 'en', version: 'Open English WordNet 2024', sourceUrl: 'https://github.com/globalwordnet/english-wordnet/releases/download/2024-edition/english-wordnet-2024.zip', downloadedAt: '2026-11-03', license: 'CC BY 4.0 (OEWN) / WordNet License (Princeton)', licenseUrl: 'dictionaries/licenses/open-english-wordnet.txt', attribution: 'Open English WordNet 2024 © Global WordNet Association; derived from Princeton WordNet', checksum: 'index sha256:250c284a40036d5cd7d2322ded6b0020e7bbb1c6c477e59592cace719b8f11ae', transformations: ['index+data joined on synset offset', 'first gloss per lemma', 'frequency unknown -> 9999'], verified: true, active: true },
  { id: 'jmdict', providerId: 'jmdict', language: 'ja', version: 'JMdict_e (2026-11-03), common-priority subset', sourceUrl: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz', downloadedAt: '2026-11-03', license: 'EDRDG License (CC BY-SA 3.0 conditions)', licenseUrl: 'dictionaries/licenses/jmdict-edrdg.html', attribution: 'JMdict © Electronic Dictionary Research and Development Group (EDRDG)', checksum: 'index sha256:78d0271e199f104b74955c5532e01261cb16b41304eb7a42b68bbf7922b97788', transformations: ['common-priority subset (news1/ichi1/spec1/gai1/nf*) — documented subset', 'one row per sense (max 3)', 'kana reading as phonetic'], verified: true, active: true },
  { id: 'freedict-fr', providerId: 'freedict', language: 'fr', version: 'FreeDict fra-eng 0.4.1 + eng-fra 0.1.6', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', license: 'Per-pair license: dictionaries/licenses/freedict-fra-eng.txt', attribution: 'FreeDict project (freedict.org)', checksum: 'index sha256:61bf2ee4cf43ad4a439d79fc5d55cac80ab860f9091516e51ac3bcb4daae1787', transformations: ['TEI orth/pron/pos/translation', 'max 3 translations as senses'], verified: true, active: true },
  { id: 'freedict-de', providerId: 'freedict', language: 'de', version: 'FreeDict deu-eng 0.3.5 + eng-deu 0.3.7', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', license: 'Per-pair license: dictionaries/licenses/freedict-deu-eng.txt', attribution: 'FreeDict project (freedict.org)', checksum: 'index sha256:15152e79976d57053e039c1bf59e069d946fa9a9c555c59bbc828701b28320fd', transformations: ['TEI orth/pron/pos/translation', 'max 3 translations as senses'], verified: true, active: true },
  { id: 'freedict-es', providerId: 'freedict', language: 'es', version: 'FreeDict spa-eng 0.3.1 + eng-spa 2025.11.23', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', license: 'Per-pair license: dictionaries/licenses/freedict-spa-eng.txt', attribution: 'FreeDict project (freedict.org)', checksum: 'index sha256:0fe24878ae996539dfe7f0c6b60cf338639f57bd0b6e1a86fe1076728f03d8eb', transformations: ['TEI orth/pron/pos/translation', 'max 3 translations as senses'], verified: true, active: true },
  { id: 'freedict-it', providerId: 'freedict', language: 'it', version: 'FreeDict ita-eng 2025.11.23 + eng-ita 2025.11.23', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', license: 'Per-pair license: dictionaries/licenses/freedict-ita-eng.txt', attribution: 'FreeDict project (freedict.org)', checksum: 'index sha256:3efe393d66bbff0295938b89ab4c0cb74fc1fcd73cfe271d53567f7320fa1d8c', transformations: ['TEI orth/pron/pos/translation', 'max 3 translations as senses'], verified: true, active: true },
  { id: 'freedict-en', providerId: 'freedict', language: 'en', version: 'FreeDict eng-* pairs (2026-11-03)', sourceUrl: 'https://download.freedict.org/dictionaries/', downloadedAt: '2026-11-03', license: 'Per-pair licenses in dictionaries/licenses/ (see freedict-eng-fra.txt et al.)', licenseUrl: 'dictionaries/licenses/freedict-eng-fra.txt', attribution: 'FreeDict project (freedict.org)', checksum: 'index sha256:6d08696ce1510fc9d5fab8dcd5de420d1a0424987447e10fc9f73f2704c72871', transformations: ['TEI orth/pron/pos/translation', 'max 3 translations as senses'], verified: true, active: true },
];
export const datasetById = (id: string) => DATASETS.find(d => d.id === id);
export const activeDatasets = () => DATASETS.filter(d => d.active);
