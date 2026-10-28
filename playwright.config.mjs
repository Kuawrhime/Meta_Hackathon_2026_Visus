import { defineConfig } from '@playwright/test';
// E2E: loads the built extension in Chromium (Chrome/Edge/Brave share this path).
// Firefox: use the AMO package with web-ext / WebDriver — see docs/INSTALL.md.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  use: { headless: true },
});
