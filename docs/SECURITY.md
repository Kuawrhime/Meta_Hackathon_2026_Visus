# SECURITY — VISUS

Local-first browser extension. No account, no VISUS server, no analytics.

## Trust boundaries
- Webpage content, dictionary files, imported backups, translation responses and content-script messages are **never trusted**.
- All content-script → background messages pass `validateMessage()` (`src/browser/messageValidation.ts`): known types only, enum-checked language/status, size caps (500 words, 100-char words, 1000-char definitions, 0–60 s counters, http(s) reader URLs).
- Extension-page senders are checked against the extension's own ID; arbitrary websites cannot invoke privileged handlers (no externally-connectable surface is declared in either manifest).

## Controls
- Strict TypeScript (`tsc --noEmit` in CI); no `eval`, no `new Function`, no remote script loading (CDN OCR loader removed from `src/books/epub.ts`).
- All popup/tooltip HTML is escaped (`escapeHtml`/`escapeAttr` in `src/content/index.ts`); AI/translation text is inserted with `textContent`.
- Settings writes go through a key allowlist with type matching (`SettingsService.set`).
- Backup import validates size (20 MB), shape and every vocabulary record before restoring; books/stats are capped and shape-checked.
- Dictionary import validates format, caps (5 MB / 5000 rows / field lengths) and rejects prototype-pollution shapes.
- EPUB import caps file size, entry count, uncompressed total and chapters (zip-bomb defence).
- Highlighting excludes password/payment/editable/search/internal pages (content script + audit S/P findings tracked in [SECURITY_AUDIT.md](SECURITY_AUDIT.md)).
- Dataset integrity: `scripts/verify-integrity.mjs` (SHA-256) and `scripts/validate-licenses.mjs` gate dataset changes.
- Backups are AES-GCM encrypted with a user password when the encrypted export is chosen; the legacy format id is kept so old backups still decrypt.

## Reporting
Found a vulnerability? Open a private report to the maintainers with a reproduction on the built `dist/chrome` or `dist/firefox` package. Do not file exploit details in public issues.
