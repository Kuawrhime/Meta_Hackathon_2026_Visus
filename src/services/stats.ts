import type { LangCode, StatDay } from '../types';
import { idb } from '../storage/db';
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const idFor = (date: string, lang: LangCode) => `${date}:${lang}`;
async function getDay(lang: LangCode, date = dayKey()): Promise<StatDay & { id: string }> {
  const ex = await idb.get<StatDay & { id: string }>('stats', idFor(date, lang));
  return ex ?? { id: idFor(date, lang), date, lang, knownMarked: 0, newSeen: 0, readingSec: 0, listeningSec: 0 };
}
export const ReadingStatisticsService = {
  async bump(lang: LangCode, patch: Partial<StatDay>) {
    const d = await getDay(lang);
    if (patch.knownMarked) d.knownMarked += patch.knownMarked;
    if (patch.newSeen) d.newSeen += patch.newSeen;
    if (patch.readingSec) d.readingSec += patch.readingSec;
    if (patch.listeningSec) d.listeningSec += patch.listeningSec;
    await idb.put('stats', d); return d;
  },
  async all(): Promise<StatDay[]> { return idb.all<StatDay>('stats'); },
  async lastDays(lang: LangCode, n = 14): Promise<StatDay[]> {
    const all = (await this.all()).filter(s => s.lang === lang);
    const out: StatDay[] = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); out.push(all.find(s => s.date === k) ?? { date: k, lang, knownMarked: 0, newSeen: 0, readingSec: 0, listeningSec: 0 }); }
    return out;
  },
  async totals(lang: LangCode) {
    const all = (await this.all()).filter(s => s.lang === lang);
    const today = await getDay(lang).catch(() => null);
    let streak = 0; const set = new Set(all.filter(s => s.readingSec + s.listeningSec + s.knownMarked > 0).map(s => s.date));
    const cur = new Date(); if (!set.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (set.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    return { readingSec: all.reduce((a, s) => a + s.readingSec, 0), listeningSec: all.reduce((a, s) => a + s.listeningSec, 0), learnedToday: today?.knownMarked ?? 0, newToday: today?.newSeen ?? 0, streak, days: all };
  },
};
// Counts reading time only when the tab is visible, focused, and text is on screen.
export class ReadingTimer {
  private timer: number | null = null;
  constructor(private lang: LangCode, private isTextVisible: () => boolean) {}
  start() {
    if (this.timer) return;
    this.timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
      if (!this.isTextVisible()) return;
      void ReadingStatisticsService.bump(this.lang, { readingSec: 5 });
    }, 5000);
  }
  stop() { if (this.timer) window.clearInterval(this.timer); this.timer = null; }
}
