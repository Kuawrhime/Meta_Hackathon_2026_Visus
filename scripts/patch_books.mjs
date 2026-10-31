import { readFileSync, writeFileSync } from 'node:fs';
const f = 'src/dashboard/main.tsx';
let s = readFileSync(f, 'utf8');
s = s.replace("  const [ocrMsg, setOcrMsg] = useState('');", "  const [ocrMsg, setOcrMsg] = useState('');\n  const [bookView, setBookView] = useState<'grid'|'list'>('grid');");
s = s.replace('<h2 className="text-2xl font-bold">Books</h2>', `<div className="flex items-center justify-between"><h2 className="lf-serif text-3xl font-semibold">Books</h2><span className="flex rounded-full border border-stone-200 dark:border-zinc-700 overflow-hidden">{(['grid', 'list'] as const).map(v => <button key={v} onClick={() => setBookView(v)} className={\`px-3 py-1.5 text-xs capitalize \${bookView === v ? 'bg-orange-700 text-white' : ''}\`}>{v}</button>)}</span></div>`);
s = s.replace('<div className="space-y-2">{books.map(b => <Card key={b.id}><button className="font-medium text-left" onClick={() => void openBook(b)}>📖 {b.title}</button>', `<div className={bookView === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>{books.map(b => <Card key={b.id} className="!p-3"><span className="mb-2 flex h-20 items-end rounded-xl bg-gradient-to-br from-orange-600 via-rose-600 to-amber-600 p-2 text-white shadow-inner"><span className="lf-serif text-lg leading-none">{b.title.slice(0, 2)}</span></span><button className="font-medium text-left leading-snug" onClick={() => void openBook(b)}>{b.title}</button>`);
writeFileSync(f, s);
console.log('books patched', s.includes('bookView'));
