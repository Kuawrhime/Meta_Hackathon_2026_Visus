import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/dashboard/main.tsx';
let s = readFileSync(f, 'utf8');
s = s.replace("  const fileRef = useRef<HTMLInputElement>(null);",
`  const fileRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState('General');
  const show = (c: string) => cat === c ? '' : 'hidden';
  const CATS = ['General', 'Appearance', 'Languages', 'Reading', 'Vocabulary', 'Dictionary', 'Audio', 'Videos', 'Privacy'];`);
s = s.replace('<h2 className="text-2xl font-bold">Settings</h2>\n    <div className="grid md:grid-cols-2 gap-3 mt-3">',
`<h2 className="lf-serif text-3xl font-semibold">Settings</h2>
    <div className="flex flex-wrap gap-1.5 mt-3">{CATS.map(c => <button key={c} onClick={() => setCat(c)} className={\`rounded-full px-3 py-1.5 text-xs \${cat === c ? 'bg-orange-700 text-white' : 'bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700'}\`}>{c}</button>)}</div>
    <div className="grid md:grid-cols-2 gap-3 mt-3">`);
const map = [['Appearance', 'Appearance'], ['Reading & highlighting', 'Reading'], ['Audio', 'Audio'], ['Privacy', 'Privacy'], ['Backup & data', 'General'], ['License', 'General']];
for (const [title, c] of map) s = s.replace(`<Card><h3 className="font-semibold mb-2">${title}</h3>`, `<Card className={show('${c}')}><h3 className="font-semibold mb-2">${title}</h3>`);
const extra = `
      <Card className={show('Languages')}><h3 className="font-semibold mb-2">Languages</h3>
        <Label>Learning language</Label><Select value={settings.learningLang} onChange={e => void setSettings({ learningLang: e.target.value as LangCode })}>{LANGUAGES.filter(l => l.ready).map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Label>Native language</Label><Select value={settings.nativeLang} onChange={e => void setSettings({ nativeLang: e.target.value as LangCode })}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
        <Label>Interface language</Label><Select value={settings.interfaceLang} onChange={e => void setSettings({ interfaceLang: e.target.value })}>{INTERFACE_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</Select></Card>
      <Card className={show('Vocabulary')}><h3 className="font-semibold mb-2">Vocabulary colors</h3>
        {COLOR_ROWS.map(r => <div key={r.s} className="flex items-center gap-2 py-1 text-sm"><span className="inline-block h-4 w-8 rounded border border-stone-300" style={{ background: swatch(r.s) }} /><span className="w-28">{STATUS_LABEL[r.s]}</span><span className="text-zinc-400 text-xs">{r.desc}</span></div>)}
        <p className="text-xs text-zinc-400 mt-2">Exact colors for New/L1/L2/L3 are editable under Appearance. Changes apply to every page immediately after reload of that page.</p></Card>
      <Card className={show('Dictionary')}><h3 className="font-semibold mb-2">Dictionary</h3><p className="text-sm text-zinc-500">Bundled offline dictionaries, custom imports and lookup live in the Dictionaries section.</p><Button variant="soft" className="mt-2" onClick={() => go('dictionaries')}>Open Dictionaries</Button></Card>
      <Card className={show('Videos')}><h3 className="font-semibold mb-2">Videos</h3>
        <Toggle checked={settings.subtitleAutoPause} onChange={v => void setSettings({ subtitleAutoPause: v })} label="Auto-pause after each subtitle line" />
        <Toggle checked={settings.subtitleShowTranslation} onChange={v => void setSettings({ subtitleShowTranslation: v })} label="Show subtitle translation" />
        <Toggle checked={settings.subtitleBlur} onChange={v => void setSettings({ subtitleBlur: v })} label="Blur subtitles until hover" />
        <Label>Subtitle size: {settings.subtitleFontSize}px</Label><input type="range" min={14} max={34} value={settings.subtitleFontSize} onChange={e => void setSettings({ subtitleFontSize: +e.target.value })} className="w-full" /></Card>`;
s = s.replace("      <p className=\"text-[11px] text-zinc-400 px-2 mt-4\">", "      <p className=\"text-[11px] text-zinc-400 px-2 mt-4\">"); // noop guard
const anchor = " · Payment processing is modular and never stores card data.";
const idx = s.indexOf(anchor);
if (idx > 0) { const close = s.indexOf('</Card>', idx); s = s.slice(0, close + 7) + extra + s.slice(close + 7); }
writeFileSync(f, s);
console.log('settings patched', s.includes('CATS'));
