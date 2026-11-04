import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { toAnkiTsv, sanitizeDeckName } from '../../src/services/anki';
import { parseTimedText, detectVideoSite, normalizeCues } from '../../src/videos/sites';
import { nextReviewDue, isDue } from '../../src/services/srs';
import { listCbzPages } from '../../src/books/cbz';
import { t, UI_LANGS } from '../../src/i18n';
import { textDetectorSupported, ocrCanvas } from '../../src/services/ocr';
import { DictionaryService } from '../../src/services/dictionary';
import { translateLocally, shortGloss } from '../../src/services/localTranslate';
import { voiceCatalogue, pickVoice } from '../../src/services/voices';
import { AudioService } from '../../src/services/audio';
import type { VocabRecord } from '../../src/types';

const rec = (word: string): VocabRecord => ({ id: `fr:${word}`, lang: 'fr', word, lemma: word, status: 'l2', encounters: 3, firstSeen: 1, lastSeen: 2 });

describe('anki export (VISUS original)', () => {
  it('builds importable TSV with deck header and escaped cells', () => {
    const tsv = toAnkiTsv([rec('bon\tjour')], 'My Deck<>');
    expect(tsv).toContain('#separator:tab');
    expect(tsv).toContain('bon jour');
    expect(sanitizeDeckName('a<b>:c')).not.toMatch(/[<>:"/\\|?*]/);
    expect(sanitizeDeckName('')).toBe('VISUS');
  });
});

describe('timed-text video adapters', () => {
  it('parses WebVTT and SRT and detects sites', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nBonjour <i>monde</i>\n\n00:00:04.000 --> 00:00:06.000\nMerci';
    const cues = parseTimedText(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3, text: 'Bonjour monde' });
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHola\n';
    expect(parseTimedText(srt)[0].end).toBeCloseTo(2.5);
    expect(detectVideoSite('www.netflix.com')).toBe('netflix');
    expect(detectVideoSite('www.disneyplus.com')).toBe('disney');
    expect(detectVideoSite('www.crunchyroll.com')).toBe('crunchyroll');
    expect(detectVideoSite('www.youtube.com')).toBe('youtube');
    expect(detectVideoSite('example.com')).toBe('generic');
    expect(normalizeCues([{ start: 2, end: 1, text: 'bad' }, { start: 0, end: 1, text: 'ok' }])).toHaveLength(1);
  });
});

describe('srs schedule', () => {
  it('grows intervals and leaves queue on known', () => {
    const now = 1_000_000_000_000;
    expect(nextReviewDue('l1', now)! - now).toBe(86_400_000);
    expect(nextReviewDue('l4', now)! - now).toBe(21 * 86_400_000);
    expect(nextReviewDue('known', now)).toBeUndefined();
    expect(isDue(now - 1, now)).toBe(true);
    expect(isDue(now + 1000, now)).toBe(false);
  });
});

describe('cbz books', () => {
  it('lists image pages in read order', async () => {
    const zip = new JSZip();
    zip.file('page10.png', 'x'); zip.file('page2.png', 'x'); zip.file('notes.txt', 'x');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    expect(await listCbzPages(buf)).toEqual(['page2.png', 'page10.png']);
  });
});

describe('i18n chrome strings', () => {
  it('localises popup labels with English fallback', () => {
    expect(UI_LANGS).toContain('fr');
    expect(t('fr', 'review')).toBe('Révision');
    expect(t('xx', 'review')).toBe('Review');
  });
});

describe('additional language packs', () => {
  const cases: Array<[Parameters<typeof DictionaryService.lookup>[0], string]> = [
    ['sv', 'bok'], ['da', 'bog'], ['no', 'bok'], ['fi', 'kirja'], ['pl', 'książka'],
    ['uk', 'книга'], ['el', 'βιβλίο'], ['tr', 'kitap'], ['id', 'buku'], ['vi', 'sách'], ['th', 'หนังสือ'], ['yue', '書'],
  ];
  it('ships starter packs with lookup for book in every new language', async () => {
    for (const [lang, word] of cases) {
      expect(await DictionaryService.size(lang), lang).toBeGreaterThan(50);
      const e = await DictionaryService.lookup(lang, word);
      expect(e?.definition.toLowerCase(), `${lang}:${word}`).toContain('book');
    }
    expect(await DictionaryService.lookup('sv', 'zzzznotaword')).toBeUndefined();
  });
});

describe('offline local translation', () => {
  it('glosses from bundled dictionaries and keeps unknown words', async () => {
    expect(shortGloss('A book.')).toBe('book');
    const r = await translateLocally('le livre zzzz', 'fr', 'en');
    expect(r.text.toLowerCase()).toContain('book');
    expect(r.text).toContain('zzzz');
    expect(r.unknown).toContain('zzzz');
    expect(r.covered).toBeGreaterThanOrEqual(1);
  });
});

describe('local voice synthesis', () => {
  const fake = (name: string, lang: string, localService: boolean) => ({ name, lang, localService, default: false }) as unknown as SpeechSynthesisVoice;
  it('catalogues and prefers on-device voices', () => {
    const voices = [fake('Remote FR', 'fr-FR', false), fake('Local FR', 'fr-FR', true), fake('Local EN', 'en-US', true)];
    expect(voiceCatalogue('fr', voices).map(v => v.name)).toEqual(['Local FR', 'Remote FR']);
    expect(pickVoice('fr', '', voices, true)?.name).toBe('Local FR');
    expect(pickVoice('fr', 'Remote FR', voices, true)?.name).toBe('Local FR');
    expect(voiceCatalogue('fr', voices)[0].local).toBe(true);
  });
  it('speakQueue is a safe no-op without speech synthesis', async () => {
    if (!AudioService.supported()) expect(await AudioService.speakQueue([{ text: 'bonjour', lang: 'fr' }])).toBe(0);
  });
});

describe('unlimited vocabulary (no word cap)', () => {
  it('keeps tracking new words beyond 1000 in a language', async () => {
    const { idb } = await import('../../src/storage/db');
    const { VocabularyService } = await import('../../src/services/vocabulary');
    const { checkLicenseForNewWord, FREE_LIMIT } = await import('../../src/services/license');
    expect(FREE_LIMIT).toBe(Number.POSITIVE_INFINITY);
    await Promise.all(Array.from({ length: 1005 }, (_, i) => idb.put('vocab', { id: `en:seed${i}`, lang: 'en', word: `seed${i}`, lemma: `seed${i}`, status: 'new', encounters: 1, firstSeen: 1, lastSeen: 1 })));
    const gate = await checkLicenseForNewWord('en');
    expect(gate.allowed).toBe(true);
    expect(gate.count).toBeGreaterThanOrEqual(1005);
    const rec = await VocabularyService.encounter('en', 'unlimitedword');
    expect(rec.status).toBe('new');
  }, 30000);
});

describe('offline ocr', () => {
  it('reports unsupported browsers honestly', async () => {
    if (!textDetectorSupported()) await expect(ocrCanvas({} as HTMLCanvasElement)).rejects.toThrow(/not available/);
  });
});
