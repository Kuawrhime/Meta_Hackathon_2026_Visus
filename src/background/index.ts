import { VocabularyService } from '../services/vocabulary';
import { SettingsService } from '../services/settings';
import { ReadingStatisticsService } from '../services/stats';
import { BackupService } from '../services/backup';
import { migrateIfNeeded } from '../storage/db';
import { extensionUrl } from '../utils/browser';
import type { Settings, WordStatus } from '../types';
import { validateMessage, isOwnSender } from '../browser/messageValidation';

declare const chrome: any;
const api: any = (globalThis as any).chrome ?? (globalThis as any).browser;

async function broadcastVocab(lemma: string, status: WordStatus, lang: string) {
  try {
    const tabs = await api.tabs.query({});
    for (const t of tabs) { try { await api.tabs.sendMessage(t.id, { type: 'LF_VOCAB_CHANGED', lemma, status, lang }); } catch { /* tab has no content script */ } }
  } catch { /* tabs permission unavailable */ }
}

api?.runtime?.onInstalled?.addListener(async () => {
  await migrateIfNeeded();
  const s = await SettingsService.get();
  if (!s.onboarded) { try { await api.tabs.create({ url: extensionUrl('dashboard.html#/onboarding') }); } catch { /* dashboard opens from popup instead */ } }
  try {
    api.contextMenus?.create({ id: 'lf-known', title: 'VISUS: mark known', contexts: ['selection'] });
    api.contextMenus?.create({ id: 'lf-lookup', title: 'VISUS: look up selection', contexts: ['selection'] });
    api.contextMenus?.create({ id: 'lf-dashboard', title: 'Open VISUS dashboard', contexts: ['action'] });
  } catch { /* context menus already exist */ }
});

api?.contextMenus?.onClicked?.addListener(async (info: any) => {
  const s = await SettingsService.get();
  if (info.menuItemId === 'lf-known' && info.selectionText) await VocabularyService.setStatus(s.learningLang, info.selectionText.trim(), 'known');
  if (info.menuItemId === 'lf-dashboard') { try { await api.tabs.create({ url: extensionUrl('dashboard.html') }); } catch { /* noop */ } }
});

api?.runtime?.onMessage?.addListener((raw: unknown, sender: unknown, sendResponse: (v: unknown) => void) => {
  (async () => {
    try {
      // Sender + schema validation: arbitrary websites can never invoke these.
      const ownId = (api?.runtime as { id?: string } | undefined)?.id;
      const fromContent = !!sender && typeof sender === 'object' && !!(sender as { tab?: unknown }).tab;
      if (!fromContent && ownId && !isOwnSender(sender, ownId)) { sendResponse({ error: 'forbidden sender' }); return; }
      const message = validateMessage(raw);
      if (!message) { sendResponse({ error: 'invalid message' }); return; }
      switch (message.type) {
        case 'LF_GET_SETTINGS': sendResponse(await SettingsService.get(true)); break;
        case 'LF_SET_SETTINGS': sendResponse(await SettingsService.set(message.patch as Partial<Settings>)); break;
        case 'LF_STATUS_MAP': { const m = await VocabularyService.statusMap(message.lang!); sendResponse(Object.fromEntries(m)); break; }
        case 'LF_ENCOUNTERS': { for (const w of message.words!) await VocabularyService.encounter(message.lang!, w); await ReadingStatisticsService.bump(message.lang!, { newSeen: message.words!.length }); sendResponse(true); break; }
        case 'LF_SET_STATUS': { const rec = await VocabularyService.setStatus(message.lang!, message.word!, message.status!); if (message.status === 'known') await ReadingStatisticsService.bump(message.lang!, { knownMarked: 1 }); await broadcastVocab(rec.lemma, message.status!, message.lang!); void BackupService.autoBackup(); sendResponse(rec); break; }
        case 'LF_GET_WORD': sendResponse(await VocabularyService.get(message.lang!, message.word!)); break;
        case 'LF_SET_DEF': { const rec = await VocabularyService.setCustomDefinition(message.lang!, message.word!, message.def!); sendResponse(rec); break; }
        case 'LF_ADD_READING': await ReadingStatisticsService.bump(message.lang!, { readingSec: message.seconds! }); sendResponse(true); break;
        case 'LF_ADD_LISTENING': await ReadingStatisticsService.bump(message.lang!, { listeningSec: message.seconds! }); sendResponse(true); break;
        case 'LF_OPEN_DASHBOARD': try { await api.tabs.create({ url: extensionUrl('dashboard.html') }); } catch { /* noop */ } sendResponse(true); break;
        case 'LF_OPEN_READER': try { await api.tabs.create({ url: extensionUrl('dashboard.html#/reading?url=' + encodeURIComponent(message.url!)) }); } catch { /* noop */ } sendResponse(true); break;
        default: sendResponse(undefined);
      }
    } catch (e) { sendResponse({ error: String(e) }); }
  })();
  return true; // async response
});

// Periodic local auto-backup (alarms permission) — data never leaves the device.
try { api?.alarms?.create?.('lf-autobackup', { periodInMinutes: 360 }); api?.alarms?.onAlarm?.addListener(() => void BackupService.autoBackup()); } catch { /* alarms unavailable */ }
void migrateIfNeeded();
