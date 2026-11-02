import type { VocabRecord } from '../types';
// VISUS Anki export — original implementation.
// Two paths, both user-triggered and local-first:
//  1) TSV file Anki can import via File > Import (no add-on needed).
//  2) AnkiConnect (http://127.0.0.1:8765) when the user runs Anki Desktop
//     with the AnkiConnect add-on. VISUS never contacts any other server.
const MAX_DECK_LEN = 80;
export function sanitizeDeckName(name: string): string {
  const clean = String(name ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_DECK_LEN);
  return clean || 'VISUS';
}
const cell = (v: string) => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>').slice(0, 4000);
export function toAnkiTsv(records: VocabRecord[], deckName = 'VISUS'): string {
  const deck = sanitizeDeckName(deckName);
  const header = ['#separator:tab', '#html:true', `#deck:${deck}`, '#columns:Front\tBack\tTags'].join('\n');
  const lines = records.slice(0, 50000).map(r => {
    const front = cell(r.word || r.lemma);
    const back = cell(r.customDefinition ?? r.lemma);
    const tags = `visus lang::${r.lang} status::${r.status}`.replace(/\s+/g, '_');
    return `${front}\t${back}\t${tags}`;
  });
  return [header, ...lines].join('\n') + '\n';
}
export interface AnkiConnectResult { ok: boolean; added: number; error?: string }
export async function sendToAnkiConnect(records: VocabRecord[], deckName = 'VISUS', fetchFn: typeof fetch = fetch): Promise<AnkiConnectResult> {
  const deck = sanitizeDeckName(deckName);
  const invoke = async (action: string, params: Record<string, unknown>) => {
    const res = await fetchFn('http://127.0.0.1:8765', { method: 'POST', body: JSON.stringify({ action, version: 6, params }) });
    if (!res.ok) throw new Error('AnkiConnect HTTP ' + res.status);
    const data = await res.json() as { error?: string | null; result?: unknown };
    if (data.error) throw new Error(String(data.error));
    return data.result;
  };
  try {
    await invoke('createDeck', { deck });
    const notes = records.slice(0, 50000).map(r => ({
      deckName: deck, modelName: 'Basic',
      fields: { Front: cell(r.word || r.lemma), Back: cell(r.customDefinition ?? r.lemma) },
      tags: ['visus', `lang::${r.lang}`, `status::${r.status}`],
    }));
    const result = await invoke('addNotes', { notes }) as unknown[];
    return { ok: true, added: Array.isArray(result) ? result.filter(x => x != null).length : notes.length };
  } catch (e) {
    return { ok: false, added: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
export function downloadAnkiTsv(records: VocabRecord[], deckName = 'VISUS') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toAnkiTsv(records, deckName)], { type: 'text/tab-separated-values' }));
  a.download = `visus-anki-${sanitizeDeckName(deckName).toLowerCase().replace(/\s+/g, '-')}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
