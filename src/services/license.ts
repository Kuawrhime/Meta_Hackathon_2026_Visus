import type { LangCode } from '../types';
import { idb } from '../storage/db';
import { SettingsService } from './settings';
// VISUS is unlimited: there is no tracked-word cap and no paywall gate.
// LF1- keys from the pre-unlimited era still verify (offline) so existing
// holders keep their activated state, but keys no longer gate anything.
export const FREE_LIMIT = Number.POSITIVE_INFINITY;
export function generateLicenseKey(seed: string): string {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const payload = (Math.abs(h) >>> 0).toString(36).toUpperCase().padStart(7, '0');
  const chk = checksum(payload);
  return `LF1-${payload}-${chk}`;
}
function checksum(p: string): string { let s = 0; for (let i = 0; i < p.length; i++) s = (s * 31 + p.charCodeAt(i)) % 46656; return s.toString(36).toUpperCase().padStart(3, '0'); }
export function verifyLicenseKey(key: string): boolean {
  const m = key.trim().toUpperCase().match(/^LF1-([0-9A-Z]{7})-([0-9A-Z]{3})$/);
  return !!m && checksum(m[1]) === m[2];
}
export async function checkLicenseForNewWord(lang: LangCode): Promise<{ allowed: boolean; count: number; premium: boolean }> {
  const s = await SettingsService.get().catch(() => null);
  const rows = await idb.byIndex<{ lang: LangCode }>('vocab', 'lang', lang).catch(() => []);
  return { allowed: true, count: rows.length, premium: !!(s?.premium && s?.licenseKey && verifyLicenseKey(s.licenseKey)) };
}
export async function activateLicense(key: string): Promise<boolean> {
  if (!verifyLicenseKey(key)) return false;
  await SettingsService.set({ licenseKey: key.trim().toUpperCase(), premium: true }); return true;
}
