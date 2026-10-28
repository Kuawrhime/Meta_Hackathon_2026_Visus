# Installation — VISUS

Build first: `npm install`, then one of `npm run build:chrome|firefox|edge|brave|build:all`. Output lands in `dist/<browser>/`.

## Chrome
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `dist/chrome/`.
3. The dashboard opens with onboarding. Click the puzzle icon and pin **VISUS**.

## Microsoft Edge
1. Open `edge://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `dist/edge/`.

## Brave
1. Open `brave://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `dist/brave/` (Brave uses the Chrome Web Store build).

## Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on…** → select `dist/firefox/manifest.json`.
3. For a permanent install, package `dist/firefox/` as a ZIP and submit to AMO for signing; the manifest already carries `browser_specific_settings.gecko` and a `sidebar_action` panel.

## Store packages
Zip the contents of each `dist/<browser>/` folder (manifest.json at the zip root):
- Chrome Web Store / Brave: zip of `dist/chrome/`
- Edge Add-ons: zip of `dist/edge/`
- Firefox AMO: zip of `dist/firefox/` (AMO signs it; unsigned zips work with temporary loading)

## Notes
- Firefox build uses the same MV3 service-worker manifest shape (Firefox ≥128) — no core feature is reduced; browser differences are isolated in `src/utils/browser.ts`.
- Optional permissions (YouTube/ChatGPT/Claude/Gemini host access) are requested only by the features that need them; the core highlighter runs on http/https pages you visit.
- Data survives browser restarts (IndexedDB + extension storage). Use Settings → Backup to migrate between browsers/profiles. Existing data from before the VISUS rename is preserved in place.
