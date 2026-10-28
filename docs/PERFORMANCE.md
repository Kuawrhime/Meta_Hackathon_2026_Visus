# PERFORMANCE — lookup measurements

Reference machine (all numbers below, executed 2026-11-03):
Intel Core Ultra 7 155H, 32 GB RAM, Windows, Node v24.19.0 (Vitest), fetch
stubbed to the real generated shard files on local SSD — so "cold" includes
index+shard read and JSON parse, but not a browser extension fetch. Browser
cold lookups additionally pay one `dictionaries/<dataset>/index.json` fetch
per dataset (LRU-cached afterwards).

| Path | Cold (first lookup) | Warm (result cache) | Shard-warm (new word, parsed shard) |
|---|---|---|---|
| Bundled English (`school`) | 105.6 ms (whole-pack load) | p95 0.00 ms | — |
| CC-CEDICT zh (`学校`, shard 学） | 6.6 ms | p95 0.01 ms | avg 0.00 ms, p95 0.01 ms (n=20) |
| Open English WordNet en (`university`) | 5.1 ms | p95 0.00 ms | — |
| JMdict ja (`学生`) | 1.6 ms | p95 0.00 ms | — |

Reproduce: `npx vitest run tests/performance/lookup.bench.test.ts` (prints
`[perf]` lines; asserts warm p95 < 100 ms — the Phase 9 target).

Notes:
- Bundled packs still load whole-per-language on first use (legacy behaviour,
  ~100 ms once, then cached). External datasets are sharded: only the shard
  for the looked-up word is ever fetched/parsed.
- Package size is now ~103 MB per browser build, dominated by dictionary
  shards (WordNet 29 MB, CC-CEDICT 21.7 MB, FreeDict-en 21.4 MB). Shards are
  fetched lazily, never at install/startup. A follow-up worth doing before
  store submission: gzip the shards and decompress with `DecompressionStream`.
- Memory: indexes + up to 12 parsed shards are LRU-capped in
  `src/services/dictionary.ts`; whole-dictionary in-memory maps exist only for
  the small bundled seed packs.
