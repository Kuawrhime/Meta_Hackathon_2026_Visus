import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useSettings } from '../hooks/useSettings';
import { LANGUAGES, INTERFACE_LANGS, langInfo } from '../languages';
import type { BookRecord, DictEntry, LangCode, Settings, VocabRecord, WordStatus } from '../types';
import { STATUS_LABEL } from '../types';
import { VocabularyService } from '../services/vocabulary';
import { DictionaryService } from '../services/dictionary';
import { ReadingStatisticsService, ReadingTimer } from '../services/stats';
import { AudioService, listVoices } from '../services/audio';
import { BackupService } from '../services/backup';
import { activateLicense, verifyLicenseKey } from '../services/license';
import { HighlightingService } from '../services/highlighting';
import { fetchArticle } from '../reader/extract';
import { BookReaderService } from '../books/library';
import { parseEpub, ocrPdfPage } from '../books/epub';
import { listCbzPages } from '../books/cbz';
import { downloadAnkiTsv, sendToAnkiConnect } from '../services/anki';
import { isDue } from '../services/srs';
import { detectLanguage, segmentText, toTraditional } from '../services/segmentation';
import { classifyText } from '../services/languageFilter';
import { idb } from '../storage/db';
import { Button, Card, Input, Label, Select, Stat, Toggle, BarChart } from '../components/ui';
import { APP_NAME, APP_TAGLINE, APP_SUBTITLE_JA, BACKUP_FILENAME, BACKUP_ENCRYPTED_FILENAME, vocabExportFilename } from '../brand';
import { Home, BookOpen, Library, Video, ListOrdered, BarChart3, BookMarked, Globe2, Settings as SettingsIcon, Volume2, X, Compass, RotateCcw, AudioLines, Captions } from 'lucide-react';
import { voiceCatalogue } from '../services/voices';
import { translateLocally } from '../services/localTranslate';
import { parseTimedText } from '../videos/sites';

type Page = 'onboarding'|'home'|'reading'|'discover'|'books'|'videos'|'audio'|'transcript'|'vocabulary'|'review'|'statistics'|'dictionaries'|'languages'|'settings';
const NAV: Array<{ id: Page; label: string; no: string; icon: React.ReactNode }> = [
  { id: 'home', label: 'Home', no: '01', icon: <Home size={16} /> }, { id: 'reading', label: 'Reading', no: '02', icon: <BookOpen size={16} /> },
  { id: 'discover', label: 'Discover', no: '03', icon: <Compass size={16} /> }, { id: 'books', label: 'Library', no: '04', icon: <Library size={16} /> },
  { id: 'videos', label: 'Videos', no: '05', icon: <Video size={16} /> }, { id: 'audio', label: 'Audio', no: '06', icon: <AudioLines size={16} /> },
  { id: 'transcript', label: 'Transcript', no: '07', icon: <Captions size={16} /> }, { id: 'vocabulary', label: 'Vocabulary', no: '08', icon: <ListOrdered size={16} /> },
  { id: 'review', label: 'Review', no: '09', icon: <RotateCcw size={16} /> }, { id: 'statistics', label: 'Statistics', no: '10', icon: <BarChart3 size={16} /> },
  { id: 'dictionaries', label: 'Dictionaries', no: '11', icon: <BookMarked size={16} /> }, { id: 'languages', label: 'Languages', no: '12', icon: <Globe2 size={16} /> },
  { id: 'settings', label: 'Settings', no: '13', icon: <SettingsIcon size={16} /> },
];
const PAGE_NO: Record<string, string> = Object.fromEntries(NAV.map(n => [n.id, n.no]));
function route(): { page: Page; param: string } {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, q] = h.split('?');
  const pages: Page[] = ['onboarding', 'home', 'reading', 'discover', 'books', 'videos', 'audio', 'transcript', 'vocabulary', 'review', 'statistics', 'dictionaries', 'languages', 'settings'];
  return { page: (pages.includes(p as Page) ? p : 'home') as Page, param: new URLSearchParams(q ?? '').get('url') ?? '' };
}
// COLORS legend shared by onboarding + settings
const COLOR_ROWS: Array<{ s: WordStatus; desc: string }> = [
  { s: 'new', desc: 'New — never graded' }, { s: 'l1', desc: 'Learning 1 — just started' }, { s: 'l2', desc: 'Learning 2 — familiar' },
  { s: 'l3', desc: 'Learning 3 — almost known (dotted underline)' }, { s: 'l4', desc: 'Learning 4 — underline only' },
  { s: 'known', desc: 'Known — no highlight' }, { s: 'ignored', desc: 'Ignored — no highlight' },
];
const swatch = (s: WordStatus) => s === 'new' ? '#bfdbfe' : s === 'l1' ? '#fde047' : s === 'l2' ? '#fef08a' : s === 'l3' ? '#fef9c3' : 'transparent';

function WordModal({ word, lang, onClose, onGraded }: { word: string; lang: LangCode; onClose: () => void; onGraded: () => void }) {
  const [entry, setEntry] = useState<DictEntry | undefined>();
  const [rec, setRec] = useState<VocabRecord | undefined>();
  const [custom, setCustom] = useState('');
  useEffect(() => { void DictionaryService.lookup(lang, word).then(setEntry); void VocabularyService.get(lang, word).then(r => { setRec(r); setCustom(r?.customDefinition ?? ''); }); }, [word, lang]);
  const grade = async (s: WordStatus) => { await VocabularyService.setStatus(lang, word, s); if (s === 'known') await ReadingStatisticsService.bump(lang, { knownMarked: 1 }); onGraded(); onClose(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const map: Record<string, WordStatus> = { '1': 'l1', '2': 'l2', '3': 'l3', '4': 'l4', k: 'known', x: 'ignored', '0': 'new' }; if (e.key === 'Escape') onClose(); else if (map[e.key.toLowerCase()] && !(e.target as HTMLElement).matches('input,textarea')) void grade(map[e.key.toLowerCase()]); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white dark:bg-zinc-900 max-w-md w-full p-6 shadow-xl rounded-[2px] border border-[#ddd0b8]" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between"><div><h3 className="text-xl font-bold">{entry?.word ?? word} <span className="text-sm font-normal text-zinc-400">{entry?.phonetic ?? ''}</span></h3>
      <p className="text-xs text-zinc-500">{entry?.pos ?? ''} · status {rec?.status ?? 'new'} · seen {rec?.encounters ?? 0}×{entry ? ` · freq #${entry.frequency}` : ''}</p></div>
      <button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      {(lang === 'zh' || lang === 'yue') && <p className="mt-2 text-sm"><span className="rounded-md bg-orange-50 dark:bg-orange-950 px-1.5 py-0.5">简体 {word}</span> <span className="rounded-md bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 ml-1">繁體 {toTraditional(word)}</span> <span className="text-zinc-500 ml-1">{entry?.phonetic ?? ''} (pinyin)</span></p>}
      <p className="mt-2 text-sm">{custom || entry?.definition || 'No local dictionary entry. Add a custom definition or enable translation in Settings.'}</p>
      {entry && <><p className="text-sm text-zinc-500 mt-1">{entry.translation !== entry.word ? `Translation: ${entry.translation}` : `English: ${entry.definition}`}</p><p className="text-sm italic text-zinc-500 mt-1">{entry.examples[0]}</p></>}
      <div className="flex gap-2 mt-3"><Button variant="soft" onClick={() => void AudioService.speakWord(word, lang)}><Volume2 size={14} /> Say word</Button>
      <Button variant="ghost" onClick={() => entry && void AudioService.speakSentence(entry.examples[0] ?? word, lang)}>Say example</Button></div>
      <Label>Custom definition</Label><div className="flex gap-2"><Input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Your own meaning…" /><Button variant="soft" onClick={() => void VocabularyService.setCustomDefinition(lang, word, custom).then(onGraded)}>Save</Button></div>
      <div className="grid grid-cols-4 gap-2 mt-4">
        {(['l1', 'l2', 'l3', 'l4'] as WordStatus[]).map((s, i) => <Button key={s} variant="soft" onClick={() => void grade(s)}>{i + 1} · {STATUS_LABEL[s]}</Button>)}
        <Button onClick={() => void grade('known')}>K · Known</Button><Button variant="soft" onClick={() => void grade('ignored')}>X · Ignore</Button>
        <Button variant="ghost" onClick={() => void grade('new')}>0 · New</Button><Button variant="ghost" onClick={onClose}>Esc</Button>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2">Shortcuts: 1–4, K known, X ignore, 0 new, Esc close.</p>
    </div></div>;
}

function HighlightedText({ text, lang, onWord, refreshKey }: { text: string; lang: LangCode; onWord: (w: string) => void; refreshKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void VocabularyService.statusMap(lang).then(map => { if (!live || !ref.current) return; HighlightingService.highlightRoot(ref.current, lang, map); });
    const el = ref.current; if (!el) return;
    const click = (e: MouseEvent) => { const t = (e.target as HTMLElement).closest('.lf-w') as HTMLElement | null; if (t?.dataset.word) onWord(t.dataset.word); };
    el.addEventListener('click', click); return () => { live = false; el.removeEventListener('click', click); };
  }, [text, lang, refreshKey, onWord]);
  return <div ref={ref} dir={langInfo(lang).rtl ? 'rtl' : 'ltr'} className="whitespace-pre-wrap leading-relaxed">{text}</div>;
}

function Onboarding({ settings, setSettings, go }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void>; go: (p: Page) => void }) {
  const [step, setStep] = useState(0);
  const [dictSize, setDictSize] = useState(0);
  useEffect(() => { if (step === 3) void DictionaryService.size(settings.learningLang).then(setDictSize); }, [step, settings.learningLang]);
  const steps = ['Interface language', 'Language to learn', 'Your native language', 'Dictionary', 'Colors', 'Done'];
  return <div className="max-w-3xl mx-auto py-10 px-4">
    <p className="v-kicker">Language Immersion Platform</p>
    <div className="flex items-start gap-6"><div className="flex-1"><h1 className="lf-serif font-medium leading-none" style={{ fontSize: 'clamp(56px,10vw,104px)', letterSpacing: '.06em' }}>{APP_NAME}</h1>
    <p className="lf-serif text-3xl mt-4">{APP_TAGLINE}</p>
    <p className="v-sub text-zinc-500 mt-1">An immersive way to discover languages.</p></div>
    <p className="hidden sm:block lf-serif text-lg" style={{ writingMode: 'vertical-rl', letterSpacing: '.3em' }}>{APP_SUBTITLE_JA}</p>
    <img src="/images/ink-stroke.png" alt="" className="hidden md:block w-24 object-cover mix-blend-multiply dark:hidden" /></div>
    <p className="text-zinc-500 mt-1">Step {step + 1} of {steps.length}: {steps[step]}. No account needed — everything stays on this device.</p>
    <div className="flex gap-1 my-4">{steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? 'bg-[#a9714b]' : 'bg-zinc-200 dark:bg-zinc-800'}`} />)}</div>
    {step === 0 && <Card><Label>Interface language</Label><Select value={settings.interfaceLang} onChange={e => void setSettings({ interfaceLang: e.target.value })}>{INTERFACE_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Card>}
    {step === 1 && <Card><Label>I want to learn</Label><div className="grid grid-cols-2 gap-2">{LANGUAGES.filter(l => l.ready).map(l => <Button key={l.code} variant={settings.learningLang === l.code ? 'primary' : 'soft'} onClick={() => void setSettings({ learningLang: l.code })}>{l.name} · {l.native}</Button>)}</div>
      <p className="text-xs text-zinc-400 mt-2">Architecture-ready (segmentation planned): {LANGUAGES.filter(l => !l.ready).map(l => l.name).join(', ')}.</p></Card>}
    {step === 2 && <Card><Label>My native language (for translations)</Label><Select value={settings.nativeLang} onChange={e => void setSettings({ nativeLang: e.target.value as LangCode })}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Card>}
    {step === 3 && <Card><p className="text-sm">Offline dictionary for <b>{langInfo(settings.learningLang).name}</b> is bundled and ready: <b>{dictSize}</b> entries with definitions, pronunciation and frequency. No download leaves your device. Words missing from the dictionary can use the optional translation provider (off by default).</p></Card>}
    {step === 4 && <Card><p className="text-sm mb-2">Your vocabulary colors everywhere — web, books and subtitles:</p>{COLOR_ROWS.map(r => <div key={r.s} className="flex items-center gap-2 py-1 text-sm"><span className="inline-block h-4 w-8 rounded border border-zinc-300" style={{ background: swatch(r.s) }} /><b className="w-28">{STATUS_LABEL[r.s]}</b><span className="text-zinc-500">{r.desc}</span></div>)}</Card>}
    {step === 5 && <Card><p className="text-sm">Your local vocabulary database is initialized. Browse any page in {langInfo(settings.learningLang).name}: words are highlighted automatically. Click a word to grade it — it updates everywhere instantly.</p></Card>}
    <div className="flex justify-between mt-4">
      <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
      {step < 5 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button onClick={() => void setSettings({ onboarded: true }).then(() => go('home'))}>Open dashboard</Button>}
    </div></div>;
}

function HomePage({ settings, go, onWord }: { settings: Settings; go: (p: Page) => void; onWord: (w: string) => void }) {
  const [counts, setCounts] = useState({ total: 0, new: 0, learning: 0, known: 0, ignored: 0, l1: 0, l2: 0, l3: 0, l4: 0 });
  const [totals, setTotals] = useState({ readingSec: 0, listeningSec: 0, learnedToday: 0, newToday: 0, streak: 0 });
  const [days, setDays] = useState<Array<{ date: string; readingSec: number; listeningSec: number; knownMarked: number; newSeen: number }>>([]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [recent, setRecent] = useState<VocabRecord[]>([]);
  const lang = settings.learningLang;
  const refresh = useCallback(() => { void VocabularyService.counts(lang).then(setCounts); void ReadingStatisticsService.totals(lang).then(setTotals); void ReadingStatisticsService.lastDays(lang, 14).then(d => setDays(d as never)); void BookReaderService.list().then(b => setBooks(b.slice(0, 4))); void VocabularyService.all(lang).then(v => setRecent([...v].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 8))); }, [lang]);
  useEffect(refresh, [refresh]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const [goalMin, setGoalMin] = useState(() => Number(localStorage.getItem('lf:daily-goal') ?? 20));
  const todayMin = Math.round(((days[days.length - 1]?.readingSec ?? 0) + (days[days.length - 1]?.listeningSec ?? 0)) / 60);
  const goalPct = Math.min(100, goalMin ? Math.round((todayMin / goalMin) * 100) : 0);
  const R = 34, CIRC = 2 * Math.PI * R;
  const metrics = [
    { label: 'Known words', value: counts.known, sub: `+${totals.learnedToday} today`, icon: '📖' },
    { label: 'Learning', value: counts.learning, sub: `L1 ${counts.l1} · L2 ${counts.l2} · L3 ${counts.l3} · L4 ${counts.l4}`, icon: '🎯' },
    { label: 'Reading today', value: `${todayMin} min`, sub: `Goal: ${goalMin} min`, icon: '⏱️' },
    { label: 'Streak', value: `${totals.streak} days`, sub: totals.streak ? 'Keep it going' : 'Start reading!', icon: '🔥' },
  ];
  const maxDay = Math.max(1, ...days.slice(-7).map(d => d.knownMarked));
  void R; void CIRC; void metrics; void goalPct;
  return <div className="lf-fade">
    <h2 className="v-title">{greeting}</h2>
    <p className="v-sub text-zinc-500 mt-2">Keep your {langInfo(lang).name} journey going — {APP_SUBTITLE_JA} · {counts.total} words tracked · unlimited</p>
    <div className="grid grid-cols-2 xl:grid-cols-4 mt-8 border-y v-hair py-5">
      <div><div className="v-statnum">{counts.known}</div><div className="v-statlabel">Known words</div><p className="text-xs text-[#a9714b] mt-1">+{totals.learnedToday} today</p></div>
      <div className="border-l v-hair pl-5"><div className="v-statnum">{counts.learning}</div><div className="v-statlabel">Learning</div><p className="text-xs text-zinc-400 mt-1">L1 {counts.l1} · L2 {counts.l2} · L3 {counts.l3} · L4 {counts.l4}</p></div>
      <div className="border-l v-hair pl-5"><div className="v-statnum">{todayMin} min</div><div className="v-statlabel">Reading today</div><p className="text-xs text-zinc-400 mt-1">goal {goalMin} min</p></div>
      <div className="border-l v-hair pl-5"><div className="v-statnum">{totals.streak} days</div><div className="v-statlabel">Streak</div><p className="text-xs text-zinc-400 mt-1">{totals.streak ? 'Keep it going' : 'Start reading'}</p></div>
    </div>
    <div className="grid lg:grid-cols-5 gap-8 mt-8">
      <div className="lg:col-span-3">
        <p className="v-kicker">Continue reading ———</p>
        {books.length ? <><button onClick={() => go('books')} className="mt-4 grid sm:grid-cols-2 gap-5 text-left group w-full"><img src="/images/palace.jpg" alt="" className="w-full h-44 object-cover" /><span><span className="block lf-serif text-2xl font-semibold group-hover:underline">{books[0].title}</span><span className="block text-xs tracking-[.14em] uppercase text-zinc-400 mt-2">{books[0].format} · resume where you left off</span><span className="mt-4 block h-px bg-[#ddd0b8] dark:bg-[#57503f]"><span className="block h-[2px] -mt-px bg-[#a9714b]" style={{ width: `${Math.round(books[0].progress * 100)}%` }} /></span><span className="block text-xs text-zinc-400 mt-2">{Math.round(books[0].progress * 100)}% read</span><span className="block v-kicker mt-4">Continue reading →</span></span></button>
        <p className="v-kicker mt-10">Recent articles ———</p>
        {books.slice(1).map(b => <button key={b.id} onClick={() => go('books')} className="flex w-full items-center gap-4 py-3 border-b v-hair text-left group"><img src="/images/reading-desk.jpg" alt="" className="h-14 w-20 object-cover shrink-0" /><span className="flex-1 min-w-0"><span className="block lf-serif text-lg truncate group-hover:underline">{b.title}</span><span className="block text-[11px] tracking-[.14em] uppercase text-zinc-400">{b.format} · {Math.round(b.progress * 100)}%</span></span></button>)}
        {!books.slice(1).length && <p className="text-sm text-zinc-400 mt-3">Open an article in Reading or import a book — it will appear here.</p>}</>
        : <div className="mt-4"><img src="/images/palace.jpg" alt="" className="w-full h-44 object-cover" /><p className="lf-serif text-xl mt-4">Nothing in progress yet</p><p className="text-sm text-zinc-400 mt-1">Open an article in Reading or import a book — it will appear here.</p><Button className="mt-3" onClick={() => go('reading')}>Start reading</Button></div>}
      </div>
      <div className="lg:col-span-2">
        <img src="/images/temple-mist.jpg" alt="Morning mist over temple roofs" className="w-full h-52 object-cover" />
        <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">Morning mist over the temple roofs — Kyoto</p>
        <p className="v-kicker mt-8">Recent discoveries ———</p>
        <div>{recent.slice(0, 5).map(r => <button key={r.id} onClick={() => onWord(r.word)} className="flex w-full items-baseline gap-3 py-2.5 border-b v-hair text-left group"><span className="lf-serif text-xl font-semibold group-hover:underline">{r.word}</span><span className="text-xs text-zinc-400">seen {r.encounters}×</span><span className="ml-auto text-xs" style={{ color: '#a9714b' }}>{STATUS_LABEL[r.status]}</span></button>)}{!recent.length && <p className="text-sm text-zinc-400 mt-3">Browse with highlighting on — words will appear here.</p>}</div>
        <div className="flex items-center justify-between mt-8"><p className="v-kicker">Learning activity</p><span className="text-[10px] tracking-[.18em] uppercase text-zinc-400">Words per day</span></div>
        <div className="flex items-end gap-2 h-24 mt-3 border-b v-hair pb-1">{days.slice(-7).map((d, i) => <div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full" style={{ height: `${Math.max(4, (d.knownMarked / maxDay) * 76)}px`, background: i === days.slice(-7).length - 1 ? '#a9714b' : '#a79c8a' }} /><span className="text-[9px] text-zinc-400">{'MTWTFSS'[new Date(d.date).getDay() ? (new Date(d.date).getDay() + 6) % 7 : 6]}</span></div>)}</div>
        <div className="flex items-center justify-between mt-4 text-sm"><span>Daily goal · {todayMin} / {goalMin} min</span><button className="v-kicker" onClick={() => { const next = goalMin >= 60 ? 10 : goalMin + 10; setGoalMin(next); localStorage.setItem('lf:daily-goal', String(next)); }}>{goalMin} min ✎</button></div>
        <div className="h-[2px] bg-[#ddd0b8] dark:bg-[#57503f] mt-2"><div className="h-full bg-[#a9714b]" style={{ width: `${goalPct}%` }} /></div>
        <p className="text-[11px] text-zinc-400 mt-2">Listening {Math.round(totals.listeningSec / 60)} min total · new today +{totals.newToday}</p>
      </div>
    </div>
  </div>;
}

function ReadingPage({ settings, setSettings, initialUrl, onWord, refreshKey }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void>; initialUrl: string; onWord: (w: string) => void; refreshKey: number }) {
  const [url, setUrl] = useState(initialUrl);
  const [article, setArticle] = useState<{ title: string; text: string; url: string } | null>(null);
  const [sample, setSample] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; title: string; url: string; text: string; openedAt: number }>>([]);
  const [panelWord, setPanelWord] = useState<string | null>(null);
  const [sentence, setSentence] = useState('');
  const [sentenceTr, setSentenceTr] = useState('');
  const [note, setNote] = useState('');
  const [savedSentences, setSavedSentences] = useState<string[]>(() => JSON.parse(localStorage.getItem('lf:saved-sentences') ?? '[]') as string[]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [showHl, setShowHl] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [sessionGraded, setSessionGraded] = useState<string[]>([]);
  const [entry, setEntry] = useState<DictEntry | undefined>();
  const [rec, setRec] = useState<VocabRecord | undefined>();
  const textRef = useRef<HTMLDivElement>(null);
  const lang = settings.learningLang;
  const loadHistory = useCallback(async () => { const h = await idb.get<{ key: string; value: never[] }>('meta', 'readingHistory').catch(() => undefined); setHistory((h?.value as never) ?? []); }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => { if (initialUrl) void load(initialUrl); }, [initialUrl]); // eslint-disable-line
  async function saveHistory(a: { title: string; text: string; url: string }) {
    const item = { id: a.url || 'paste-' + Date.now(), title: a.title, url: a.url, text: a.text.slice(0, 20000), openedAt: Date.now() };
    const next = [item, ...history.filter(h => h.id !== item.id)].slice(0, 20);
    setHistory(next); await idb.put('meta', { key: 'readingHistory', value: next });
  }
  async function load(u: string) { setError(''); try { const a = await fetchArticle(u); const art = { title: a.title, text: a.text, url: u }; setArticle(art); setSample(''); setProgress(0); setBookmarks([]); void saveHistory(art); } catch (e) { setError('Could not extract this article (CORS, login wall or offline). Nothing was faked — paste the text below instead. ' + String(e)); } }
  const activeText = article?.text || sample;
  const paragraphs = useMemo(() => activeText ? activeText.split(/\n{2,}|\n/).map(s => s.trim()).filter(Boolean) : [], [activeText]);
  const guess = useMemo(() => activeText ? classifyText(activeText.slice(0, 1200)) : null, [activeText]);
  const mismatch = !!guess && guess.lang !== 'unknown' && guess.lang !== lang;
  const counts = useMemo(() => { if (!activeText) return null; const toks = segmentText(activeText, lang).filter(t => t.isWord); return { total: toks.length, unique: new Set(toks.map(t => t.text.toLowerCase())).size }; }, [activeText, lang]);
  useEffect(() => { if (panelWord) { void DictionaryService.lookup(lang, panelWord).then(setEntry); void VocabularyService.get(lang, panelWord).then(setRec); } }, [panelWord, lang, refreshKey]);
  useEffect(() => {
    if (!activeText) return; const timer = new ReadingTimer(lang, () => !!textRef.current);
    timer.start(); return () => timer.stop();
  }, [activeText, lang]);
  const grade = async (s: WordStatus) => { if (!panelWord) return; await VocabularyService.setStatus(lang, panelWord, s); if (s === 'known') await ReadingStatisticsService.bump(lang, { knownMarked: 1 }); setSessionGraded(g => [...new Set([...g, panelWord])]); setRec(await VocabularyService.get(lang, panelWord)); onWord(panelWord); };
  const sentencesOf = (p: string) => p.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  if (!activeText) return <div className="lf-fade">
    <h2 className="v-title">Reading</h2>
    <p className="text-sm text-zinc-500 mt-1">Your immersive reading library. Only text in {langInfo(lang).name} is highlighted — other languages are left untouched.</p>
    <div className="border border-[#ddd0b8] dark:border-[#57503f] bg-[#fbf6ea]/60 dark:bg-white/[.03] p-4 mt-4">
      <div className="flex gap-2"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste an article URL…" /><Button onClick={() => void load(url)}>Open article</Button></div>
      {error && <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">{error}</p>}
      <textarea value={sample} onChange={e => setSample(e.target.value)} placeholder={"…or paste any text here. Example:\n\n我今天想学习中文。"} className="w-full mt-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-transparent p-3 text-sm" rows={4} />
      {sample.trim() && <Button className="mt-2" onClick={() => { const a = { title: 'Pasted text', text: sample, url: '' }; void saveHistory(a); }}>Read pasted text</Button>}
    </div>
    <h3 className="font-semibold mt-5 mb-2">Continue reading</h3>
    {history.length ? <div className="grid md:grid-cols-2 gap-3">{history.map(h => <button key={h.id} onClick={() => { setArticle({ title: h.title, text: h.text, url: h.url }); setSample(''); }} className="border border-[#ddd0b8] dark:border-[#57503f] bg-[#fbf6ea]/60 dark:bg-white/[.03] p-4 text-left hover:shadow-md transition"><span className="block font-medium line-clamp-1">{h.title}</span><span className="block text-xs text-zinc-400 mt-1">{h.url ? new URL(h.url).hostname : 'Pasted text'} · {new Date(h.openedAt).toLocaleDateString()} · ~{Math.max(1, Math.round(h.text.split(/\s+/).length / 200))} min</span><span className="mt-2 block h-1.5 rounded bg-stone-100 dark:bg-zinc-800"><span className="block h-full w-1/3 rounded bg-[#a9714b]" /></span></button>)}</div>
    : <p className="text-sm text-zinc-400">No articles yet. Open a URL above — your history will live here, stored only on this device.</p>}
    {!!savedSentences.length && <><h3 className="font-semibold mt-5 mb-2">Saved sentences</h3><div className="space-y-2">{savedSentences.map((s, i) => <div key={i} className="border border-[#ddd0b8] dark:border-[#57503f] bg-[#fbf6ea]/60 dark:bg-white/[.03] px-3 py-2 text-sm flex gap-2"><span className="flex-1">{s}</span><Button variant="ghost" onClick={() => void AudioService.speakSentence(s, lang)}>🔊</Button></div>)}</div></>}
  </div>;
  return <div className="lf-fade -m-2 md:-m-4">
    <div className="sticky top-0 z-20 flex items-center gap-1.5 border-b v-hair visus-paper px-1 py-3">
      <Button variant="ghost" onClick={() => { setArticle(null); setSample(''); void loadHistory(); }}>← Reading</Button>
      <span className="font-medium truncate flex-1 text-sm">{article?.title ?? 'Pasted text'}</span>
      <button aria-label="Font smaller" className="rounded-lg px-2 py-1 hover:bg-stone-100 dark:hover:bg-zinc-800 text-sm" onClick={() => void setSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}>A−</button>
      <button aria-label="Font larger" className="rounded-lg px-2 py-1 hover:bg-stone-100 dark:hover:bg-zinc-800 text-sm" onClick={() => void setSettings({ fontSize: Math.min(26, settings.fontSize + 1) })}>A+</button>
      <button aria-label="Listen" className="rounded-lg px-2 py-1 hover:bg-stone-100 dark:hover:bg-zinc-800" onClick={() => void AudioService.speakSentence(activeText.slice(0, 600), lang)}>🔊</button>
      <button aria-label="Toggle highlights" className={`rounded-lg px-2 py-1 text-sm ${showHl ? 'bg-orange-100 dark:bg-orange-950' : ''}`} onClick={() => setShowHl(!showHl)}>abc</button>
      <button aria-label="Focus mode" className="rounded-lg px-2 py-1 text-sm" onClick={() => setFocusMode(!focusMode)}>◎ Focus</button>
      <button aria-label="Fullscreen" className="rounded-lg px-2 py-1 text-sm" onClick={() => void textRef.current?.requestFullscreen().catch(() => undefined)}>⛶</button>
      <span className="text-xs text-zinc-400">{progress}%</span>
    </div>
    {mismatch && <p className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">Language notice: this article looks like <b>{String(guess?.lang)}</b>, but you are learning <b>{langInfo(lang).name}</b>. Non-matching text is not highlighted. Change language in the sidebar if this is intentional.</p>}
    <div className={`grid gap-3 mt-3 ${focusMode ? '' : 'xl:grid-cols-[220px_minmax(0,1fr)_320px]'}`}>
      {!focusMode && <aside className="hidden xl:block"><div className="sticky top-16 border-r v-hair pr-4 py-1">
        <p className="v-kicker">Outline ———</p>
        {paragraphs.filter(p => p.length < 90).slice(0, 10).map((p, i) => <a key={i} href={`#lf-p-${paragraphs.indexOf(p)}`} className="block py-1 text-[13px] text-zinc-600 dark:text-zinc-300 hover:underline truncate">{paragraphs.indexOf(p) + 1}. {p}</a>)}
        {!paragraphs.some(p => p.length < 90) && <p className="text-xs text-zinc-400 py-1">No headings detected.</p>}
        <p className="text-xs font-semibold text-zinc-400 mt-3">BOOKMARKS {bookmarks.length ? `(${bookmarks.length})` : ''}</p>
        {bookmarks.map(b => <a key={b} href={`#lf-p-${b}`} className="block py-0.5 text-[13px] hover:underline">Paragraph {b + 1}</a>)}
        <p className="text-xs font-semibold text-zinc-400 mt-3">SAVED THIS SESSION</p>
        {sessionGraded.map(w => <button key={w} onClick={() => setPanelWord(w)} className="block py-0.5 text-[13px] hover:underline">{w}</button>)}{!sessionGraded.length && <p className="text-xs text-zinc-400">Grade words to list them here.</p>}
        <p className="v-kicker mt-6">Reading progress</p><p className="lf-serif text-4xl mt-1">{progress}%</p><div className="mt-2 h-[2px] bg-[#ddd0b8] dark:bg-[#57503f]"><div className="h-full bg-[#a9714b]" style={{ width: `${progress}%` }} /></div>
      </div></aside>}
      <main ref={textRef} onScroll={e => { const el = e.currentTarget; setProgress(Math.round((el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)) * 100)); }} className="px-2 md:px-6 py-2 max-h-[calc(100vh-120px)] overflow-y-auto">
        <p className="v-kicker">Feature essay · {article?.url ? new URL(article.url).hostname : 'Pasted text'}</p>
        <h1 className="lf-serif text-[40px] leading-tight font-semibold mt-2">{article?.title ?? 'Pasted text'}</h1>
        <p className="text-[11px] tracking-[.16em] uppercase text-zinc-400 mt-2">{counts?.total ?? 0} words · ~{Math.max(1, Math.round((counts?.total ?? 0) / 200))} min · {langInfo(lang).name}</p>
        <img src="/images/palace.jpg" alt="" className="w-full h-56 object-cover mt-5" />
        <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">Every word opens a new world</p>
        <div className={`mt-4 ${showHl ? '' : 'lf-nohl'}`} style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, maxWidth: settings.readingWidth }}>
          {paragraphs.map((p, i) => <div key={i} id={`lf-p-${i}`} className="group relative mb-4">
            <button aria-label="Bookmark paragraph" className="absolute -left-6 top-1 opacity-0 group-hover:opacity-60 text-xs" onClick={() => setBookmarks(b => [...new Set([...b, i])])}>🔖</button>
            <div onClick={e => { if (!(e.target as HTMLElement).closest('.lf-w')) setSentence(sentencesOf(p)[0] ?? p); }} className="cursor-text rounded-lg hover:bg-orange-50/50 dark:hover:bg-zinc-800/40 px-1 -mx-1">
              <HighlightedText text={p} lang={lang} onWord={setPanelWord} refreshKey={refreshKey} /></div>
          </div>)}
        </div>
      </main>
      {!focusMode && <aside className="hidden xl:block"><div className="sticky top-16 space-y-3">
        <div className="border-l v-hair pl-5 py-1">
          {panelWord ? <><div className="flex items-start justify-between"><div><h3 className="lf-serif text-4xl font-semibold">{panelWord}</h3>
            <p className="text-sm text-zinc-400">{lang === 'zh' || lang === 'yue' ? `${entry?.phonetic ?? ''} · 繁體 ${toTraditional(panelWord)}` : entry?.phonetic ?? ''}</p></div>
            <button aria-label="Pronounce" onClick={() => void AudioService.speakWord(panelWord, lang)} className="rounded-full bg-orange-50 dark:bg-orange-950 p-2">🔊</button></div>
            <p className="text-xs text-zinc-400 mt-1">{entry?.pos ?? ''} · {rec?.status ? STATUS_LABEL[rec.status] : 'New'} · seen {rec?.encounters ?? 1}×{entry ? ` · frequency #${entry.frequency}` : ''}</p>
            <p className="text-sm mt-2">{rec?.customDefinition ?? entry?.definition ?? 'No local dictionary entry. Add your own definition in Vocabulary, import a dictionary, or enable translation in Settings.'}</p>
            {entry && <><p className="text-sm text-zinc-500 mt-1">{entry.translation !== entry.word ? `Translation: ${entry.translation}` : `English: ${entry.definition}`}</p><p className="text-sm italic text-zinc-500 mt-1">{entry.examples[0]}</p>
            <Button variant="ghost" className="mt-1 !px-1" onClick={() => void AudioService.speakSentence(entry.examples[0] ?? panelWord, lang)}>▶ Listen to example</Button></>}
            <p className="v-kicker mt-5">Learning level</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button onClick={() => void grade('new')} className="v-levelbtn" data-on={rec?.status === 'new'}>0</button>
              {(['l1', 'l2', 'l3', 'l4'] as WordStatus[]).map((s, i) => <button key={s} onClick={() => void grade(s)} className="v-levelbtn" data-on={rec?.status === s}>{i + 1}</button>)}
              <button onClick={() => void grade('known')} aria-label="Known" className="v-levelbtn" data-on={rec?.status === 'known'}>✓✓</button>
              <button onClick={() => void grade('ignored')} aria-label="Ignore" className="v-levelbtn" data-on={rec?.status === 'ignored'}>✕</button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">Saved instantly to IndexedDB and synced to every open page.</p></>
          : <><h3 className="font-semibold text-sm">Vocabulary</h3><p className="text-sm text-zinc-400 mt-1">Click any highlighted word to see its definition, pronunciation and level here.</p></>}
        </div>
        {sentence && <div className="rounded-[2px] border border-orange-200/70 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 p-4 lf-fade">
          <p className="text-xs font-semibold text-zinc-400">SENTENCE</p><p className="text-sm mt-1">{sentence}</p>
          {sentenceTr && <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{sentenceTr}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button variant="soft" onClick={() => void AudioService.speakSentence(sentence, lang)}>🔊 Listen</Button>
            <Button variant="soft" onClick={() => void import('../services/translation').then(m => m.TranslationService.translate(sentence, lang, settings.nativeLang)).then(t => setSentenceTr(t ?? 'Translation is off — enable it in Settings → Privacy.'))}>Translate</Button>
            <Button variant="soft" onClick={() => { const next = [...new Set([...savedSentences, sentence])]; setSavedSentences(next); localStorage.setItem('lf:saved-sentences', JSON.stringify(next)); }}>Save</Button>
          </div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" className="mt-2" />
          {note && <Button variant="ghost" className="mt-1 !px-1" onClick={() => { const key = 'lf:sentence-notes'; const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, string>; all[sentence] = note; localStorage.setItem(key, JSON.stringify(all)); setNote(''); }}>Save note</Button>}
        </div>}
        <div className="border-l v-hair pl-5 py-1 text-sm">
          <h3 className="v-kicker mb-3">This article</h3>
          <p className="text-zinc-500 text-[13px]">{counts?.total ?? 0} words · {counts?.unique ?? 0} unique · {sessionGraded.length} graded this session</p>
          <details className="mt-2"><summary className="cursor-pointer text-[13px] font-medium">Reading settings</summary>
            <Label>Line height: {settings.lineHeight}</Label><input type="range" min={1.3} max={2.2} step={0.1} value={settings.lineHeight} onChange={e => void setSettings({ lineHeight: +e.target.value })} className="w-full" />
            <Label>Width: {settings.readingWidth}px</Label><input type="range" min={520} max={900} step={20} value={settings.readingWidth} onChange={e => void setSettings({ readingWidth: +e.target.value })} className="w-full" /></details>
        </div>
      </div></aside>}
    </div>
  </div>;
}

function BooksPage({ settings, onWord, refreshKey }: { settings: Settings; onWord: (w: string) => void; refreshKey: number }) {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Array<{ title: string; text: string }>>([]);
  const [chapter, setChapter] = useState(0);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [ocrMsg, setOcrMsg] = useState('');
  const [bookView, setBookView] = useState<'grid'|'list'>('grid');
  const lang = settings.learningLang;
  const refresh = useCallback(() => void BookReaderService.list().then(setBooks), []);
  useEffect(refresh, [refresh]);
  async function openBook(b: BookRecord) {
    const buf = await BookReaderService.data(b.id); if (!buf) return; setOpenId(b.id); setNote('');
    if (b.format === 'epub') { const parsed = await parseEpub(buf); setChapters(parsed.chapters.map(c => ({ title: c.title, text: new DOMParser().parseFromString(c.html, 'text/html').body?.textContent ?? '' }))); setChapter(b.chapter); }
    else if (b.format === 'cbz') { const pages = await listCbzPages(buf); setChapters(pages.map((p, i) => ({ title: `Page ${i + 1}`, text: p }))); setChapter(b.chapter); }
    else if (b.format === 'txt') { setChapters([{ title: b.title, text: new TextDecoder().decode(buf) }]); setChapter(0); }
    else {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const pages: Array<{ title: string; text: string }> = [];
      for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const tc = await page.getTextContent(); pages.push({ title: `Page ${i}`, text: tc.items.map((it) => ('str' in it ? it.str : '')).join(' ') }); }
      setChapters(pages); setChapter(b.chapter);
      if (pages.every(p => !p.text.trim())) setOcrMsg('This looks like a scanned PDF with no text layer. OCR uses this browser\u2019s built-in offline text detection where available.');
    }
    await BookReaderService.update(b.id, { lastReadAt: Date.now() });
  }
  const current = chapters[chapter];
  const progress = chapters.length ? (chapter + 1) / chapters.length : 0;
  const COVERS = ['#8a6a52', '#5f6d5a', '#a39a8b', '#4a4238', '#7a4a3a', '#0f4c5c'];
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="v-title">Library</h2>
    <p className="v-sub text-zinc-500 mt-2">Books, PDFs and saved texts — kept local, always yours.</p></div>
    <span className="flex border v-hair overflow-hidden">{(['grid', 'list'] as const).map(v => <button key={v} onClick={() => setBookView(v)} className={`px-3 py-1.5 text-[11px] tracking-[.14em] uppercase ${bookView === v ? 'bg-[#a9714b] text-[#fff7ea]' : ''}`}>{v}</button>)}</span></div>
    <div className="flex flex-wrap items-center justify-between border-y v-hair mt-6 py-3 text-[11px] tracking-[.18em] uppercase text-zinc-400"><span>Books · Articles · PDFs · Saved texts</span><label className="text-[#a9714b] cursor-pointer">Import EPUB · PDF · TXT · CBZ +<input type="file" accept=".epub,.pdf,.txt,.cbz" multiple className="hidden" onChange={e => { void Promise.all([...(e.target.files ?? [])].map(f => BookReaderService.add(f, lang))).then(refresh); }} /></label></div>
    <img src="/images/reading-desk.jpg" alt="The reading desk — still life" className="w-full h-48 object-cover mt-6" />
    <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">The reading desk — Still life</p>
    <p className="v-kicker mt-8">The shelf ———</p>
    <div className="grid md:grid-cols-3 gap-6 mt-4">
      <div className={bookView === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>{books.map((b, bi) => <div key={b.id}><button onClick={() => void openBook(b)} className="block w-full text-left text-[#f4ecdb] p-4 h-44 flex flex-col shadow-[inset_6px_0_0_rgba(0,0,0,.18)]" style={{ background: COVERS[bi % COVERS.length] }}><span className="lf-serif text-2xl leading-tight">{b.title.slice(0, 14)}</span><span className="mt-auto text-[10px] tracking-[.22em] uppercase opacity-80">{b.format}</span></button>
        <button className="lf-serif text-lg text-left leading-snug mt-2 hover:underline" onClick={() => void openBook(b)}>{b.title}</button>
        <p className="text-[11px] tracking-[.1em] uppercase text-zinc-400">{Math.round(b.progress * 100)}% · {Math.round(b.size / 1024)} KB · 🔖 {b.bookmarkCount}</p>
        <div className="h-[2px] bg-[#ddd0b8] dark:bg-[#57503f] mt-1.5"><div className="h-full bg-[#a9714b]" style={{ width: `${Math.round(b.progress * 100)}%` }} /></div>
        <div className="flex gap-1 mt-1"><Button variant="ghost" onClick={() => void BookReaderService.setBookmark(b.id, 1).then(refresh)}>+ Bookmark</Button><Button variant="ghost" onClick={() => { if (confirm('Delete this book?')) void BookReaderService.remove(b.id).then(refresh); }}>Delete</Button></div></div>)}
        {!books.length && <p className="text-sm text-zinc-400">Your VISUS library is empty. Import a book to start seeing words here.</p>}</div>
      <div className="md:col-span-2">
        {current ? <Card>
          <div className="flex flex-wrap items-center gap-2 justify-between"><h3 className="font-semibold">{current.title}</h3>
            <span className="text-xs text-zinc-400">{chapter + 1}/{chapters.length} · {Math.round(progress * 100)}%</span></div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded mt-2"><div className="h-full bg-[#a9714b] rounded" style={{ width: `${progress * 100}%` }} /></div>
          <div className="flex gap-2 mt-2"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search in book…" />
            <Button variant="soft" onClick={() => { const i = current.text.toLowerCase().indexOf(query.toLowerCase()); setNote(query && i >= 0 ? `Found at character ${i}: “…${current.text.slice(Math.max(0, i - 40), i + query.length + 40)}…”` : 'Not found in this chapter/page.'); }}>Search</Button>
            <Button variant="ghost" onClick={() => void BookReaderService.setBookmark(openId!, 1).then(refresh)}>🔖 Bookmark</Button></div>
          {note && <p className="text-xs text-zinc-500 mt-1">{note}</p>}{ocrMsg && <p className="text-xs text-amber-600 mt-1">{ocrMsg} <Button variant="soft" onClick={() => void ocrPdfPage(document.createElement('canvas')).catch(e => setOcrMsg(String(e)))}>Try OCR</Button></p>}
          <details className="mt-2"><summary className="text-sm cursor-pointer">Table of contents</summary>{chapters.map((c, i) => <button key={i} onClick={() => setChapter(i)} className={`block text-sm py-0.5 ${i === chapter ? 'font-bold' : 'text-zinc-500'}`}>{i + 1}. {c.title}</button>)}</details>
          <div className="mt-3" style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}><HighlightedText text={current.text} lang={lang} onWord={onWord} refreshKey={refreshKey} /></div>
          <div className="flex justify-between mt-3"><Button variant="soft" disabled={chapter === 0} onClick={() => { setChapter(chapter - 1); if (openId) void BookReaderService.update(openId, { chapter: chapter - 1, progress }); }}>← Previous</Button>
            <Button variant="soft" disabled={chapter >= chapters.length - 1} onClick={() => { setChapter(chapter + 1); if (openId) void BookReaderService.update(openId, { chapter: chapter + 1, progress }); }}>Next →</Button></div>
        </Card> : <Card><p className="text-sm text-zinc-400">Select a book to read with vocabulary highlighting, search, bookmarks and progress.</p></Card>}
      </div>
    </div>
  </div>;
}

function VideosPage({ settings, setSettings }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void> }) {
  const [totals, setTotals] = useState({ listeningSec: 0 });
  useEffect(() => { void ReadingStatisticsService.totals(settings.learningLang).then(t => setTotals({ listeningSec: t.listeningSec })); }, [settings.learningLang]);
  return <div><p className="v-kicker">← Videos — Cinema</p><h2 className="v-title mt-2">Videos</h2>
    <p className="v-sub text-zinc-500 mt-2">YouTube subtitle learning is active on youtube.com when captions are available. Listening time so far: <b>{Math.round(totals.listeningSec / 60)} min</b> (counted only while playing and visible).</p>
    <img src="/images/paris-cafe.jpg" alt="A café terrace at dusk" className="w-full h-64 object-cover mt-6" />
    <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">Subtitles, in the moment — words highlighted as they are spoken</p>
    <div className="grid md:grid-cols-2 gap-3 mt-3">
      <Card><h3 className="v-kicker mb-3">Subtitle preferences</h3>
        <Toggle checked={settings.subtitleAutoPause} onChange={v => void setSettings({ subtitleAutoPause: v })} label="Auto-pause after each line (Q)" />
        <Toggle checked={settings.subtitleShowTranslation} onChange={v => void setSettings({ subtitleShowTranslation: v })} label="Show translation (needs translation enabled)" />
        <Toggle checked={settings.subtitleBlur} onChange={v => void setSettings({ subtitleBlur: v })} label="Blur subtitles until hover" />
        <Label>Subtitle size: {settings.subtitleFontSize}px</Label><input type="range" min={14} max={34} value={settings.subtitleFontSize} onChange={e => void setSettings({ subtitleFontSize: +e.target.value })} className="w-full" />
        <Label>Sync offset: {settings.syncOffsetMs} ms</Label><input type="range" min={-2000} max={2000} step={100} value={settings.syncOffsetMs} onChange={e => void setSettings({ syncOffsetMs: +e.target.value })} className="w-full" />
      </Card>
      <Card><h3 className="v-kicker mb-3">On YouTube</h3>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>Words in subtitles are highlighted and clickable — grade without pausing playback manually.</li>
          <li><b>A</b> previous line · <b>S</b> replay · <b>D</b> next line · <b>Q</b> auto-pause · <b>E</b> reveal/blur · <b>C</b> subtitles on/off · <b>W</b> open vocabulary.</li>
          <li>Works fullscreen (overlay lives inside the player). Preferences are remembered.</li>
          <li>Netflix / Disney+ / Crunchyroll / Bilibili / Twitch / Viki: VISUS reads WebVTT/SRT and HTML5 text tracks the page itself exposes; where a platform exposes no accessible subtitles, VISUS states the limitation instead of bypassing DRM.</li>
          <li>Chatbot sites (ChatGPT, Claude, Gemini) are highlighted incrementally as answers stream — input fields are never touched.</li>
        </ul>
        <Button className="mt-3" onClick={() => window.open('https://www.youtube.com', '_blank')}>Open YouTube</Button>
      </Card>
    </div></div>;
}

function SrsDefinition({ word, lang }: { word: string; lang: LangCode }) { const [e, setE] = useState<DictEntry | undefined>(); useEffect(() => { void DictionaryService.lookup(lang, word).then(setE); }, [word, lang]); return <span className="text-sm">{e ? e.definition : 'No local entry — grade from memory or open the word.'}</span>; }

function DiscoverPage({ settings, go }: { settings: Settings; go: (p: Page) => void }) {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; title: string; url: string; text: string; openedAt: number }>>([]);
  useEffect(() => { void BookReaderService.list().then(setBooks); void idb.get<{ key: string; value: never[] }>('meta', 'readingHistory').then(h => setHistory((h?.value as never) ?? [])).catch(() => undefined); }, []);
  const lang = settings.learningLang;
  return <div className="lf-fade"><h2 className="v-title">Discover</h2>
    <p className="v-sub text-zinc-500 mt-2">Editorial reading in {langInfo(lang).name}, matched to your level and curiosity.</p>
    <div className="flex flex-wrap gap-x-8 gap-y-1 mt-6 text-[11px] tracking-[.2em] uppercase text-zinc-400 border-b v-hair pb-4"><span className="text-[#a9714b]">{langInfo(lang).native} {langInfo(lang).name}</span><span>From your library &amp; reading history</span><span>Kept local</span></div>
    <div className="grid lg:grid-cols-5 gap-10 mt-8">
      <div className="lg:col-span-3"><p className="v-kicker">Editor&apos;s choice ———</p>
        <img src="/images/tea-fields.jpg" alt="Tea fields at first light" className="w-full h-72 object-cover mt-4" />
        <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">Tea fields at first light</p>
        {history[0] || books[0] ? <><p className="lf-serif text-3xl font-semibold mt-5">{history[0]?.title ?? books[0].title}</p>
          <p className="v-sub text-zinc-500 mt-2 leading-relaxed">{history[0] ? history[0].text.slice(0, 180) + '…' : 'Continue this book from your shelf — every word you grade is remembered across articles, books and subtitles.'}</p>
          <button className="v-kicker mt-5" onClick={() => go(history[0] ? 'reading' : 'books')}>{history[0] ? 'Open in Reading →' : 'Open in Library →'}</button></>
        : <><p className="lf-serif text-2xl mt-5">Nothing to discover yet</p><p className="text-sm text-zinc-400 mt-1">Open an article in Reading or import a book — your reading will gather here. VISUS suggests only from what is already on this device; nothing is fetched or invented.</p><Button className="mt-4" onClick={() => go('reading')}>Start reading</Button></>}
      </div>
      <div className="lg:col-span-2"><p className="v-kicker">Further reading ———</p>
        {history.slice(1, 5).map(h => <button key={h.id} onClick={() => go('reading')} className="block w-full text-left py-4 border-b v-hair group"><span className="block lf-serif text-xl group-hover:underline">{h.title}</span><span className="block text-[11px] tracking-[.16em] uppercase text-zinc-400 mt-1">{h.url ? new URL(h.url).hostname : 'Pasted text'} · {new Date(h.openedAt).toLocaleDateString()}</span></button>)}
        {books.slice(0, 3).map(b => <button key={b.id} onClick={() => go('books')} className="block w-full text-left py-4 border-b v-hair group"><span className="block lf-serif text-xl group-hover:underline">{b.title}</span><span className="block text-[11px] tracking-[.16em] uppercase text-zinc-400 mt-1">{b.format} · {Math.round(b.progress * 100)}% read</span></button>)}
        {!history.slice(1).length && !books.length && <p className="text-sm text-zinc-400 mt-4">Your articles and books will be listed here.</p>}
      </div>
    </div></div>;
}

function ReviewPage({ settings }: { settings: Settings }) {
  const [rows, setRows] = useState<VocabRecord[]>([]);
  const [idx, setIdx] = useState(0); const [reveal, setReveal] = useState(false);
  const lang = settings.learningLang;
  const refresh = useCallback(() => void VocabularyService.all(lang).then(setRows), [lang]);
  useEffect(refresh, [refresh]);
  const due = useMemo(() => rows.filter(r => (r.status.startsWith('l') || r.status === 'new') && isDue(r.reviewDue)).sort((a, b) => (a.reviewDue ?? 0) - (b.reviewDue ?? 0)), [rows]);
  const srs = due[Math.min(idx, Math.max(0, due.length - 1))];
  return <div className="lf-fade"><h2 className="v-title">Review</h2>
    <p className="v-sub text-zinc-500 mt-2">Spaced repetition — {due.length} words are due, oldest first.</p>
    <div className="grid grid-cols-3 max-w-xl mt-8 border-y v-hair py-5">
      <div><div className="v-statnum text-[#a9714b]">{due.length}</div><div className="v-statlabel">Due today</div></div>
      <div className="border-l v-hair pl-5"><div className="v-statnum">{rows.filter(r => r.status === 'known').length}</div><div className="v-statlabel">Known</div></div>
      <div className="border-l v-hair pl-5"><div className="v-statnum">{rows.length}</div><div className="v-statlabel">In collection</div></div>
    </div>
    {srs ? <div className="grid lg:grid-cols-5 gap-10 mt-8">
      <div className="lg:col-span-3"><p className="v-kicker">Card {Math.min(idx + 1, due.length)} of {due.length} · Definition recall</p>
        <div className="border v-hair bg-[#fffaf0] dark:bg-white/[.04] mt-4 px-8 py-14 text-center shadow-[0_2px_18px_rgba(43,37,29,.07)]">
          <p className="lf-serif font-semibold" style={{ fontSize: 'clamp(44px,7vw,72px)' }}>{srs.word}</p>
          <p className="text-sm text-zinc-400 mt-2">{STATUS_LABEL[srs.status]} · seen {srs.encounters}×</p>
          <div className="mt-6 flex justify-center gap-3"><Button variant="soft" onClick={() => void AudioService.speakWord(srs.word, lang)}>🔊 Listen</Button>
          {!reveal ? <Button onClick={() => setReveal(true)}>Reveal meaning</Button> : <SrsDefinition word={srs.word} lang={lang} />}</div>
          <p className="text-[11px] tracking-[.2em] uppercase text-zinc-400 mt-8">{reveal ? 'How well did you remember?' : 'Press reveal when ready'}</p>
        </div>
        {reveal && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">{(['new', 'l1', 'l2', 'l3', 'l4', 'known'] as WordStatus[]).map(s => <button key={s} onClick={() => void VocabularyService.setStatus(lang, srs.word, s).then(() => { setReveal(false); refresh(); })} className="v-levelbtn !w-auto" data-on={s === 'known'}>{s === 'new' ? '0 · Again' : s === 'known' ? '✓ Known' : s.toUpperCase()}</button>)}
          <Button variant="ghost" onClick={() => { setIdx(i => i + 1); setReveal(false); }}>Skip →</Button></div>}
      </div>
      <div className="lg:col-span-2"><img src="/images/dried-flowers.jpg" alt="Reviewing the old to learn the new" className="w-full h-52 object-cover" />
        <p className="text-[10px] tracking-[.2em] uppercase text-zinc-400 mt-2">Reviewing the old to learn the new</p>
        <p className="v-sub text-zinc-500 leading-relaxed mt-5">Each grade quietly reshapes when you will meet the word again. Grading here updates the word everywhere — articles, books and subtitles — instantly.</p>
      </div>
    </div> : <div className="mt-8"><img src="/images/dried-flowers.jpg" alt="" className="w-full max-w-xl h-52 object-cover" /><p className="lf-serif text-2xl mt-5">Nothing due for review</p><p className="text-sm text-zinc-400 mt-1">Browse with highlighting on and grade a few words — they will gather here for review.</p></div>}
  </div>;
}
function VocabularyPage({ settings, onWord, go }: { settings: Settings; onWord: (w: string) => void; go: (p: Page) => void }) {
  const [rows, setRows] = useState<VocabRecord[]>([]);
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<string>('all');
  const [phrase, setPhrase] = useState('');
  const [view, setView] = useState<'table'|'cards'|'list'>('table');
  const [sort, setSort] = useState<'recent'|'alpha'|'seen'>('recent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [srsIdx, setSrsIdx] = useState(0); const [srsReveal, setSrsReveal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<WordStatus>('known');
  const lang = settings.learningLang;
  const refresh = useCallback(() => void VocabularyService.all(lang).then(r => setRows([...r].sort((a, b) => a.lemma.localeCompare(b.lemma)))), [lang]);
  useEffect(refresh, [refresh]);
  const due = useMemo(() => rows.filter(r => (r.status.startsWith('l') || r.status === 'new') && isDue(r.reviewDue)).sort((a, b) => (a.reviewDue ?? 0) - (b.reviewDue ?? 0)), [rows]);
  const srs = due[Math.min(srsIdx, Math.max(0, due.length - 1))];
  const shown = rows.filter(r => (filter === 'all' || r.status === filter) && (!q || r.lemma.includes(q.toLowerCase())))
    .sort((a, b) => sort === 'alpha' ? a.lemma.localeCompare(b.lemma) : sort === 'seen' ? b.encounters - a.encounters : b.lastSeen - a.lastSeen);
  const bulk = async (fn: (r: VocabRecord) => Promise<unknown>) => { for (const r of rows.filter(x => selected.has(x.id))) await fn(r); setSelected(new Set()); refresh(); };
  void srsIdx; void setSrsIdx; void srsReveal; void setSrsReveal; void srs;
  const cnt = (s: WordStatus) => rows.filter(r => r.status === s).length;
  return <div className="lf-fade"><h2 className="v-title">Collection</h2>
    <p className="v-sub text-zinc-500 mt-2">Every word you have met in {langInfo(lang).name}, gathered in one place.</p>
    <div className="grid grid-cols-3 lg:grid-cols-6 mt-8 border-y v-hair py-5 gap-y-4">
      <div><div className="v-statnum">{rows.length}</div><div className="v-statlabel">Total</div></div>
      <div className="border-l v-hair pl-4"><div className="v-statnum">{cnt('known')}</div><div className="v-statlabel">Known</div></div>
      <div className="border-l v-hair pl-4"><div className="v-statnum text-[#a9714b]">{cnt('l1') + cnt('l2') + cnt('l3') + cnt('l4')}</div><div className="v-statlabel">Learning</div></div>
      <div className="border-l v-hair pl-4"><div className="v-statnum">{cnt('new')}</div><div className="v-statlabel">New</div></div>
      <div className="border-l v-hair pl-4"><div className="v-statnum">{cnt('ignored')}</div><div className="v-statlabel">Ignored</div></div>
      <button className="border-l v-hair pl-4 text-left" onClick={() => go('review')}><div className="v-statnum text-[#a9714b]">{due.length}</div><div className="v-statlabel">Due for review →</div></button>
    </div>
    <div className="flex flex-wrap gap-2 mt-3 items-center"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="!w-52" />
      <Select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Select value={sort} onChange={e => setSort(e.target.value as never)}><option value="recent">Recently seen</option><option value="alpha">Alphabetical</option><option value="seen">Most encountered</option></Select>
      <span className="flex border v-hair overflow-hidden">{(['table', 'cards', 'list'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-[11px] tracking-[.14em] uppercase ${view === v ? 'bg-[#a9714b] text-[#fff7ea]' : ''}`}>{v === 'cards' ? 'Flashcards' : v}</button>)}</span>
      <Input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="Add custom phrase…" className="!w-52" />
      <Button variant="soft" onClick={() => { if (phrase.trim()) void VocabularyService.addPhrase(lang, phrase.trim()).then(() => { setPhrase(''); refresh(); }); }}>Add phrase</Button>
      <Button variant="ghost" onClick={() => BackupService.download(vocabExportFilename(lang), JSON.stringify(rows, null, 2))}>Export JSON</Button>
      <Button variant="ghost" onClick={() => downloadAnkiTsv(rows, `VISUS ${lang}`)}>Export for Anki</Button>
      <Button variant="ghost" onClick={() => void sendToAnkiConnect(rows, `VISUS ${lang}`).then(r => alert(r.ok ? `Sent ${r.added} cards to Anki.` : `AnkiConnect unavailable: ${r.error ?? 'is Anki Desktop running with AnkiConnect?'}`))}>Send to Anki</Button></div>
    {selected.size > 0 && <div className="flex flex-wrap items-center gap-2 mt-2 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2 text-sm"><span>{selected.size} selected</span>
      <Select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as WordStatus)}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Button variant="soft" onClick={() => void bulk(r => VocabularyService.setStatus(lang, r.word, bulkStatus))}>Apply level</Button>
      <Button variant="danger" onClick={() => { if (confirm(`Delete ${selected.size} entries?`)) void bulk(r => VocabularyService.remove(lang, r.word)); }}>Delete</Button>
      <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button></div>}
    {view === 'cards' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{shown.slice(0, 2000).map(r => <div key={r.id} className="border border-[#ddd0b8] dark:border-[#57503f] bg-[#fbf6ea]/60 dark:bg-white/[.03] p-4"><div className="flex items-start justify-between"><button className="lf-serif text-xl font-semibold hover:underline" onClick={() => onWord(r.word)}>{r.word}</button><span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: swatch(r.status) }}>{STATUS_LABEL[r.status]}</span></div><p className="text-xs text-zinc-400 mt-1">seen {r.encounters}× · {new Date(r.lastSeen).toLocaleDateString()}{r.isPhrase ? ' · phrase' : ''}</p>{r.customDefinition && <p className="text-sm mt-1">{r.customDefinition}</p>}</div>)}{!shown.length && <p className="text-sm text-zinc-400">No words match.</p>}</div>}
    {view === 'list' && <div className="mt-3 border border-[#ddd0b8] dark:border-[#57503f] bg-[#fbf6ea]/60 dark:bg-white/[.03] divide-y divide-stone-100 dark:divide-zinc-800">{shown.slice(0, 5000).map(r => <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm"><button className="font-medium hover:underline flex-1 text-left" onClick={() => onWord(r.word)}>{r.word}</button><span className="text-xs text-zinc-400">×{r.encounters}</span><span className="rounded px-1.5 py-0.5 text-xs" style={{ background: swatch(r.status) }}>{STATUS_LABEL[r.status]}</span></div>)}</div>}
    {view === 'table' && <></>}
    <Card className={view === 'table' ? 'mt-3' : 'hidden'}><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-zinc-400"><th className="py-1">Word</th><th>Lemma</th><th>Status</th><th>Seen</th><th>Custom definition</th><th></th></tr></thead>
      <tbody>{shown.slice(0, 5000).map(r => <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800"><td className="py-1.5"><input type="checkbox" checked={selected.has(r.id)} onChange={e => setSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} className="mr-2 accent-[#a9714b]" /><button className="font-medium hover:underline" onClick={() => onWord(r.word)}>{r.word}</button>{r.isPhrase && <span className="text-zinc-400"> (phrase)</span>}</td><td>{r.lemma}</td>
        <td><span className="rounded px-1.5 py-0.5 text-xs" style={{ background: swatch(r.status) }}>{STATUS_LABEL[r.status]}</span></td><td>{r.encounters}×</td><td className="text-zinc-500">{r.customDefinition ?? ''}</td>
        <td><Select value={r.status} onChange={e => void VocabularyService.setStatus(lang, r.word, e.target.value as WordStatus).then(refresh)} className="!py-0.5">{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></td></tr>)}
      {!shown.length && <tr><td colSpan={6} className="py-3 text-zinc-400">No words match. Browse with highlighting enabled to grow this list.</td></tr>}</tbody></table></div>
      {shown.length > 400 && <p className="text-xs text-zinc-400 mt-2">Showing first 400 of {shown.length} — refine the search.</p>}</Card></div>;
}

function StatisticsPage({ settings }: { settings: Settings }) {
  const [days, setDays] = useState<Array<{ date: string; readingSec: number; listeningSec: number; knownMarked: number; newSeen: number }>>([]);
  const [totals, setTotals] = useState({ readingSec: 0, listeningSec: 0, streak: 0 });
  const [counts, setCounts] = useState({ known: 0, learning: 0, new: 0, total: 0 });
  const [books, setBooks] = useState<BookRecord[]>([]);
  const lang = settings.learningLang;
  useEffect(() => { void ReadingStatisticsService.lastDays(lang, 14).then(d => setDays(d as never)); void ReadingStatisticsService.totals(lang).then(setTotals); void VocabularyService.counts(lang).then(c => setCounts(c as never)); void BookReaderService.list().then(setBooks); }, [lang]);
  const full = counts as unknown as { l1: number; l2: number; l3: number; l4: number };
  const levels: Array<{ label: string; value: number; color: string }> = [{ label: 'New', value: counts.new, color: '#5f6d5a' }, { label: 'L1', value: full.l1 ?? 0, color: '#a79c8a' }, { label: 'L2', value: full.l2 ?? 0, color: '#a79c8a' }, { label: 'L3', value: full.l3 ?? 0, color: '#a79c8a' }, { label: 'L4', value: full.l4 ?? 0, color: '#a79c8a' }, { label: 'Known', value: counts.known, color: '#a9714b' }];
  const maxLevel = Math.max(1, ...levels.map(l => l.value));
  const week = days.slice(-7); const maxWeek = Math.max(1, ...week.map(d => Math.round((d.readingSec + d.listeningSec) / 60)));
  const nextMilestone = [100, 500, 1000, 2000, 5000].find(m => counts.known < m) ?? 0;
  let cum = 0; const growthPts = days.map((d, i) => { cum += d.knownMarked; return `${(i / Math.max(1, days.length - 1)) * 260},${64 - Math.min(56, cum * 2)}`; }).join(' ');
  return <div><div className="flex items-start justify-between"><div><h2 className="v-title">Statistics</h2><p className="v-sub text-zinc-500 mt-2">Your learning, measured quietly — built only from real activity.</p></div><span className="text-[11px] tracking-[.18em] uppercase text-zinc-400">Range · 14 days</span></div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mt-8 border-y v-hair py-5 gap-y-4">
      <Stat label="Reading · total" value={`${Math.round(totals.readingSec / 60)} min`} /><Stat label="Listening · total" value={`${Math.round(totals.listeningSec / 60)} min`} />
      <Stat label="Vocabulary" value={counts.total} sub={`${counts.known} known · ${counts.learning} learning`} /><Stat label="Books completed" value={books.filter(b => b.progress >= 0.99).length} />
      <Stat label="Books in library" value={books.length} /><Stat label="Day streak" value={`${totals.streak}`} />
    </div>
    <div className="grid lg:grid-cols-5 gap-10 mt-10">
      <div className="lg:col-span-3"><div className="flex justify-between items-baseline"><p className="v-kicker">Vocabulary growth</p><span className="text-[11px] tracking-[.16em] uppercase text-zinc-400">Known words · cumulative</span></div>
        <svg viewBox="0 0 260 72" className="w-full mt-4" preserveAspectRatio="none" style={{ height: 150 }}><polyline points={growthPts || '0,64 260,64'} fill="none" stroke="#a9714b" strokeWidth="1.6" /></svg>
        <div className="border-t v-hair pt-2 flex justify-between text-[10px] tracking-[.14em] uppercase text-zinc-400"><span>{days[0]?.date ?? ''}</span><span>{counts.known} known</span><span>{days[days.length - 1]?.date ?? ''}</span></div>
        <p className="v-kicker mt-10">Learning levels</p>
        <div className="flex items-end gap-3 h-36 mt-4 border-b v-hair pb-1">{levels.map(l => <div key={l.label} className="flex-1 flex flex-col items-center gap-1"><span className="text-xs text-zinc-500">{l.value}</span><div className="w-full" style={{ height: `${Math.max(3, (l.value / maxLevel) * 100)}px`, background: l.color }} /><span className="text-[10px] tracking-[.14em] uppercase text-zinc-400">{l.label}</span></div>)}</div>
      </div>
      <div className="lg:col-span-2"><div className="flex justify-between items-baseline"><p className="v-kicker">This week</p><span className="text-[11px] tracking-[.16em] uppercase text-zinc-400">Minutes per day</span></div>
        <div className="flex items-end gap-2 h-36 mt-4 border-b v-hair pb-1">{week.map((d, i) => { const v = Math.round((d.readingSec + d.listeningSec) / 60); return <div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full" style={{ height: `${Math.max(3, (v / maxWeek) * 108)}px`, background: i === week.length - 1 ? '#a9714b' : '#a79c8a' }} /><span className="text-[9px] text-zinc-400">{d.date.slice(5)}</span></div>; })}</div>
        <p className="v-kicker mt-8">Reading · Listening · Words learned</p>
        <div className="grid grid-cols-3 gap-3 mt-3"><div><p className="text-[11px] text-zinc-400 mb-1">Reading / day</p><BarChart data={days.map(d => ({ label: d.date, value: Math.round(d.readingSec / 60) }))} color="#a79c8a" height={64} /></div><div><p className="text-[11px] text-zinc-400 mb-1">Listening / day</p><BarChart data={days.map(d => ({ label: d.date, value: Math.round(d.listeningSec / 60) }))} color="#a79c8a" height={64} /></div><div><p className="text-[11px] text-zinc-400 mb-1">Learned / day</p><BarChart data={days.map(d => ({ label: d.date, value: d.knownMarked }))} color="#a9714b" height={64} /></div></div>
        <p className="v-kicker mt-8">Milestones</p>
        {nextMilestone ? <p className="text-sm mt-3"><span className="text-[#a9714b]">■</span> {nextMilestone.toLocaleString()} known words — {nextMilestone - counts.known} to go</p> : <p className="text-sm mt-3"><span className="text-[#a9714b]">■</span> {counts.known.toLocaleString()} known words</p>}
        {books.filter(b => b.progress >= 0.99).slice(0, 2).map(b => <p key={b.id} className="text-sm mt-1.5"><span className="text-[#a9714b]">■</span> Book finished — {b.title}</p>)}
        <p className="v-kicker mt-8">Books</p>
        {books.map(b => <p key={b.id} className="text-sm py-1 border-b v-hair flex justify-between"><span>{b.title}</span><span className="text-zinc-400">{Math.round(b.progress * 100)}%{b.progress >= 0.99 ? ' · completed ✓' : ''}</span></p>)}{!books.length && <p className="text-sm text-zinc-400 mt-2">No books yet.</p>}
      </div>
    </div>
  </div>;
}

function DictionariesPage({ settings }: { settings: Settings }) {
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [query, setQuery] = useState(''); const [result, setResult] = useState<DictEntry | undefined>();
  const [searched, setSearched] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const lang = settings.learningLang;
  useEffect(() => { void Promise.all(LANGUAGES.filter(l => l.ready).map(async l => setSizes(s => ({ ...s, [l.code]: 0 })))).then(async () => { for (const l of LANGUAGES.filter(x => x.ready)) { const n = await DictionaryService.size(l.code).catch(() => 0); setSizes(s => ({ ...s, [l.code]: n })); } }); }, []);
  return <div><div className="flex items-start justify-between"><div><h2 className="v-title">Dictionaries</h2><p className="v-sub text-zinc-500 mt-2">Sources you can trust — local first, clearly licensed, never invented.</p></div><span className="v-kicker">Local · Offline</span></div>
    <div className="grid lg:grid-cols-5 gap-10 mt-8"><div className="lg:col-span-3"><p className="v-kicker">Local dictionaries</p>
    <div className="mt-2">{LANGUAGES.filter(l => l.ready).map(l => <div key={l.code} className="flex items-baseline gap-4 py-3.5 border-b v-hair"><span className="w-44 shrink-0"><span className="block lf-serif text-xl leading-tight">{l.native}</span><span className="block text-xs text-zinc-400">{l.name}</span></span><span className="text-sm text-zinc-500 flex-1">{sizes[l.code] ?? '…'} entries · {l.segmenter === 'space' ? 'word tokenization' : l.segmenter === 'dict-zh' ? 'Chinese segmentation (Intl + dictionary)' : 'Intl.Segmenter morphology'}</span><span className="text-[11px] tracking-[.18em] uppercase text-[#a9714b]">Local</span></div>)}
      {LANGUAGES.filter(l => !l.ready).map(l => <div key={l.code} className="flex items-baseline gap-4 py-3.5 border-b v-hair opacity-50"><span className="w-44 shrink-0"><span className="block lf-serif text-xl leading-tight">{l.native}</span><span className="block text-xs text-zinc-400">{l.name}</span></span><span className="text-sm text-zinc-500 flex-1">Dictionary pack planned</span><span className="text-[11px] tracking-[.18em] uppercase text-zinc-400">Import +</span></div>)}</div>
    <p className="text-xs text-zinc-400 mt-4">Every entry shows its source. Dictionaries are updated in place and never reset your vocabulary.</p></div>
    <div className="lg:col-span-2"><p className="v-kicker">Look up · {langInfo(lang).name}</p><div className="border-l v-hair pl-5 mt-2">
      <div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a word…" /><Button onClick={() => void DictionaryService.lookup(lang, query).then(r => { setResult(r); setSearched(true); })}>Search</Button>
      <Button variant="ghost" onClick={() => result && void AudioService.speakWord(result.word, lang)}>🔊</Button></div>
      {result ? <div className="mt-2 text-sm"><b>{result.word}</b> {result.phonetic} <span className="text-zinc-400">{result.pos} · freq #{result.frequency}</span><p>{result.definition}</p><p className="text-zinc-500">Translation: {result.translation}</p><p className="italic text-zinc-500">{result.examples[0]}</p></div>
        : searched && <p className="text-sm text-zinc-400 mt-2">Not in the local dictionary. Import a larger dictionary below or enable translation fallback.</p>}
      <div className="mt-4"><Label>Import custom dictionary (JSON / CSV / TSV / TXT — word, definition, translation per row)</Label>
        <input type="file" accept=".json,.csv,.tsv,.txt" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const text = await f.text(); const fmt = f.name.endsWith('.json') ? 'json' : f.name.endsWith('.csv') ? 'csv' : f.name.endsWith('.tsv') ? 'tsv' : 'txt'; const entries = DictionaryService.parseImport(text, fmt, lang); DictionaryService.registerCustom(lang, entries); const prev = JSON.parse(localStorage.getItem(`lf:custom-dict:${lang}`) ?? '[]') as DictEntry[]; localStorage.setItem(`lf:custom-dict:${lang}`, JSON.stringify([...prev, ...entries])); setImportMsg(`Imported ${entries.length} entries for ${langInfo(lang).name}.`); } catch (err) { setImportMsg('Import failed: ' + String(err)); } }} className="text-sm" />
        {importMsg && <p className="text-xs text-zinc-500 mt-1">{importMsg}</p>}</div>
    </div></div></div></div>;
}

function LanguagesPage({ settings, setSettings }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void> }) {
  return <div><h2 className="v-title">Languages</h2>
    <p className="v-sub text-zinc-500 mt-2">Learn several languages at once — each keeps its own words, books and rhythm.</p>
    <p className="v-kicker mt-8">Three separate settings</p>
    <div className="grid md:grid-cols-3 gap-6 border-y v-hair py-5 mt-3">
      <div className="border-l-2 border-[#a9714b] pl-4"><Label>Learning</Label><Select value={settings.learningLang} onChange={e => void setSettings({ learningLang: e.target.value as LangCode })} className="w-full">{LANGUAGES.filter(l => l.ready).map(l => <option key={l.code} value={l.code}>{l.native} {l.name}</option>)}</Select></div>
      <div className="border-l v-hair pl-4"><Label>Native</Label><Select value={settings.nativeLang} onChange={e => void setSettings({ nativeLang: e.target.value as LangCode })} className="w-full">{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></div>
      <div className="border-l v-hair pl-4"><Label>Interface</Label><Select value={settings.interfaceLang} onChange={e => void setSettings({ interfaceLang: e.target.value })} className="w-full">{INTERFACE_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></div>
    </div>
    <p className="v-kicker mt-10">Learning languages</p>
    <div className="mt-1">{LANGUAGES.map(l => <div key={l.code} className={`flex flex-wrap items-baseline gap-4 py-4 border-b v-hair ${l.code === settings.learningLang ? 'border-l-2 border-l-[#a9714b] pl-4' : ''}`}>
      <span className="w-44 shrink-0"><span className="block lf-serif text-2xl">{l.native}</span><span className="block text-xs text-zinc-400 mt-0.5">{l.name}</span></span>
      <span className="text-sm text-zinc-500 flex-1">{l.ready ? 'Supported · ' + (l.segmenter === 'space' ? 'space tokenization' : l.segmenter === 'dict-zh' ? 'Chinese segmentation' : 'Intl.Segmenter morphology') + (l.rtl ? ' · RTL' : '') : 'Prepared in architecture — pack coming'}</span>
      {l.code === settings.learningLang ? <span className="text-[11px] tracking-[.2em] uppercase text-[#a9714b]">Current</span> : l.ready ? <button className="v-kicker" onClick={() => void setSettings({ learningLang: l.code })}>Learn →</button> : <span className="text-[11px] tracking-[.2em] uppercase text-zinc-400">Add +</span>}
    </div>)}</div>
    <p className="text-xs text-zinc-400 mt-4">Switching the learning language updates every module immediately — nothing is shared by accident.</p></div>;
}

type Playlist = { name: string; lines: string[] };
const PLAYLIST_KEY = 'visus:playlists';
function loadPlaylists(): Playlist[] { try { const p = JSON.parse(localStorage.getItem(PLAYLIST_KEY) ?? '[]') as Playlist[]; return Array.isArray(p) ? p.filter(x => x && typeof x.name === 'string' && Array.isArray(x.lines)) : []; } catch { return []; } }

function AudioDeckPage({ settings, setSettings }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void> }) {
  const lang = settings.learningLang;
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [lists, setLists] = useState<Playlist[]>(loadPlaylists);
  const [msg, setMsg] = useState('');
  const lines = useMemo(() => text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 2000), [text]);
  const voices = voiceCatalogue(lang);
  const save = () => { if (!name.trim() || !lines.length) return; const next = [...lists.filter(l => l.name !== name.trim()), { name: name.trim(), lines }].slice(-20); setLists(next); try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(next)); } catch { /* full */ } setMsg(`Saved playlist “${name.trim()}” (${lines.length} lines).`); };
  return <div className="lf-fade"><p className="v-kicker">← Audio — Listening deck</p><h2 className="v-title mt-2">Audio deck</h2>
    <p className="v-sub text-zinc-500 mt-2">Listen line by line with on-device voices. Nothing is uploaded for speech{settings.preferOfflineVoices ? ' — offline voices preferred' : ''}.</p>
    <div className="grid lg:grid-cols-5 gap-6 mt-6">
      <div className="lg:col-span-3"><Card><h3 className="v-kicker mb-3">Queue — one line at a time</h3>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder={'Paste sentences, one per line…'} className="w-full border v-hair bg-transparent p-3 text-sm" />
        <div className="flex flex-wrap gap-2 mt-3">
          <Button onClick={() => void AudioService.speakQueue(lines.map(t => ({ text: t, lang }))).then(n => setMsg(n ? `Playing ${n} line(s).` : 'No speech voice available in this browser.'))}>▶ Play queue ({lines.length})</Button>
          <Button variant="soft" onClick={() => { AudioService.stop(); setMsg('Stopped.'); }}>■ Stop</Button>
          <Button variant="ghost" onClick={() => void VocabularyService.all(lang).then(rows => setText(rows.filter(r => r.status !== 'known' && r.status !== 'ignored').slice(0, 50).map(r => r.word).join('\n')))}>Load learning words</Button>
        </div>
        {msg && <p className="text-xs text-zinc-500 mt-2">{msg}</p>}
        <Label>Save as playlist</Label><div className="flex gap-2"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Playlist name…" /><Button variant="soft" onClick={save}>Save</Button></div>
        {lists.map(l => <div key={l.name} className="flex items-center gap-2 py-1.5 border-b v-hair text-sm"><span className="flex-1">{l.name} · {l.lines.length} lines</span><Button variant="ghost" onClick={() => setText(l.lines.join('\n'))}>Load</Button><Button variant="ghost" onClick={() => { const next = lists.filter(x => x.name !== l.name); setLists(next); try { localStorage.setItem(PLAYLIST_KEY, JSON.stringify(next)); } catch { /* noop */ } }}>Delete</Button></div>)}
      </Card></div>
      <div className="lg:col-span-2"><Card><h3 className="v-kicker mb-3">Local voices — {langInfo(lang).name}</h3>
        <Toggle checked={settings.preferOfflineVoices} onChange={v => void setSettings({ preferOfflineVoices: v })} label="Prefer offline (on-device) voices" />
        <Label>Voice</Label><Select value={settings.ttsVoice} onChange={e => void setSettings({ ttsVoice: e.target.value })}><option value="">Auto</option>{voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang}){v.local ? ' · offline' : ''}</option>)}</Select>
        <Label>Speech rate: {settings.ttsRate}×</Label><input type="range" min={0.5} max={1.8} step={0.1} value={settings.ttsRate} onChange={e => void setSettings({ ttsRate: +e.target.value })} className="w-full" />
        <p className="text-xs text-zinc-400 mt-2">{voices.length ? `${voices.filter(v => v.local).length} offline / ${voices.length} voices for this language.` : 'No voices reported yet — interact with the page or check Settings → Audio.'}</p>
      </Card></div>
    </div></div>;
}

function TranscriptPage({ settings, onWord, refreshKey }: { settings: Settings; onWord: (w: string) => void; refreshKey: number }) {
  const lang = settings.learningLang;
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [gloss, setGloss] = useState('');
  const cues = useMemo(() => parseTimedText(raw), [raw]);
  const shown = cues.filter(c => !q || c.text.toLowerCase().includes(q.toLowerCase()));
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return <div className="lf-fade"><p className="v-kicker">← Transcript — Read the lines</p><h2 className="v-title mt-2">Transcript</h2>
    <p className="v-sub text-zinc-500 mt-2">Paste or open a WebVTT / SRT file. Words highlight with your vocabulary — click any word to grade it.</p>
    <div className="flex flex-wrap gap-2 mt-5 items-center">
      <label className="text-[#a9714b] cursor-pointer text-sm">Open .vtt / .srt +<input type="file" accept=".vtt,.srt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void f.text().then(setRaw); }} /></label>
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search lines…" className="!w-52" />
      <span className="text-xs text-zinc-400">{cues.length} lines</span>
    </div>
    <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={6} placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nBonjour le monde'} className="w-full border v-hair bg-transparent p-3 text-sm mt-3" />
    <div className="mt-4 space-y-1">
      {shown.slice(0, 5000).map((c, i) => <div key={i} className="flex gap-3 py-2 border-b v-hair items-start">
        <span className="text-xs text-zinc-400 w-12 shrink-0 pt-1">{fmt(c.start)}</span>
        <div className="flex-1 min-w-0"><HighlightedText text={c.text} lang={lang} onWord={onWord} refreshKey={refreshKey} /></div>
        <Button variant="ghost" onClick={() => void AudioService.speakSentence(c.text, lang)}>🔊</Button>
        <Button variant="ghost" onClick={() => void translateLocally(c.text, lang, settings.nativeLang).then(r => setGloss(`“${c.text}” → ${r.text} (${r.covered}/${r.total} words glossed offline${r.unknown.length ? `; kept: ${r.unknown.join(', ')}` : ''})`))}>Gloss</Button>
      </div>)}
      {!cues.length && <p className="text-sm text-zinc-400">No timed lines yet — paste WebVTT or SRT above.</p>}
    </div>
    {gloss && <p className="text-sm mt-3 border v-hair p-3">{gloss}</p>}
  </div>;
}

function SettingsPage({ settings, setSettings, go }: { settings: Settings; setSettings: (p: Partial<Settings>) => Promise<void>; go: (p: Page) => void }) {
  const [license, setLicense] = useState(settings.licenseKey);
  const [licenseMsg, setLicenseMsg] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [password, setPassword] = useState('');
  const voices = listVoices(settings.learningLang);
  const fileRef = useRef<HTMLInputElement>(null);
  const show = (_c: string) => '';
  return <div><div className="flex items-start justify-between"><div><h2 className="v-title">Settings</h2><p className="v-sub text-zinc-500 mt-2">Quiet control over how {APP_NAME} looks, reads and remembers.</p></div><span className="text-[11px] tracking-[.18em] uppercase text-zinc-400">Local-first · {APP_SUBTITLE_JA}</span></div>
    <div className="grid lg:grid-cols-2 gap-x-12 gap-y-2 mt-6 border-t v-hair pt-2">
      <Card className={show('Appearance')}><h3 className="v-kicker mb-3">Appearance</h3>
        <Label>Theme</Label><Select value={settings.theme} onChange={e => void setSettings({ theme: e.target.value as Settings['theme'] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select>
        {COLOR_ROWS.filter(r => ['new', 'l1', 'l2', 'l3'].includes(r.s)).map(r => <div key={r.s} className="flex items-center justify-between py-1 text-sm"><span>{STATUS_LABEL[r.s]}</span><input type="color" value={settings.highlightColors[r.s]} onChange={e => void setSettings({ highlightColors: { ...settings.highlightColors, [r.s]: e.target.value } })} /></div>)}
        <Label>Counter position</Label><Select value={settings.counterPosition} onChange={e => void setSettings({ counterPosition: e.target.value as Settings['counterPosition'] })}><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-right">Top right</option><option value="hidden">Hidden</option></Select>
        <Label>Tooltip size: {settings.tooltipSize}px</Label><input type="range" min={12} max={18} value={settings.tooltipSize} onChange={e => void setSettings({ tooltipSize: +e.target.value })} className="w-full" /></Card>
      <Card className={show('Reading')}><h3 className="v-kicker mb-3">Reading & highlighting</h3>
        <Toggle checked={settings.autoHighlight} onChange={v => void setSettings({ autoHighlight: v })} label="Automatic highlighting on websites" />
        <Label>Reading font size: {settings.fontSize}px</Label><input type="range" min={14} max={26} value={settings.fontSize} onChange={e => void setSettings({ fontSize: +e.target.value })} className="w-full" />
        <Label>Line height: {settings.lineHeight}</Label><input type="range" min={1.3} max={2.2} step={0.1} value={settings.lineHeight} onChange={e => void setSettings({ lineHeight: +e.target.value })} className="w-full" />
        <p className="text-xs text-zinc-400">Grading shortcuts: 1–4 levels, K known, X ignore, 0 new, Esc close, Alt+←/→ move between words. Subtitles: A/S/D/Q/E/C/W.</p></Card>
      <Card className={show('Audio')}><h3 className="v-kicker mb-3">Audio</h3>
        <Label>Speech rate: {settings.ttsRate}×</Label><input type="range" min={0.5} max={1.8} step={0.1} value={settings.ttsRate} onChange={e => void setSettings({ ttsRate: +e.target.value })} className="w-full" />
        <Label>Voice</Label><Select value={settings.ttsVoice} onChange={e => void setSettings({ ttsVoice: e.target.value })}><option value="">Auto ({langInfo(settings.learningLang).name})</option>{voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</Select>
        <Toggle checked={settings.preferOfflineVoices} onChange={v => void setSettings({ preferOfflineVoices: v })} label="Prefer offline (on-device) voices" />
        <Button variant="soft" className="mt-2" onClick={() => void AudioService.speakWord('VISUS', settings.learningLang)}>Test voice</Button>
        <p className="text-xs text-zinc-400 mt-1">Uses voices installed on your device ({voiceCatalogue(settings.learningLang).filter(v => v.local).length} offline reported); text is never uploaded for speech. Queue listening lives in the Audio deck.</p></Card>
      <Card className={show('Privacy')}><h3 className="v-kicker mb-3">Privacy</h3>
        <Toggle checked={settings.localOnly} onChange={v => void setSettings({ localOnly: v })} label="Local-only mode (no network calls)" />
        <Toggle checked={settings.translationEnabled && settings.translationProvider === 'local'} onChange={v => void setSettings({ translationEnabled: v, translationProvider: v ? 'local' : 'none' })} label="Offline local translation (dictionary gloss, no network)" />
        <Toggle checked={settings.translationEnabled && settings.translationProvider === 'google'} onChange={v => void setSettings({ translationEnabled: v, localOnly: v ? false : settings.localOnly, translationProvider: v ? 'google' : 'none' })} label="Optional Google Translate fallback (sends words to Google)" />
        <Toggle checked={settings.aiEnabled} onChange={v => void setSettings({ aiEnabled: v })} label="Optional AI assistant (sends selected words to your provider)" />
        <Label>OpenAI API key (stored locally, optional)</Label><Input type="password" value={settings.apiKeys.openai ?? ''} onChange={e => void setSettings({ apiKeys: { ...settings.apiKeys, openai: e.target.value } })} placeholder="sk-…" />
        <p className="text-xs text-zinc-400">No account, no browsing-history collection, no hidden tracking. Books are never uploaded. API keys never leave this device except to the provider you chose.</p></Card>
      <Card className={show('General')}><h3 className="v-kicker mb-3">Backup & data</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => void BackupService.exportJSON().then(t => BackupService.download(BACKUP_FILENAME, t))}>Export backup (JSON)</Button>
          <Button variant="soft" onClick={() => fileRef.current?.click()}>Import backup…</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const res = await BackupService.importJSON(await f.text()); setBackupMsg(`Restored: ${res.added} words added, ${res.skipped} duplicates skipped.`); } catch (err) { setBackupMsg('Import failed: ' + String(err)); } }} />
        </div>
        <Label>Password for encrypted backup</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Backup password" />
        <div className="flex gap-2 mt-2"><Button variant="soft" disabled={!password} onClick={() => void BackupService.exportEncrypted(password).then(t => BackupService.download(BACKUP_ENCRYPTED_FILENAME, t))}>Export encrypted</Button>
          <Button variant="ghost" onClick={async () => { const f = fileRef.current; if (f) { f.onchange = async () => { const file = f.files?.[0]; if (!file || !password) return; try { const plain = await BackupService.decryptBackup(await file.text(), password); const res = await BackupService.importJSON(plain); setBackupMsg(`Encrypted backup restored: ${res.added} added.`); } catch { setBackupMsg('Decryption failed — wrong password or file.'); } }; f.click(); } }}>Restore encrypted…</Button></div>
        {backupMsg && <p className="text-xs mt-2">{backupMsg}</p>}
        <Button variant="danger" className="mt-3" onClick={() => { if (confirm('Delete ALL local data (vocabulary, books, stats)? This cannot be undone.')) { void Promise.all([import('../storage/db').then(m => Promise.all(['vocab', 'books', 'bookData', 'stats'].map(s => m.idb.clear(s))))]).then(() => location.reload()); } }}>Delete all personal data</Button></Card>
      <Card className={show('General')}><h3 className="v-kicker mb-3">License</h3>
        <p className="text-sm text-zinc-500">Unlimited — no tracked-word cap, no paywall. Every feature works for every word, in every language.</p>
        <Label>License key (LF1-…, optional)</Label><div className="flex gap-2"><Input value={license} onChange={e => setLicense(e.target.value)} placeholder="LF1-XXXXXXX-XXX" />
          <Button onClick={() => void activateLicense(license).then(ok => setLicenseMsg(ok ? 'Key recorded. Thank you! VISUS is already unlimited.' : 'Invalid key — check for typos.'))}>Activate</Button></div>
        {licenseMsg && <p className="text-xs mt-1">{licenseMsg}</p>}
        <p className="text-xs text-zinc-400 mt-1">Current: Unlimited{settings.premium && verifyLicenseKey(settings.licenseKey) ? ' · LF1 key verified offline' : ''}. <button className="underline" onClick={() => go('onboarding')}>Replay onboarding</button></p></Card>
      <Card className={show('Languages')}><h3 className="v-kicker mb-3">Languages</h3>
        <Label>Learning language</Label><Select value={settings.learningLang} onChange={e => void setSettings({ learningLang: e.target.value as LangCode })}>{LANGUAGES.filter(l => l.ready).map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Label>Native language</Label><Select value={settings.nativeLang} onChange={e => void setSettings({ nativeLang: e.target.value as LangCode })}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Label>Interface language</Label><Select value={settings.interfaceLang} onChange={e => void setSettings({ interfaceLang: e.target.value })}>{INTERFACE_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Card>
      <Card className={show('Vocabulary')}><h3 className="v-kicker mb-3">Vocabulary colors</h3>
        {COLOR_ROWS.map(r => <div key={r.s} className="flex items-center gap-2 py-1 text-sm"><span className="inline-block h-4 w-8 rounded border border-stone-300" style={{ background: swatch(r.s) }} /><span className="w-28">{STATUS_LABEL[r.s]}</span><span className="text-zinc-400 text-xs">{r.desc}</span></div>)}
        <p className="text-xs text-zinc-400 mt-2">Exact colors for New/L1/L2/L3 are editable under Appearance. Changes apply to every page immediately after reload of that page.</p></Card>
      <Card className={show('Dictionary')}><h3 className="v-kicker mb-3">Dictionary</h3><p className="text-sm text-zinc-500">Bundled offline dictionaries, custom imports and lookup live in the Dictionaries section.</p><Button variant="soft" className="mt-2" onClick={() => go('dictionaries')}>Open Dictionaries</Button></Card>
      <Card className={show('Videos')}><h3 className="v-kicker mb-3">Videos</h3>
        <Toggle checked={settings.subtitleAutoPause} onChange={v => void setSettings({ subtitleAutoPause: v })} label="Auto-pause after each subtitle line" />
        <Toggle checked={settings.subtitleShowTranslation} onChange={v => void setSettings({ subtitleShowTranslation: v })} label="Show subtitle translation" />
        <Toggle checked={settings.subtitleBlur} onChange={v => void setSettings({ subtitleBlur: v })} label="Blur subtitles until hover" />
        <Label>Subtitle size: {settings.subtitleFontSize}px</Label><input type="range" min={14} max={34} value={settings.subtitleFontSize} onChange={e => void setSettings({ subtitleFontSize: +e.target.value })} className="w-full" /></Card>
    </div></div>;
}

function App() {
  const [settings, setSettings, ready] = useSettings();
  const [r, setR] = useState(route());
  const [word, setWord] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { const h = () => setR(route()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { // restore custom imported dictionaries
    for (const l of LANGUAGES.filter(x => x.ready)) { try { const raw = localStorage.getItem(`lf:custom-dict:${l.code}`); if (raw) DictionaryService.registerCustom(l.code, JSON.parse(raw) as DictEntry[]); } catch { /* ignore */ } }
  }, []);
  const go = (p: Page) => { location.hash = '#/' + p; };
  useEffect(() => { if (ready && !settings.onboarded && r.page !== 'onboarding') go('onboarding'); }, [ready, settings.onboarded]); // eslint-disable-line
  const onWord = useCallback((w: string) => setWord(w), []);
  const graded = useCallback(() => setRefreshKey(k => k + 1), []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); go('vocabulary'); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []); // eslint-disable-line
  const cur = NAV.find(n => n.id === r.page);
  if (!ready) return <div className="min-h-screen visus-paper p-10"><p className="lf-serif text-4xl tracking-[.18em]">{APP_NAME}</p><p className="text-sm text-zinc-500 mt-2">{APP_TAGLINE} · {APP_SUBTITLE_JA}</p><p className="text-sm text-zinc-400 mt-6">Loading VISUS…</p></div>;
  if (r.page === 'onboarding') return <div className="min-h-screen visus-paper text-[#2b251d] dark:text-[#f2ead9]"><Onboarding settings={settings} setSettings={setSettings} go={go} /></div>;
  return <div className="min-h-screen visus-paper text-[#2b251d] dark:text-[#f2ead9] flex">
    <aside className="w-60 shrink-0 border-r v-hair px-6 py-7 hidden md:flex md:flex-col sticky top-0 h-screen">
      <p className="lf-serif text-[32px] leading-none font-medium tracking-[.22em]">{APP_NAME}</p>
      <p className="text-xs tracking-[.28em] text-zinc-500 mt-2">{APP_SUBTITLE_JA}</p>
      <label className="flex items-center gap-2 mt-9 text-[13px] tracking-[.12em] uppercase"><Globe2 size={15} className="text-[#a9714b]" /><Select value={settings.learningLang} onChange={e => void setSettings({ learningLang: e.target.value as LangCode })} className="!border-0 !bg-transparent !px-0 uppercase tracking-[.06em] max-w-[158px] text-[12px]">{LANGUAGES.filter(l => l.ready).map(l => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.native} · ${l.name}`}</option>)}</Select></label>
      <div className="border-t v-hair mt-4" />
      <nav className="mt-5 space-y-1">{NAV.map(n => <button key={n.id} onClick={() => go(n.id)} className={`flex w-full items-center gap-3 px-2 py-[7px] text-[13px] tracking-[.18em] uppercase transition border-l-2 ${r.page === n.id ? 'text-[#a9714b] border-[#a9714b] font-semibold' : 'border-transparent text-zinc-600 dark:text-zinc-300 hover:text-[#a9714b]'}`}>{n.icon}{n.label}</button>)}</nav>
      <button onClick={() => go('vocabulary')} className="mt-auto text-left text-[11px] tracking-[.2em] uppercase text-zinc-400 hover:text-[#a9714b]">Global search — Ctrl K</button>
      <p className="text-[11px] tracking-[.14em] uppercase text-zinc-400 mt-5">No. {PAGE_NO[r.page] ?? '01'} — {cur?.label ?? 'Home'}</p>
      <p className="text-[10px] text-zinc-400 mt-1">Local-first · No account, no uploads</p>
    </aside>
    <main className="flex-1 px-5 py-6 md:px-10 md:py-8 max-w-[1440px] mx-auto w-full min-w-0">
      <div className="flex md:hidden gap-1.5 flex-wrap mb-5">{NAV.map(n => <button key={n.id} onClick={() => go(n.id)} className={`px-2.5 py-1.5 text-[11px] tracking-[.12em] uppercase border ${r.page === n.id ? 'bg-[#a9714b] text-[#fff7ea] border-[#a9714b]' : 'border-[#ddd0b8] dark:border-[#57503f]'}`}>{n.label}</button>)}</div>
      {r.page === 'home' && <HomePage settings={settings} go={go} onWord={onWord} />}
      {r.page === 'reading' && <ReadingPage settings={settings} setSettings={setSettings} initialUrl={r.param} onWord={onWord} refreshKey={refreshKey} />}
      {r.page === 'discover' && <DiscoverPage settings={settings} go={go} />}
      {r.page === 'books' && <BooksPage settings={settings} onWord={onWord} refreshKey={refreshKey} />}
      {r.page === 'videos' && <VideosPage settings={settings} setSettings={setSettings} />}
      {r.page === 'audio' && <AudioDeckPage settings={settings} setSettings={setSettings} />}
      {r.page === 'transcript' && <TranscriptPage settings={settings} onWord={onWord} refreshKey={refreshKey} />}
      {r.page === 'vocabulary' && <VocabularyPage settings={settings} onWord={onWord} go={go} />}
      {r.page === 'review' && <ReviewPage settings={settings} />}
      {r.page === 'statistics' && <StatisticsPage settings={settings} />}
      {r.page === 'dictionaries' && <DictionariesPage settings={settings} />}
      {r.page === 'languages' && <LanguagesPage settings={settings} setSettings={setSettings} />}
      {r.page === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} go={go} />}
    </main>
    {word && <WordModal word={word} lang={settings.learningLang} onClose={() => setWord(null)} onGraded={graded} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);


