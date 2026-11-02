import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useSettings } from '../hooks/useSettings';
import { VocabularyService } from '../services/vocabulary';
import { ReadingStatisticsService } from '../services/stats';
import { LANGUAGES, langInfo } from '../languages';
import { Button, ProgressIndicator, Select, StatusBadge } from '../components/ui';
import { sendMessage, extensionUrl } from '../utils/browser';
import { BookOpen, LayoutDashboard, Highlighter, Volume2, LibraryBig, RotateCcw } from 'lucide-react';
import { APP_NAME, APP_TAGLINE, APP_SUBTITLE_JA } from '../brand';
import { t } from '../i18n';
import { isDue } from '../services/srs';

function Popup() {
  const [settings, setSettings] = useSettings();
  const [counts, setCounts] = useState({ total: 0, new: 0, learning: 0, known: 0, ignored: 0, l1: 0, l2: 0, l3: 0, l4: 0 });
  const [today, setToday] = useState({ learnedToday: 0, readingSec: 0, listeningSec: 0, streak: 0 });
  const [due, setDue] = useState(0);
  const [site, setSite] = useState('');
  useEffect(() => {
    void VocabularyService.counts(settings.learningLang).then(setCounts);
    void ReadingStatisticsService.totals(settings.learningLang).then(x => setToday({ learnedToday: x.learnedToday, readingSec: x.readingSec, listeningSec: x.listeningSec, streak: x.streak }));
    void VocabularyService.all(settings.learningLang).then(rows => setDue(rows.filter(r => (r.status.startsWith('l') || r.status === 'new') && isDue(r.reviewDue)).length));
    try {
      const tabs = (globalThis as { chrome?: { tabs?: { query: (q: object, cb: (t: Array<{ url?: string }>) => void) => void } } }).chrome?.tabs;
      if (tabs) tabs.query({ active: true, currentWindow: true }, ts => { try { setSite(ts[0]?.url ? new URL(ts[0].url).hostname : ''); } catch { setSite(''); } });
    } catch { /* no tab access */ }
  }, [settings.learningLang]);
  const open = (hash: string) => { const url = extensionUrl(`dashboard.html#/${hash}`); if ((globalThis as any).chrome?.tabs) (globalThis as any).chrome.tabs.create({ url }); else window.open(url, '_blank'); };
  const goalMin = (() => { try { return Number(localStorage.getItem('lf:daily-goal') ?? 20) || 20; } catch { return 20; } })();
  const todayMin = Math.round((today.readingSec + today.listeningSec) / 60);
  if (!settings.onboarded) return (
    <div className="w-[350px] rounded-[22px] p-5 visus-paper text-[#2b251d] dark:text-[#f2ead9] shadow-[0_24px_60px_rgba(43,37,29,.25)]">
      <p className="text-[10px] font-semibold tracking-[.3em] text-[#a9714b]">{APP_SUBTITLE_JA}</p>
      <h1 className="lf-serif text-[30px] tracking-[.18em] font-medium">{APP_NAME}</h1>
      <p className="text-sm text-zinc-500 mt-1">{APP_TAGLINE} Learn by reading the real web. Your vocabulary stays on this device.</p>
      <Button className="w-full mt-4" onClick={() => open('onboarding')}>Get started</Button>
    </div>
  );
  return (
    <div className="w-[350px] rounded-[22px] p-5 visus-paper text-[#2b251d] dark:text-[#f2ead9] shadow-[0_24px_60px_rgba(43,37,29,.25)]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2b251d] text-[#f4ecdb] lf-serif text-xl font-semibold shadow">V</span>
        <span className="flex-1 min-w-0"><h1 className="lf-serif font-semibold leading-4 text-lg">{APP_NAME}</h1><span className="block text-[10px] tracking-[.18em] text-zinc-400">{APP_SUBTITLE_JA} · {APP_TAGLINE}</span></span>
        <Select value={settings.learningLang} onChange={e => void setSettings({ learningLang: e.target.value as never })} className="!w-auto !rounded-full" aria-label="Learning language">
          {LANGUAGES.filter(l => l.ready).map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </Select>
      </div>
      <div className="rounded-2xl border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0]/60 dark:bg-white/[.03] p-3 mt-4">
        <ProgressIndicator value={todayMin} max={goalMin} label={`Today ${todayMin} / ${goalMin} min · 🔥 ${today.streak} day streak`} />
        <div className="grid grid-cols-3 mt-3 text-center">
          <div><div className="v-statnum !text-[24px]">{counts.new}</div><div className="v-statlabel">{t(settings.interfaceLang, 'new')}</div></div>
          <div className="border-l v-hair"><div className="v-statnum !text-[24px] text-[#a9714b]">{counts.learning}</div><div className="v-statlabel">{t(settings.interfaceLang, 'learning')}</div></div>
          <div className="border-l v-hair"><div className="v-statnum !text-[24px]">{counts.known}</div><div className="v-statlabel">{t(settings.interfaceLang, 'known')}</div></div>
        </div>
        <p className="text-xs text-zinc-500 mt-2 text-center">+{today.learnedToday} known today · {due} to review</p>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <StatusBadge>{site ? `${site}` : 'This site'}</StatusBadge>
        <span className="text-zinc-500">{settings.autoHighlight ? 'Learning on this site' : 'Highlighting paused'}</span>
      </div>
      <label className="flex items-center justify-between text-sm mt-2 rounded-2xl border border-[#ddd0b8] dark:border-[#57503f] px-3 py-2"><span className="flex items-center gap-1.5"><Highlighter size={15} /> Highlighting</span>
        <input type="checkbox" checked={settings.autoHighlight} onChange={e => void setSettings({ autoHighlight: e.target.checked })} className="h-4 w-4 accent-[#a9714b]" /></label>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="soft" onClick={() => open('home')}><LayoutDashboard size={15} /> {t(settings.interfaceLang, 'dashboard')}</Button>
        <Button variant="soft" onClick={() => void sendMessage({ type: 'LF_OPEN_READER', url: location.href })}><BookOpen size={15} /> {t(settings.interfaceLang, 'readPage')}</Button>
        <Button variant="ghost" onClick={() => open('books')}><LibraryBig size={15} /> {t(settings.interfaceLang, 'books')}</Button>
        <Button variant="ghost" onClick={() => open('review')}><RotateCcw size={15} /> {t(settings.interfaceLang, 'review')}{due ? ` (${due})` : ''}</Button>
        <Button variant="ghost" onClick={() => open('vocabulary')}>Vocabulary</Button>
        <Button variant="ghost" onClick={() => open('settings')}><Volume2 size={15} /> {t(settings.interfaceLang, 'settings')}</Button>
      </div>
      <p className="text-[11px] text-zinc-400 mt-3 text-center">Learning {langInfo(settings.learningLang).name} · Native {langInfo(settings.nativeLang as never)?.name ?? settings.nativeLang} · Unlimited · Local-first</p>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Popup />);
