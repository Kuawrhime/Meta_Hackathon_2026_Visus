import { chromium } from '@playwright/test';
import path from 'node:path';
const extPath = path.resolve('dist/chrome');
const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`] });
await new Promise(r => setTimeout(r, 1500));
const dash = ctx.pages().find(p => p.url().includes('dashboard.html'));
if (!dash) { console.log('NO DASHBOARD'); process.exit(1); }
await dash.waitForSelector('text=See words. Learn worlds.');
// Onboarding: step0 interface -> Continue; step1 choose Chinese; step2 native French; then Continue to end.
await dash.getByRole('button', { name: 'Continue' }).click();
await dash.getByRole('button', { name: /Chinese/ }).first().click();
await dash.getByRole('button', { name: 'Continue' }).click();
await dash.locator('select').first().selectOption('fr');
await dash.getByRole('button', { name: 'Continue' }).click();
await dash.getByRole('button', { name: 'Continue' }).click();
await dash.getByRole('button', { name: 'Continue' }).click();
await dash.getByRole('button', { name: 'Open dashboard' }).click();
await dash.waitForSelector('text=Daily goal', { timeout: 8000 });
console.log('HOME OK');
await dash.screenshot({ path: 'screenshots/home.png', fullPage: false });
// Reading: paste Chinese + French mixed text
await dash.getByRole('button', { name: 'Reading' }).first().click();
await dash.locator('textarea').fill('我今天想学习中文。\n\nBonjour, je vais à école avec mes amis aujourd hui.\n\n中国是一个历史悠久的国家。它有丰富的文化。');
await dash.waitForTimeout(1500);
const zhWords = await dash.locator('.lf-w').count();
console.log('READER lf-w:', zhWords);
await dash.screenshot({ path: 'screenshots/reading.png', fullPage: false });
// Click a Chinese word to open right vocab panel
const w = dash.locator('.lf-w').first();
await w.click();
await dash.waitForTimeout(800);
console.log('PANEL word visible:', await dash.locator('text=Learning level').count());
await dash.screenshot({ path: 'screenshots/reading-word.png', fullPage: false });
await ctx.close();
console.log('DONE');
