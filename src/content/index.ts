import { CONTENT_CSS } from './styles';
import { HighlightingService, pageCounts, refreshWordEverywhere, WORD_CLASS } from '../services/highlighting';
import { DictionaryService } from '../services/dictionary';
import { AudioService } from '../services/audio';
import { TranslationService } from '../services/translation';
import { segmentText, detectLanguage, normalizeWord } from '../services/segmentation';
import { DEFAULT_SETTINGS } from '../services/settings';
import type { Settings, WordStatus } from '../types';
import { detectVideoSite, SITE_LABEL } from '../videos/sites';
import { SubtitleSynchronizer, parseSubtitleFile, formatTimestamp, computeVideoStats } from '../videos/subtitles';
import { YouTubeAdapter, NetflixAdapter, GenericHTML5VideoAdapter, type VideoAdapter } from '../videos/adapters';
import { loadState, saveState } from '../design/tokens';
import { isSearchEnginePage } from '../services/searchEngine';
import type { SubtitleCue } from '../types';

declare const chrome: any;
const rt = () => (globalThis as any).chrome?.runtime;
function msg<T>(m: unknown): Promise<T> {
  return new Promise(res => { try { const r = rt()?.sendMessage(m, (v: T) => res(v)); if (r?.then) r.then(res).catch(() => res(undefined as T)); if (!rt()) res(undefined as T); } catch { res(undefined as T); } });
}

let settings: Settings = DEFAULT_SETTINGS;
let statusMap = new Map<string, WordStatus>();
let panelEl: HTMLDivElement | null = null;
let tooltipEl: HTMLDivElement | null = null;
let counterEl: HTMLDivElement | null = null;
let currentEl: HTMLElement | null = null;
const pendingEncounters = new Set<string>();
let flushTimer = 0;

function lang() { return settings.learningLang; }

async function flushEncounters() {
  if (!pendingEncounters.size) return;
  const words = [...pendingEncounters]; pendingEncounters.clear();
  await msg({ type: 'LF_ENCOUNTERS', lang: lang(), words });
}
function scheduleFlush() { window.clearTimeout(flushTimer); flushTimer = window.setTimeout(() => void flushEncounters(), 1500); }

function applyColors() {
  const c = settings.highlightColors;
  const root = document.documentElement.style;
  root.setProperty('--lf-new', c.new); root.setProperty('--lf-l1', c.l1); root.setProperty('--lf-l2', c.l2); root.setProperty('--lf-l3', c.l3);
}

const WIDGET_KEY = 'visus:widget';
type WidgetState = { x?: number; y?: number; collapsed?: boolean; hidden?: boolean };
let widgetState: WidgetState = (() => { try { return JSON.parse(localStorage.getItem(WIDGET_KEY) ?? '{}') as WidgetState; } catch { return {}; } })();
function saveWidget() { try { localStorage.setItem(WIDGET_KEY, JSON.stringify(widgetState)); } catch { /* unavailable */ } }
function updateCounter() {
  if (!counterEl) return;
  const counts = pageCounts();
  const known = counts.byStatus['known'] ?? 0;
  const learning = (counts.byStatus['l1'] ?? 0) + (counts.byStatus['l2'] ?? 0) + (counts.byStatus['l3'] ?? 0) + (counts.byStatus['l4'] ?? 0);
  const nw = counterEl.querySelector('.lf-nw'); if (nw) nw.textContent = String(counts.byStatus['new'] ?? 0);
  const lr = counterEl.querySelector('.lf-lr'); if (lr) lr.textContent = String(learning);
  const kn = counterEl.querySelector('.lf-kn'); if (kn) kn.textContent = String(known);
  const lg = counterEl.querySelector('.lf-lg'); if (lg) lg.textContent = settings.learningLang.toUpperCase();
  counterEl.title = 'VISUS — See words. Learn worlds. Click to open the dashboard. Drag to move.';
}

function makeCounter() {
  if (settings.counterPosition === 'hidden') return;
  counterEl = document.createElement('div'); counterEl.id = 'lf-counter'; counterEl.className = 'lf-ui'; counterEl.dataset.lfSkip = '';
  counterEl.setAttribute('role', 'button'); counterEl.setAttribute('tabindex', '0'); counterEl.setAttribute('aria-label', 'VISUS vocabulary. Activate to open dashboard.');
  counterEl.innerHTML = `<span class="lf-lg" style="font-family:Georgia,serif;font-weight:700">V</span><span class="lf-counts"><span class="lf-dot" style="background:#93c5fd"></span> <span class="lf-nw">0</span> · <span class="lf-dot" style="background:#fde047"></span> <span class="lf-lr">0</span> · <span class="lf-dot" style="background:#5aa9c2"></span> <span class="lf-kn">0</span></span><button class="lf-chev" aria-label="Collapse widget">–</button><button class="lf-hide" aria-label="Hide widget">×</button>`;
  const pos = settings.counterPosition;
  if (typeof widgetState.x === 'number' && typeof widgetState.y === 'number') { counterEl.style.left = widgetState.x + 'px'; counterEl.style.top = widgetState.y + 'px'; }
  else { counterEl.style[pos.startsWith('bottom') ? 'bottom' : 'top'] = '16px'; counterEl.style[pos.endsWith('left') ? 'left' : 'right'] = '16px'; }
  if (widgetState.collapsed) counterEl.dataset.collapsed = '1';
  if (widgetState.hidden) counterEl.dataset.hidden = '1';
  let drag: { x: number; y: number; moved: boolean } | null = null;
  counterEl.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('button')) return; drag = { x: e.clientX, y: e.clientY, moved: false }; counterEl!.setPointerCapture(e.pointerId); });
  counterEl.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { counterEl!.style.left = (counterEl!.offsetLeft + dx) + 'px'; counterEl!.style.top = (counterEl!.offsetTop + dy) + 'px'; counterEl!.style.right = 'auto'; counterEl!.style.bottom = 'auto'; drag.x = e.clientX; drag.y = e.clientY; } });
  counterEl.addEventListener('pointerup', e => {
    if (drag?.moved) { widgetState.x = counterEl!.offsetLeft; widgetState.y = counterEl!.offsetTop; saveWidget(); }
    else if (!(e.target as HTMLElement).closest('button')) {
      if (counterEl!.dataset.hidden === '1') { delete counterEl!.dataset.hidden; widgetState.hidden = false; saveWidget(); }
      else void msg({ type: 'LF_OPEN_DASHBOARD' });
    }
    drag = null;
  });
  counterEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void msg({ type: 'LF_OPEN_DASHBOARD' }); } });
  counterEl.querySelector('.lf-chev')?.addEventListener('click', e => { e.stopPropagation(); const on = counterEl!.dataset.collapsed === '1'; if (on) delete counterEl!.dataset.collapsed; else counterEl!.dataset.collapsed = '1'; widgetState.collapsed = !on; saveWidget(); });
  counterEl.querySelector('.lf-hide')?.addEventListener('click', e => { e.stopPropagation(); counterEl!.dataset.hidden = '1'; widgetState.hidden = true; saveWidget(); });
  document.body.appendChild(counterEl); updateCounter();
}

async function showTooltip(el: HTMLElement) {
  hideTooltip();
  const word = el.dataset.word ?? el.textContent ?? '';
  const entry = await DictionaryService.lookup(lang(), word);
  tooltipEl = document.createElement('div'); tooltipEl.id = 'lf-tooltip'; tooltipEl.className = 'lf-ui';
  tooltipEl.innerHTML = entry
    ? `<div class="lf-tt-word">${escapeHtml(entry.word)} <span class="lf-tt-phon">${escapeHtml(entry.phonetic ?? '')}</span></div><div>${escapeHtml(entry.definition)}</div><div class="lf-tt-phon">${escapeHtml(entry.pos ?? '')} · freq #${entry.frequency} · ${escapeHtml(el.dataset.status ?? 'new')}</div>`
    : `<div class="lf-tt-word">${escapeHtml(word)}</div><div>No local entry — open panel for options.</div>`;
  document.body.appendChild(tooltipEl);
  const r = el.getBoundingClientRect();
  tooltipEl.style.left = Math.min(r.left, innerWidth - 320) + 'px';
  tooltipEl.style.top = (r.bottom + 8 + 120 > innerHeight ? Math.max(8, r.top - 130) : r.bottom + 8) + 'px';
  tooltipEl.style.fontSize = settings.tooltipSize + 'px';
}
function hideTooltip() { tooltipEl?.remove(); tooltipEl = null; }
function escapeHtml(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escapeAttr(s: string) { return escapeHtml(s).replace(/"/g, '&quot;'); }
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n.toLocaleString() + (s[(v - 20) % 10] || s[v] || s[0]); };
const STATUS_PILL: Record<string, string> = { new: '● New', l1: '● Level 1', l2: '● Level 2', l3: '● Level 3', l4: '● Level 4', known: '● Known', ignored: '● Ignored' };
let panelTab: 'meaning'|'characters'|'examples' = 'meaning'; let senseIdx = 0; let panelWordKey = '';

async function grade(status: WordStatus) {
  if (!currentEl) return;
  const lemma = currentEl.dataset.lemma ?? '';
  await msg({ type: 'LF_SET_STATUS', lang: lang(), word: currentEl.dataset.word ?? lemma, status });
  refreshWordEverywhere(lemma, status);
  currentEl.dataset.status = status;
  updateCounter();
  if (panelEl) void openPanel(currentEl);
}

async function openPanel(el: HTMLElement) {
  closePanel(); currentEl = el; hideTooltip();
  const word = el.dataset.word ?? el.textContent ?? '';
  const wkey = `${lang()}:${word}`;
  if (panelWordKey !== wkey) { panelWordKey = wkey; panelTab = 'meaning'; senseIdx = 0; }
  const full = await DictionaryService.lookupWord(lang(), word);
  const entry = full?.entry;
  const rec = await msg<{ customDefinition?: string; encounters?: number } | undefined>({ type: 'LF_GET_WORD', lang: lang(), word });
  panelEl = document.createElement('div'); panelEl.id = 'lf-panel'; panelEl.className = 'lf-ui';
  panelEl.setAttribute('role', 'dialog'); panelEl.setAttribute('aria-label', `Dictionary: ${word}`);
  const translation = !entry && settings.translationEnabled ? await TranslationService.translate(word, lang(), settings.nativeLang) : null;
  const senses = full?.senses ?? [];
  senseIdx = senses.length ? ((senseIdx % senses.length) + senses.length) % senses.length : 0;
  const status = el.dataset.status ?? 'new';
  const variant = entry && entry.word !== word ? entry.word : (entry?.simplified && entry.simplified !== word ? entry.simplified : '');
  const freq = entry && entry.frequency < 9000 ? `${ordinal(entry.frequency)} most common` : '';
  const altSenses = senses.filter((_, i) => i !== senseIdx);
  const tabBtn = (t: typeof panelTab, label: string) => `<button data-tab="${t}" aria-pressed="${panelTab === t}" style="flex:1;padding:7px;border-radius:999px;border:1px solid #57503f;background:${panelTab === t ? '#a9714b' : 'rgba(255,250,240,.06)'};color:${panelTab === t ? '#fff7ea' : 'inherit'};color:inherit">${label}</button>`;
  const meaningHtml = entry ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <button data-act="speak" aria-label="Listen" style="border-radius:999px;padding:5px 9px">🔊</button>
      <span style="color:#2f6f8f;font-size:16px">${escapeHtml(entry.phonetic ?? '')}</span>
      <span style="background:#3a352b;color:#f4ecdb;border-radius:999px;padding:2px 10px;font-size:12px">${escapeHtml(STATUS_PILL[status] ?? status)}</span>
      ${freq ? `<span style="color:#b8a888;font-size:12px">${freq}</span>` : ''}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px">${tabBtn('meaning', 'Meaning')}${tabBtn('characters', 'Characters')}${tabBtn('examples', 'Examples')}</div>
    ${panelTab === 'meaning' ? `<ol style="margin:12px 0 0;padding-left:20px;display:grid;gap:7px">${senses.map((s, i) => `<li style="${i === senseIdx ? 'font-weight:600' : 'color:#d8cbb2'}">${escapeHtml(s.definition)}${s.pos ? ` <span style="color:#b8a888;font-size:12px">(${escapeHtml(s.pos)})</span>` : ''}</li>`).join('') || `<li>${escapeHtml(rec?.customDefinition ?? translation ?? 'No local dictionary entry for this word.')}</li>`}</ol>
    ${altSenses.length ? `<p style="margin-top:10px;color:#d8cbb2;font-size:13px">Also ${altSenses.map(s => `<span style="border:1px solid #57503f;border-radius:999px;padding:1px 8px;margin-right:4px"><span style="color:#2f6f8f">${escapeHtml(entry.phonetic ?? '')}</span> ${escapeHtml(s.definition)}</span>`).join('')}</p>` : ''}
    ${entry.translation && entry.translation !== entry.word && entry.translation !== entry.definition ? `<p style="color:#d8cbb2">Translation: ${escapeHtml(entry.translation)}</p>` : ''}` : ''}
    ${panelTab === 'characters' ? `<div style="margin-top:12px;display:grid;gap:8px">${(full?.characters ?? []).map(c => `<div style="display:flex;gap:10px;align-items:baseline"><span style="font-family:Georgia,serif;font-size:24px">${escapeHtml(c.char)}</span><span style="color:#2f6f8f">${escapeHtml(c.phonetic ?? '')}</span><span style="color:#d8cbb2">${escapeHtml(c.definition ?? '')}</span><span style="margin-left:auto;color:#b8a888;font-size:12px">${escapeHtml(c.traditional)}</span></div>`).join('') || '<p style="color:#b8a888">No character information for this word.</p>'}
    ${variant ? `<p style="margin-top:8px"><span style="background:#2f6f8f;color:#fff7ea;border-radius:999px;padding:2px 8px;font-size:12px">Both</span> <span style="color:#d8cbb2;font-size:13px">counts as one word with ${escapeHtml(entry?.simplified ?? variant)}</span></p>` : ''}</div>` : ''}
    ${panelTab === 'examples' ? `<div style="margin-top:12px;display:grid;gap:8px">${(entry?.examples ?? []).map(x => `<p style="margin:0">“${escapeHtml(x)}”</p>`).join('') || '<p style="color:#b8a888">No example sentences in the local dictionary for this word.</p>'}<button data-act="sentence">▶ Listen to example</button></div>` : ''}
  ` : `<p style="margin-top:10px">${escapeHtml(rec?.customDefinition ?? translation ?? 'No local dictionary entry for this word. Enable translation in Settings or add a custom definition.')}</p>`;
  panelEl.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:8px">
      <h3 style="flex:1">${escapeHtml(word)}${variant ? ` <small style="color:#b8a888;font-size:14px">· ${escapeHtml(variant)}</small>` : ''}</h3>
      ${senses.length > 1 ? `<button data-act="sense-prev" aria-label="Previous meaning">‹</button><span style="font-size:12px;color:#b8a888;padding-top:4px">${senseIdx + 1} / ${senses.length}</span><button data-act="sense-next" aria-label="Next meaning">›</button>` : ''}
      <button data-act="ai" aria-label="Explain with AI" title="AI explain">✦</button>
      <button data-act="close" aria-label="Close">✕</button>
    </div>
    <div style="color:#b8a888;font-size:12px">${escapeHtml(entry?.pos ?? '')}${rec?.encounters ? ` · seen ${rec.encounters}×` : ''}${entry?.providerId ? ` · ${escapeHtml(entry.providerId)}` : ''}</div>
    ${meaningHtml}
    <div class="lf-row"><input id="lf-custom" placeholder="Custom definition…" value="${escapeAttr(rec?.customDefinition ?? '')}" style="flex:1;padding:7px;border-radius:12px;border:1px solid #57503f;background:rgba(255,250,240,.07);color:inherit"><button data-act="save-def">Save</button></div>
    <div class="lf-grades" role="group" aria-label="Learning level">
      ${(['l1', 'l2', 'l3', 'l4'] as WordStatus[]).map((s, i) => `<button data-grade="${s}" data-on="${status === s}" style="${status === s ? 'background:#a9714b;color:#fff7ea;border-color:#a9714b' : ''}">${i + 1}</button>`).join('')}
      <button data-grade="known" style="${status === 'known' ? 'background:#a9714b;color:#fff7ea' : ''}">Known</button>
      <button data-grade="ignored" style="${status === 'ignored' ? 'background:#a9714b;color:#fff7ea' : ''}">Ignore</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px"><button data-grade="new" style="flex:1;${status === 'new' ? 'background:#dbeafe' : ''}">0 · New</button><button data-act="speak" style="flex:1">🔊 Word</button><button data-act="sentence" style="flex:1">🔊 Sentence</button></div>
    <div style="color:#b8a888;margin-top:8px;font-size:11px">1–4 level · K known · X ignore · 0 back to new · ←/→ meanings · Alt+←/→ words · Esc close</div>`;
  document.body.appendChild(panelEl);
  const r = el.getBoundingClientRect();
  panelEl.style.left = Math.min(Math.max(8, r.left), innerWidth - 340) + 'px';
  panelEl.style.top = Math.min(r.bottom + 8, innerHeight - 460) + 'px';
  panelEl.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (!b) return;
    if (b.dataset.grade) void grade(b.dataset.grade as WordStatus);
    else if (b.dataset.tab) { panelTab = b.dataset.tab as typeof panelTab; void openPanel(el); }
    else if (b.dataset.act === 'sense-prev') { senseIdx = (senseIdx - 1 + senses.length) % Math.max(1, senses.length); void openPanel(el); }
    else if (b.dataset.act === 'sense-next') { senseIdx = (senseIdx + 1) % Math.max(1, senses.length); void openPanel(el); }
    else if (b.dataset.act === 'close') closePanel();
    else if (b.dataset.act === 'speak') void AudioService.speakWord(word, lang());
    else if (b.dataset.act === 'sentence') void AudioService.speakSentence(sentenceOf(el), lang());
    else if (b.dataset.act === 'save-def') { const v = (panelEl!.querySelector('#lf-custom') as HTMLInputElement).value; void msg({ type: 'LF_SET_DEF', lang: lang(), word, def: v }).then(() => openPanel(el)); }
    else if (b.dataset.act === 'ai') void TranslationService.aiExplain(word, lang()).then(t => { if (t && panelEl) { const p = document.createElement('p'); p.textContent = t; panelEl.appendChild(p); } });
  });
}
function sentenceOf(el: HTMLElement): string {
  let n: Node | null = el.parentElement;
  while (n && !/[.!?。！？]/.test(n.textContent ?? '')) n = n.parentElement;
  const text = (n?.textContent ?? el.textContent ?? '').trim();
  const parts = text.split(/(?<=[.!?。！？])\s+/);
  return parts.find(p => p.includes(el.textContent ?? '')) ?? text.slice(0, 240);
}
function closePanel() { panelEl?.remove(); panelEl = null; }

function navigateWord(dir: 1 | -1) {
  const words = [...document.querySelectorAll<HTMLElement>(`.${WORD_CLASS}`)];
  if (!words.length) return;
  const idx = currentEl ? words.indexOf(currentEl) : -1;
  const next = words[(idx + dir + words.length) % words.length];
  next.scrollIntoView({ block: 'center', behavior: 'smooth' }); void openPanel(next);
}

document.addEventListener('mouseover', e => { const el = (e.target as HTMLElement).closest?.(`.${WORD_CLASS}`) as HTMLElement | null; if (el && !panelEl) void showTooltip(el); });
document.addEventListener('mouseout', e => { if ((e.target as HTMLElement).classList?.contains(WORD_CLASS)) hideTooltip(); });
document.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest?.(`.${WORD_CLASS}`) as HTMLElement | null;
  if (el) { e.preventDefault(); e.stopPropagation(); void openPanel(el); }
  else if (panelEl && !(e.target as HTMLElement).closest('#lf-panel')) closePanel();
}, true);
document.addEventListener('keydown', e => {
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigateWord(1); return; }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateWord(-1); return; }
  if (!panelEl) return;
  const tgt = e.target as HTMLElement | null;
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && currentEl && !(tgt && typeof tgt.matches === 'function' && tgt.matches('input,textarea'))) { e.preventDefault(); senseIdx += e.key === 'ArrowRight' ? 1 : -1; void openPanel(currentEl); return; }
  const map: Record<string, WordStatus> = { '1': 'l1', '2': 'l2', '3': 'l3', '4': 'l4', k: 'known', K: 'known', x: 'ignored', X: 'ignored', '0': 'new' };
  if (e.key === 'Escape') closePanel();
  else if (map[e.key] && !(e.target as HTMLElement).matches('input,textarea')) { e.preventDefault(); void grade(map[e.key]); }
});

// ---------- Video learning (YouTube / Netflix / generic HTML5) ----------
// VideoLearningController: one sidebar + one subtitle overlay for every
// adapter. Words reuse the page-wide vocabulary engine and dictionary
// popup, so a word graded in a video is the same entry in articles/books.
let cues: SubtitleCue[] = []; let subEl: HTMLDivElement | null = null; let subIdx = -1; let autoPausedForCue = -1;
let sidebarEl: HTMLDivElement | null = null; let sync: SubtitleSynchronizer | null = null;
let videoAdapter: VideoAdapter | null = null; let videoKey = ''; let videoStartedAt = 0;
const seenCueIdx = new Set<number>(); let sidebarState = loadState('visus:sidebar', { w: 340, collapsed: false, x: undefined as number | undefined, y: undefined as number | undefined });
function renderWords(holder: HTMLElement, text: string) {
  holder.textContent = '';
  for (const tok of segmentText(text, lang())) {
    if (!tok.isWord) { holder.appendChild(document.createTextNode(tok.text)); continue; }
    const s = document.createElement('span'); const lemma = normalizeWord(tok.text, lang());
    s.className = `${WORD_CLASS} lf-${statusMap.get(lemma) ?? 'new'}`; s.dataset.lemma = lemma; s.dataset.word = lemma; s.dataset.status = statusMap.get(lemma) ?? 'new'; s.textContent = tok.text; holder.appendChild(s);
  }
}
function videoStatsText(): string {
  const stats = computeVideoStats([...seenCueIdx].map(i => cues[i]).filter(Boolean), t => segmentText(t, lang()).filter(x => x.isWord).map(x => normalizeWord(x.text, lang())), l => statusMap.get(l) ?? 'new', videoStartedAt ? Math.round((Date.now() - videoStartedAt) / 1000) : 0);
  return `${stats.sentences} lines · ${stats.uniqueWords} words · ${stats.newWords} new · ${stats.knownWords} known`;
}
function ensureSidebar(): HTMLDivElement {
  if (sidebarEl) return sidebarEl;
  sidebarEl = document.createElement('div'); sidebarEl.id = 'lf-sidebar'; sidebarEl.className = 'lf-ui'; sidebarEl.dataset.lfSkip = '';
  sidebarEl.setAttribute('role', 'complementary'); sidebarEl.setAttribute('aria-label', 'VISUS video learning');
  if (sidebarState.collapsed) sidebarEl.dataset.collapsed = '1';
  sidebarEl.style.width = Math.min(560, Math.max(280, sidebarState.w || 340)) + 'px';
  if (typeof sidebarState.x === 'number') { sidebarEl.style.left = sidebarState.x + 'px'; sidebarEl.style.top = (sidebarState.y ?? 76) + 'px'; sidebarEl.style.right = 'auto'; }
  sidebarEl.innerHTML = `
    <div class="lf-resize" title="Drag to resize"></div>
    <div class="lf-side-head" style="display:flex;gap:8px;align-items:flex-start;cursor:grab">
      <h4 class="lf-side-title" style="flex:1">Video</h4>
      <button class="lf-ctl lf-side-collapse" aria-label="Collapse sidebar">–</button>
      <button class="lf-ctl lf-side-close" aria-label="Close sidebar">×</button>
    </div>
    <div class="lf-side-body">
      <div class="lf-side-sec" style="border-top:0;margin-top:6px;padding-top:0">
        <div class="lf-side-cur"><span class="lf-side-curtext">Loading captions…</span></div>
        <div class="lf-side-tr"></div>
        <div class="lf-side-row">
          <button class="lf-ctl" data-act="prev">⏮ Prev</button><button class="lf-ctl" data-act="replay">↻ Replay</button><button class="lf-ctl" data-act="next">Next ⏭</button>
          <select class="lf-side-speed" aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select>
        </div>
        <div class="lf-side-row">
          <label><input type="checkbox" class="lf-side-autopause"> Auto-pause</label>
          <label><input type="checkbox" class="lf-side-pauseunknown"> Pause on new word</label>
          <label><input type="checkbox" class="lf-side-show" checked> Subtitles</label>
          <button class="lf-ctl" data-act="resume" style="display:none">Resume</button>
        </div>
      </div>
      <div class="lf-side-sec"><input type="text" class="lf-side-search" placeholder="Search lines…" style="width:100%"><div class="lf-side-hist" style="margin-top:6px"></div></div>
      <div class="lf-side-sec"><span class="lf-badge">Learning</span> <span class="lf-side-stats">0 lines</span>
        <div class="lf-side-row"><label class="lf-ctl" style="cursor:pointer">Import SRT/VTT<input type="file" class="lf-side-import" accept=".srt,.vtt" hidden></label>
        <select class="lf-side-track" aria-label="Subtitle language" style="display:none"></select></div>
        <p class="lf-side-note" style="color:#b8a888;font-size:12px"></p></div>
    </div>`;
  document.body.appendChild(sidebarEl);
  const $ = (s: string) => sidebarEl!.querySelector(s) as HTMLElement | null;
  const video = () => videoAdapter?.getVideo() ?? document.querySelector('video');
  const seek = (i: number) => { const v = video(); if (v && cues[i]) { v.currentTime = cues[i].start; void v.play().catch(() => undefined); } };
  sidebarEl.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    const hist = (e.target as HTMLElement).closest('[data-cue]') as HTMLElement | null;
    if (hist) { seek(Number(hist.dataset.cue)); return; }
    if (!b) return;
    if (b.classList.contains('lf-side-collapse')) { const on = sidebarEl!.dataset.collapsed === '1'; if (on) delete sidebarEl!.dataset.collapsed; else sidebarEl!.dataset.collapsed = '1'; sidebarState.collapsed = !on; saveState('visus:sidebar', sidebarState); }
    else if (b.classList.contains('lf-side-close')) { sidebarEl!.remove(); sidebarEl = null; }
    else if (b.dataset.act === 'prev') seek(Math.max(0, subIdx - 1));
    else if (b.dataset.act === 'next') seek(Math.min(cues.length - 1, subIdx + 1));
    else if (b.dataset.act === 'replay') seek(Math.max(0, subIdx));
    else if (b.dataset.act === 'resume') { try { const r = JSON.parse(localStorage.getItem('visus:resume:' + videoKey) ?? 'null') as { t?: number } | null; const v = video(); if (v && r?.t) v.currentTime = r.t; } catch { /* none */ } }
  });
  ($('.lf-side-speed') as HTMLSelectElement | null)?.addEventListener('change', e => { const v = video(); if (v) v.playbackRate = Number((e.target as HTMLSelectElement).value) || 1; });
  ($('.lf-side-search') as HTMLInputElement | null)?.addEventListener('input', () => renderSidebarHistory());
  ($('.lf-side-import') as HTMLInputElement | null)?.addEventListener('change', e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    void f.text().then(text => { try { const parsed = parseSubtitleFile(text); cues = parsed.cues; sync = new SubtitleSynchronizer(cues); subIdx = -1; seenCueIdx.clear(); setSidebarNote(`Imported ${cues.length} lines (${parsed.format.toUpperCase()}). Click a line to jump.`); renderSidebar(true); } catch (err) { setSidebarNote(String(err)); } });
  });
  const head = $('.lf-side-head') as HTMLElement;
  let drag: { x: number; y: number } | null = null;
  head.addEventListener('pointerdown', e => { if ((e.target as HTMLElement).closest('button')) return; drag = { x: e.clientX, y: e.clientY }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!drag || !sidebarEl) return; sidebarEl.style.left = (sidebarEl.offsetLeft + e.clientX - drag.x) + 'px'; sidebarEl.style.top = (sidebarEl.offsetTop + e.clientY - drag.y) + 'px'; sidebarEl.style.right = 'auto'; drag = { x: e.clientX, y: e.clientY }; });
  head.addEventListener('pointerup', () => { if (drag && sidebarEl) { sidebarState.x = sidebarEl.offsetLeft; sidebarState.y = sidebarEl.offsetTop; saveState('visus:sidebar', sidebarState); } drag = null; });
  const rz = $('.lf-resize') as HTMLElement;
  let rzDrag: { x: number; w: number } | null = null;
  rz.addEventListener('pointerdown', e => { rzDrag = { x: e.clientX, w: sidebarEl!.offsetWidth }; rz.setPointerCapture(e.pointerId); });
  rz.addEventListener('pointermove', e => { if (!rzDrag || !sidebarEl) return; const w = Math.min(560, Math.max(280, rzDrag.w - (e.clientX - rzDrag.x))); sidebarEl.style.width = w + 'px'; sidebarState.w = w; });
  rz.addEventListener('pointerup', () => { if (rzDrag) saveState('visus:sidebar', sidebarState); rzDrag = null; });
  try { const r = JSON.parse(localStorage.getItem('visus:resume:' + videoKey) ?? 'null') as { t?: number } | null; if (r?.t && r.t > 15) { const btn = sidebarEl.querySelector('[data-act="resume"]') as HTMLElement; btn.style.display = ''; btn.textContent = `Resume ${formatTimestamp(r.t)}`; } } catch { /* none */ }
  document.addEventListener('fullscreenchange', () => {
    if (!sidebarEl) return;
    const fs = document.fullscreenElement as HTMLElement | null; const v = video();
    if (fs && v && fs.contains(v) && !fs.contains(sidebarEl)) fs.appendChild(sidebarEl);
    else if (!fs && !document.body.contains(sidebarEl)) document.body.appendChild(sidebarEl);
  });
  return sidebarEl;
}
function setSidebarNote(text: string) { const n = sidebarEl?.querySelector('.lf-side-note'); if (n) n.textContent = text; }
function renderSidebarHistory() {
  const hist = sidebarEl?.querySelector('.lf-side-hist'); if (!hist || !sync) return;
  const q = (sidebarEl?.querySelector('.lf-side-search') as HTMLInputElement | null)?.value ?? '';
  hist.innerHTML = '';
  for (const { index, cue } of sync.search(q).slice(-60)) {
    const b = document.createElement('button'); b.dataset.cue = String(index); if (index === subIdx) b.dataset.on = '1';
    b.textContent = `${formatTimestamp(cue.start)} · ${cue.text}`; hist.appendChild(b);
  }
}
function renderSidebar(force = false) {
  if (!sidebarEl) return;
  const title = sidebarEl.querySelector('.lf-side-title'); if (title && videoAdapter) title.textContent = videoAdapter.getTitle() || 'Video';
  const idx = subIdx; if (idx < 0 || !cues[idx]) { if (force) renderSidebarHistory(); return; }
  seenCueIdx.add(idx);
  const cur = sidebarEl.querySelector('.lf-side-curtext') as HTMLElement | null; if (cur) renderWords(cur, cues[idx].text);
  const stats = sidebarEl.querySelector('.lf-side-stats'); if (stats) stats.textContent = videoStatsText();
  renderSidebarHistory();
  if (settings.subtitleShowTranslation) {
    void TranslationService.translate(cues[idx].text, lang(), settings.nativeLang).then(tr => {
      const el = sidebarEl?.querySelector('.lf-side-tr'); if (el && subIdx === idx) el.textContent = tr ?? '';
    }).catch(() => undefined);
  }
  const pauseUnknown = (sidebarEl.querySelector('.lf-side-pauseunknown') as HTMLInputElement | null)?.checked;
  const showSubs = (sidebarEl.querySelector('.lf-side-show') as HTMLInputElement | null)?.checked;
  if (subEl) subEl.style.display = showSubs === false ? 'none' : '';
  if (pauseUnknown) {
    const hasNew = segmentText(cues[idx].text, lang()).filter(t => t.isWord).some(t => (statusMap.get(normalizeWord(t.text, lang())) ?? 'new') === 'new');
    const v = videoAdapter?.getVideo(); if (hasNew && v && !v.paused && autoPausedForCue !== idx) { autoPausedForCue = idx; v.pause(); }
  }
}
function ensureOverlay(player: HTMLElement) {
  if (subEl) return;
  subEl = document.createElement('div'); subEl.id = 'lf-subtitles'; subEl.className = 'lf-ui'; subEl.dataset.lfSkip = '';
  player.style.position = player.style.position || 'relative'; player.appendChild(subEl);
}
function renderVideoFrame() {
  const v = videoAdapter?.getVideo(); if (!v || !sync) return;
  const autoPause = (sidebarEl?.querySelector('.lf-side-autopause') as HTMLInputElement | null)?.checked ?? settings.subtitleAutoPause;
  const idx = sync.indexAt(v.currentTime, settings.syncOffsetMs);
  if (autoPause && idx >= 0 && idx !== autoPausedForCue && !v.paused) { autoPausedForCue = idx; v.pause(); }
  if (idx === subIdx) return; subIdx = idx;
  if (idx < 0 || !cues[idx]) { if (subEl) subEl.innerHTML = ''; return; }
  if (!videoStartedAt) videoStartedAt = Date.now();
  if (subEl) {
    subEl.innerHTML = `<div class="lf-sub-line" style="font-size:${settings.subtitleFontSize}px"><span class="lf-sub-text"></span></div>`;
    if (settings.subtitleBlur) subEl.classList.add('lf-blur'); else subEl.classList.remove('lf-blur');
    renderWords(subEl.querySelector('.lf-sub-text') as HTMLElement, cues[idx].text);
  }
  renderSidebar();
}
function saveResume() { const v = videoAdapter?.getVideo(); if (v && videoKey && v.currentTime > 5) try { localStorage.setItem('visus:resume:' + videoKey, JSON.stringify({ t: Math.floor(v.currentTime), at: Date.now() })); } catch { /* noop */ } }
function bindVideoEvents() {
  const v = videoAdapter?.getVideo(); if (!v || (v as unknown as { _visusBound?: boolean })._visusBound) return;
  (v as unknown as { _visusBound?: boolean })._visusBound = true;
  v.addEventListener('timeupdate', renderVideoFrame);
  v.addEventListener('pause', saveResume);
  setInterval(() => { const vv = videoAdapter?.getVideo(); if (vv && !vv.paused && document.visibilityState === 'visible') { void msg({ type: 'LF_ADD_LISTENING', lang: lang(), seconds: 10 }); saveResume(); } }, 10000);
  document.addEventListener('keydown', e => {
    const vv = videoAdapter?.getVideo(); if (!vv) return;
    if (e.key === 'a' || e.key === 'A') { const i = Math.max(0, subIdx - 1); vv.currentTime = cues[i]?.start ?? 0; }
    if (e.key === 's' || e.key === 'S') { if (cues[subIdx]) vv.currentTime = cues[subIdx].start; void vv.play().catch(() => undefined); }
    if (e.key === 'd' || e.key === 'D') { const i = Math.min(cues.length - 1, subIdx + 1); vv.currentTime = cues[i]?.start ?? vv.currentTime; }
    if (e.key === 'q' || e.key === 'Q') { settings.subtitleAutoPause = !settings.subtitleAutoPause; }
    if (e.key === 'c' || e.key === 'C') { if (subEl) subEl.style.display = subEl.style.display === 'none' ? '' : 'none'; }
    if (e.key === 'w' || e.key === 'W') { const w = (sidebarEl ?? subEl)?.querySelector<HTMLElement>(`.${WORD_CLASS}`); if (w) void openPanel(w); }
    if (e.key === 'e' || e.key === 'E') { subEl?.classList.toggle('lf-blur'); }
  });
}
async function startVideoLearning() {
  const url = location.href;
  const site = detectVideoSite(location.hostname);
  if (site === 'youtube' && YouTubeAdapter.isWatchPage(url)) {
    videoAdapter = YouTubeAdapter; const key = YouTubeAdapter.videoKey(url);
    if (key === videoKey && sidebarEl) return; videoKey = key; cues = []; seenCueIdx.clear(); subIdx = -1; videoStartedAt = 0;
    ensureSidebar(); setSidebarNote('Loading YouTube captions…');
    // Wait for the player + caption tracks; SPA navigations reuse this path.
    for (let i = 0; i < 40 && !cues.length; i++) {
      const video = YouTubeAdapter.getVideo();
      if (video) {
        ensureOverlay((document.querySelector('#movie_player') ?? video.parentElement) as HTMLElement);
        const sel = sidebarEl?.querySelector('.lf-side-track') as HTMLSelectElement | null;
        const tracks = YouTubeAdapter.tracks();
        if (sel && tracks.length) {
          sel.style.display = ''; sel.innerHTML = tracks.map(t => `<option value="${escapeAttr(t.languageCode)}">${escapeHtml(t.name)}</option>`).join('');
          sel.onchange = () => { void YouTubeAdapter.loadCues(sel.value).then(r => { if (r) { cues = r.cues; sync = new SubtitleSynchronizer(cues); subIdx = -1; bindVideoEvents(); renderVideoFrame(); } }).catch(() => setSidebarNote('Caption track failed to load.')); };
        }
        const loaded = await YouTubeAdapter.loadCues(settings.learningLang).catch(() => null);
        if (loaded?.cues.length) { cues = loaded.cues; sync = new SubtitleSynchronizer(cues); setSidebarNote(`${cues.length} caption lines (${loaded.track.name}). Words are clickable.`); }
      }
      if (!cues.length) await new Promise(r => setTimeout(r, 1500));
    }
    if (!cues.length) { setSidebarNote('No captions are available for this video. Import an SRT/VTT file below, or pick another video with captions.'); return; }
    bindVideoEvents(); renderVideoFrame(); return;
  }
  if (site === 'netflix') {
    videoAdapter = NetflixAdapter; const key = NetflixAdapter.videoKey(url);
    if (key === videoKey && sidebarEl) return; videoKey = key; cues = []; seenCueIdx.clear(); subIdx = -1;
    ensureSidebar(); setSidebarNote('Watching for Netflix subtitles rendered by the player. If none appear, subtitles may not be accessible on this title — import SRT/VTT instead.');
    const waitVideo = setInterval(() => {
      const video = NetflixAdapter.getVideo(); if (!video) return; clearInterval(waitVideo);
      ensureOverlay((video.parentElement ?? document.body) as HTMLElement); bindVideoEvents();
      sync = new SubtitleSynchronizer(cues);
      let lastText = '';
      setInterval(() => {
        const textNow = NetflixAdapter.visibleSubtitle();
        if (textNow && textNow !== lastText) {
          lastText = textNow;
          cues = [...cues, { start: video.currentTime, end: video.currentTime + 5, text: textNow }];
          sync = new SubtitleSynchronizer(cues); subIdx = cues.length - 1; renderVideoFrame();
        }
      }, 700);
    }, 1200);
    setTimeout(() => clearInterval(waitVideo), 60000);
    return;
  }
  // Generic HTML5: only when the page exposes text tracks.
  const found = GenericHTML5VideoAdapter.loadCues();
  if (found.length) {
    videoAdapter = GenericHTML5VideoAdapter; videoKey = GenericHTML5VideoAdapter.videoKey(url);
    cues = found; sync = new SubtitleSynchronizer(cues);
    const video = GenericHTML5VideoAdapter.getVideo(); if (video) ensureOverlay((video.parentElement ?? document.body) as HTMLElement);
    ensureSidebar(); setSidebarNote(`${cues.length} caption lines from the page player (${SITE_LABEL[site]}).`);
    bindVideoEvents();
  }
}
function watchVideoSpa() {
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href; videoKey = ''; subIdx = -1; cues = []; seenCueIdx.clear(); sync = null;
      if (sidebarEl && !YouTubeAdapter.isWatchPage(lastUrl) && detectVideoSite(location.hostname) !== 'netflix') { sidebarEl.remove(); sidebarEl = null; subEl?.remove(); subEl = null; }
      void startVideoLearning();
    }
  }, 2000);
}

// ---------- Main init ----------
async function init() {
  // BUG FIX 1: search-engine results pages are excluded BEFORE any processing:
  // no highlighting, no counters, no tooltips, no vocabulary writes, no reading stats.
  if (isSearchEnginePage(location.href, document)) return;
  const s = await msg<Settings>({ type: 'LF_GET_SETTINGS' }); if (s) settings = { ...DEFAULT_SETTINGS, ...s };
  if (!settings.onboarded && rt()) { /* popup/dashboard handle onboarding */ }
  const style = document.createElement('style'); style.textContent = CONTENT_CSS; style.className = 'lf-ui'; document.head.appendChild(style);
  applyColors();
  // Language auto-detection hint: if page language strongly differs, still follow user's learning language.
  void detectLanguage(document.body?.innerText?.slice(0, 500) ?? '');
  const map = await msg<Record<string, WordStatus>>({ type: 'LF_STATUS_MAP', lang: lang() });
  if (map) statusMap = new Map(Object.entries(map));
  if (!settings.autoHighlight) return;
  const run = () => {
    if (!document.body) return;
    HighlightingService.highlightRoot(document.body, lang(), statusMap, { onEncounter: lemma => { if (!statusMap.has(lemma)) { pendingEncounters.add(lemma); scheduleFlush(); } } });
    updateCounter();
  };
  makeCounter(); run();
  // SPA navigations into a search page (e.g. in-place search) must shut everything down.
  const navWatch = window.setInterval(() => {
    if (isSearchEnginePage(location.href, document)) {
      counterEl?.remove(); hideTooltip(); closePanel(); window.clearInterval(navWatch);
      document.querySelectorAll('.lf-w').forEach(el => el.replaceWith(document.createTextNode(el.textContent ?? '')));
    }
  }, 1000);
  const pending = new Set<Node>(); let debounce = 0;
  const observer = new MutationObserver(muts => {
    for (const m of muts) m.addedNodes.forEach(n => { if (n instanceof Element && !n.closest('.lf-ui') && !n.classList.contains('lf-ui')) pending.add(n); });
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => { pending.forEach(n => { try { HighlightingService.highlightRoot(n, lang(), statusMap, { onEncounter: l => { if (!statusMap.has(l)) { pendingEncounters.add(l); scheduleFlush(); } } }); } catch { /* detached */ } }); pending.clear(); updateCounter(); }, 250);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  // Shadow DOM: best-effort where the page exposes open shadow roots.
  document.querySelectorAll('*').forEach(el => { const sr = (el as HTMLElement).shadowRoot; if (sr) try { HighlightingService.highlightRoot(sr, lang(), statusMap); } catch { /* closed shadow root */ } });
  // Reading time: only while visible + focused (checked again server-side by interval design).
  setInterval(() => { if (document.visibilityState === 'visible' && document.hasFocus()) void msg({ type: 'LF_ADD_READING', lang: lang(), seconds: 30 }); }, 30000);
  void startVideoLearning(); watchVideoSpa();
  try {
    const bc = new BroadcastChannel('lingua-flow');
    bc.onmessage = ev => { const d = ev.data as { type: string; lemma: string; status: WordStatus; lang: string }; if (d.type === 'vocab-changed' && d.lang === lang()) { statusMap.set(d.lemma, d.status); refreshWordEverywhere(d.lemma, d.status); updateCounter(); } };
  } catch { /* BroadcastChannel unavailable */ }
  try { rt()?.onMessage.addListener((m: { type: string; lemma?: string; status?: WordStatus }) => { if (m.type === 'LF_VOCAB_CHANGED' && m.lemma) { statusMap.set(m.lemma, m.status!); refreshWordEverywhere(m.lemma, m.status!); updateCounter(); } if (m.type === 'LF_REHIGHLIGHT') location.reload(); }); } catch { /* not in extension context */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void init()); else void init();
