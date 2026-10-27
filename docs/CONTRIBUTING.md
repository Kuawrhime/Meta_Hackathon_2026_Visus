# CONTRIBUTING — VISUS

Read [AGENT_RULES.md](AGENT_RULES.md) first — it binds humans and AI agents alike.

## Setup
```bash
npm install
npm run build:all      # dist/{chrome,firefox,edge,brave}
npm test               # unit + integration (Vitest)
npm run test:e2e       # Playwright, needs a prior build:chrome
npm run typecheck
node scripts/validate-licenses.mjs
node scripts/verify-integrity.mjs
```

## Rules of the road
- One vocabulary engine (`src/services/vocabulary.ts`), one dictionary engine (`src/services/dictionary.ts` + `src/dictionary/`). Route new code through them.
- IndexedDB changes require a migration step in `src/storage/db.ts`; never rename the DB or reset user data.
- Dictionary data changes require updating the registry in `src/dictionary/datasets.ts` and re-running both scripts above.
- Content-script changes must keep the sensitive-page exclusions and pass the security tests in `tests/security`.
- Pull requests are human-reviewed; protected branches only. No direct pushes, no store publishing by automation.

## Testing expectations
New behaviour ships with tests. Dictionary work: cover multi-sense, alternate
spellings/readings, simplified/traditional, pinyin search and unknown words.
Vocabulary work: cover every status, persistence, de-duplication and
cross-source identity. Never disable a failing test to land a change.
