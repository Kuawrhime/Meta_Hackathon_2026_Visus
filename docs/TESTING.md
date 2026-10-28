# Testing — VISUS

```bash
npm test            # Vitest: tests/unit + tests/integration (22 tests)
npm run test:e2e    # Playwright: loads dist/chrome in full Chromium (channel: 'chromium')
npm run typecheck   # tsc --noEmit (also runs inside every build)
```

## Coverage map
- `tests/unit/segmentation.test.ts` — European tokenization, Chinese/Japanese segmentation without whitespace splitting, language detection, lemmatization.
- `tests/unit/vocabulary.test.ts` — IndexedDB persistence (fake-indexeddb), encounter counting, duplicate detection on import, cross-call status consistency.
- `tests/unit/dictionary.test.ts` — offline lookups for all 12 languages, inflection→lemma resolution, no fabricated entries for unknown words, TSV import parsing.
- `tests/unit/services.test.ts` — offline license verification, settings round-trip, backup export/import + AES-GCM encrypt/decrypt, subtitle cue synchronization.
- `tests/integration/highlighting.test.ts` (jsdom) — span wrapping with statuses, link/script preservation, instant recolor on grading, editable-field exclusion.
- `tests/e2e/extension.spec.ts` (Playwright, real Chromium) — extension loads, onboarding opens on install, words highlight on a served page, keyboard grading (`K`) recolors and **persists across page reload**.

## Browser matrix notes
- Chrome/Edge/Brave share the MV3 build; Edge and Brave are Chromium-based and covered by the Chromium e2e path plus manifest validation in the build.
- Firefox: validate with `about:debugging` temporary loading (see INSTALL.md); storage/vocabulary behavior is shared code, and Firefox-specific surface is limited to the manifest (`browser_specific_settings`, sidebar) and the `browser.*` shim.
- Note: Playwright's *headless shell* and branded Chrome ignore `--load-extension`; the e2e suite deliberately uses `channel: 'chromium'` (full Chromium build).

## Manual QA checklist
Static page, React SPA, infinite scroll, ChatGPT/Claude/Gemini streaming answers, YouTube captions (shortcuts A/S/D/Q/E/C/W), EPUB/PDF/TXT import, backup → fresh profile restore, free-tier limit at 1,000 words.
