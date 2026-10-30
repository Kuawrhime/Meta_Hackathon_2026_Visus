import { chromium } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
const extPath = path.resolve('dist/chrome');
const server = http.createServer((_q, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<html><body><article><p>The treaty bans discrimination in school for foreign students.</p></article></body></html>'); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const candidates = [
  { channel: 'chromium' },
  { channel: 'chrome' },
  { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' },
  { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  {},
];
let ctx = null; let used = 'none';
for (const c of candidates) {
  if (c.executablePath && !existsSync(c.executablePath)) continue;
  try {
    ctx = await chromium.launchPersistentContext('', { ...c, headless: true, args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`] });
    used = JSON.stringify(c); break;
  } catch (e) { console.log('launch failed', JSON.stringify(c), String(e).slice(0, 150)); }
}
if (!ctx) { console.log('NO BROWSER'); process.exit(1); }
console.log('browser:', used);
const page = await ctx.newPage();
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
await page.goto(`http://127.0.0.1:${port}/article`);
await page.waitForTimeout(4000);
console.log('lf-w count:', await page.locator('.lf-w').count());
console.log('counter:', await page.locator('#lf-counter').count());
console.log('serviceWorkers:', ctx.serviceWorkers().map(s => s.url()));
console.log('backgroundPages:', ctx.backgroundPages().map(p => p.url()));
try {
  const cdp = await ctx.newCDPSession(page);
  const { targetInfos } = await cdp.send('Target.getTargets');
  console.log('targets:', targetInfos.map(t => `${t.type} ${t.url}`).join(' | '));
} catch (e) { console.log('cdp err', String(e).slice(0, 200)); }
await ctx.close(); server.close();
