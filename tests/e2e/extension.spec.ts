import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import http from 'node:http';
// Requires a prior `npm run build:chrome`. Uses Playwright's full Chromium build (channel: 'chromium'),
// because the headless shell and branded Chrome builds ignore --load-extension.
const HTML = '<html><body><article><p>The treaty bans discrimination in school for foreign students. The school opens in the morning.</p></article></body></html>';
async function launch(): Promise<{ ctx: BrowserContext; url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(HTML); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${path.resolve('dist/chrome')}`, `--load-extension=${path.resolve('dist/chrome')}`] });
  return { ctx, url: `http://127.0.0.1:${port}/article`, close: async () => { await ctx.close(); server.close(); } };
}
test('extension highlights words on a static page', async () => {
  const { ctx, url, close } = await launch();
  const page = await ctx.newPage();
  await page.goto(url);
  await expect(page.locator('.lf-w').first()).toBeVisible({ timeout: 10000 });
  expect(await page.locator('.lf-w').count()).toBeGreaterThan(5);
  expect(await page.locator('#lf-counter').count()).toBe(1);
  await close();
});
test('grading a word with the keyboard updates it everywhere and persists', async () => {
  const { ctx, url, close } = await launch();
  const page = await ctx.newPage();
  await page.goto(url);
  const word = page.locator('.lf-w[data-lemma="treaty"]').first();
  await expect(word).toBeVisible({ timeout: 10000 });
  await word.click();
  await expect(page.locator('#lf-panel')).toBeVisible();
  await page.keyboard.press('k');
  await expect(word).toHaveClass(/lf-known/);
  await page.reload();
  await expect(page.locator('.lf-w[data-lemma="treaty"]').first()).toHaveClass(/lf-known/, { timeout: 10000 });
  await close();
});
test('search engine results pages are never highlighted', async () => {
  const { ctx, close } = await launch();
  await ctx.route('https://www.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="search"><div id="rso"><h3>The treaty bans discrimination in school</h3><p>The school opens in the morning for foreign students.</p></div></div></body></html>' }));
  const page = await ctx.newPage();
  await page.goto('https://www.google.com/search?q=treaty+discrimination+school');
  await page.waitForTimeout(2500);
  expect(await page.locator('.lf-w').count()).toBe(0);
  expect(await page.locator('#lf-counter').count()).toBe(0);
  expect(await page.locator('#lf-tooltip').count()).toBe(0);
  await close();
});
test('dashboard onboarding opens automatically on install', async () => {
  const { ctx, close } = await launch();
  await ctx.waitForEvent('page', { timeout: 10000 }).catch(() => undefined);
  const dash = ctx.pages().find(p => p.url().includes('dashboard.html'));
  expect(dash).toBeTruthy();
  await dash!.waitForSelector('text=See words. Learn worlds.', { timeout: 10000 });
  await close();
});
