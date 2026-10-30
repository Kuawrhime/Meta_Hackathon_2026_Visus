// Build script: npm run build:chrome|firefox|edge|brave  (or build:all)
// Uses the Vite Node API with configFile:false so no esbuild config bundling is needed.
// Output: dist/<browser>/  — load unpacked, or zip for store submission.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { buildManifest } from './manifests.mjs';
const target = process.argv[2] || 'chrome';
const browsers = target === 'all' ? ['chrome', 'firefox', 'edge', 'brave'] : [target];
execSync('npx tsc --noEmit', { stdio: 'inherit', shell: true });
const appConfig = {
  configFile: false, plugins: [react(), tailwindcss()],
  build: { outDir: resolve('dist-build/app'), emptyOutDir: true, chunkSizeWarningLimit: 4000, rollupOptions: { input: { popup: resolve('popup.html'), dashboard: resolve('dashboard.html') } } },
};
for (const b of browsers) {
  rmSync('dist-build', { recursive: true, force: true });
  await build(appConfig);
  await build({ configFile: false, build: { outDir: resolve('dist-build/content'), emptyOutDir: true, chunkSizeWarningLimit: 6000, lib: { entry: resolve('src/content/index.ts'), formats: ['iife'], name: 'VisusContent', fileName: () => 'content.js' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  await build({ configFile: false, build: { outDir: resolve('dist-build/background'), emptyOutDir: true, chunkSizeWarningLimit: 6000, lib: { entry: resolve('src/background/index.ts'), formats: ['es'], fileName: () => 'background.js' }, rollupOptions: { output: { inlineDynamicImports: true } } } });
  const out = `dist/${b}`;
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  cpSync('dist-build/app', out, { recursive: true });
  cpSync('dist-build/content/content.js', `${out}/content.js`);
  cpSync('dist-build/background/background.js', `${out}/background.js`);
  if (existsSync('public/icons')) cpSync('public/icons', `${out}/icons`, { recursive: true });
  writeFileSync(`${out}/manifest.json`, JSON.stringify(buildManifest(b), null, 2));
  console.log(`Built dist/${b}/ — manifest + popup.html + dashboard.html + content.js + background.js`);
}
console.log('Done:', browsers.join(', '));
