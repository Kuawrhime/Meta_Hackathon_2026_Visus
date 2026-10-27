# AGENT_RULES — mandatory for every human and AI contributor

1. Never rewrite the application architecture without approval.
2. Never delete existing functionality without approval.
3. Never modify IndexedDB schemas without a migration (see `src/storage/db.ts` `MigrationManager`; DB name stays `lingua-flow`).
4. Never change shared interfaces without updating all dependent modules.
5. Never modify dictionary licensing metadata (`src/dictionary/datasets.ts`) without re-running `scripts/validate-licenses.mjs`.
6. Never bypass security checks (message validation in `src/browser/messageValidation.ts`, settings allowlist, import validators).
7. Never disable failing tests to make a build pass.
8. Never replace real functionality with mock data.
9. Never introduce duplicate vocabulary engines — `src/services/vocabulary.ts` is the one engine.
10. Never modify generated/shipped dictionary files (`src/dictionary/data/*.json`) manually; change the generator or add a documented supplement dataset.
11. Never commit secrets or API keys.
12. Never load remote JavaScript inside the extension (no CDN scripts, no `Function(...import...)`).
13. Preserve preserved identifiers: IndexedDB `lingua-flow`, `LF1-` license keys, `lingua-flow-encrypted` backup format, `LF_*` messages, `lf-*` classes/ids, Firefox add-on ID.
14. Every change must pass: typecheck, unit tests, integration tests, security tests (`tests/security`), build for Chrome + Firefox.
15. No agent has production deployment, store-publishing or signing permissions. Releases are human-reviewed.
