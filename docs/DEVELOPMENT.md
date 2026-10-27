# Development guide — VISUS

## Setup
```bash
npm install
npm run dev            # dashboard at http://localhost:5173/dashboard.html (chrome.* APIs fall back to local storage)
npm run build:chrome   # production build into dist/chrome (typecheck + 3 Vite builds + manifest)
```

Load `dist/chrome` unpacked (see INSTALL.md) and reload the extension after each build. Content-script changes need a page reload; background changes need an extension reload.

## Layout
Business logic lives in `src/services` — keep React components thin and call services. Page-independent code (segmentation, dictionary, highlighting) must not import `chrome.*` directly; go through `src/utils/browser.ts`.

## Adding a language
1. Author entries in the dictionary generators (`scripts/gen_dicts.py` / `scripts/gen_cjk.mjs` format: word, reading, POS, English definition, native example, example translation) and run `node scripts/convert_dicts.mjs` / `node scripts/gen_cjk.mjs`.
2. Register the loader in `DictionaryService` and the language in `src/languages/index.ts` (`ready: true`, correct `segmenter`).
3. Extend the dictionary-size test expectations.

## Adding a video platform
Implement an adapter next to `src/videos/youtube.ts` that returns `SubtitleCue[]` + a `video` element hook, then reuse the overlay/keyboard code in `src/content/index.ts`. If the platform exposes no accessible text tracks, surface the limitation in the UI — never bypass DRM.

## Builds & manifests
`scripts/build.mjs` runs `tsc`, builds popup/dashboard, content (IIFE) and background (ESM service worker) via the Vite Node API, then writes a per-browser manifest from `scripts/manifests.mjs`. Keep manifest permissions minimal; new host access goes to `optional_host_permissions`.
