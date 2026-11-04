import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { generateLicenseKey, verifyLicenseKey } from '../../src/services/license';
import { SettingsService } from '../../src/services/settings';
import { BackupService } from '../../src/services/backup';
import { VocabularyService } from '../../src/services/vocabulary';
import { currentCueIndex } from '../../src/videos/youtube';
describe('license (offline verification)', () => {
  it('verifies generated keys and rejects tampered ones', () => {
    const k = generateLicenseKey('buyer@example.com'); expect(verifyLicenseKey(k)).toBe(true);
    expect(verifyLicenseKey(k.slice(0, -1) + 'X')).toBe(false); expect(verifyLicenseKey('LF1-XXXXXXX-XXX')).toBe(false);
  });
});
describe('settings persistence', () => {
  it('round-trips settings', async () => { await SettingsService.set({ learningLang: 'fr' }); expect((await SettingsService.get()).learningLang).toBe('fr'); });
});
describe('backup & restore', () => {
  it('exports and re-imports vocabulary without duplicates', async () => {
    await VocabularyService.setStatus('de', 'Schule', 'l2');
    const json = await BackupService.exportJSON();
    const res = await BackupService.importJSON(json); expect(res.skipped).toBeGreaterThanOrEqual(1);
  });
  it('encrypts and decrypts a backup with a password', async () => {
    const enc = await BackupService.exportEncrypted('correct horse');
    const plain = await BackupService.decryptBackup(enc, 'correct horse');
    expect(JSON.parse(plain).vocab).toBeInstanceOf(Array);
    await expect(BackupService.decryptBackup(enc, 'wrong')).rejects.toBeTruthy();
  });
});
describe('subtitle synchronization', () => {
  const cues = [{ start: 0, end: 2, text: 'a' }, { start: 2, end: 4, text: 'b' }, { start: 5, end: 7, text: 'c' }];
  it('finds the active cue for a playback time', () => {
    expect(currentCueIndex(cues, 0.5)).toBe(0); expect(currentCueIndex(cues, 3)).toBe(1); expect(currentCueIndex(cues, 6)).toBe(2);
  });
});
