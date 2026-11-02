import type { LangCode, LangInfo } from '../types';
export const LANGUAGES: LangInfo[] = [
  { code:'en', name:'English', native:'English', segmenter:'space', ready:true },
  { code:'fr', name:'French', native:'Français', segmenter:'space', ready:true },
  { code:'es', name:'Spanish', native:'Español', segmenter:'space', ready:true },
  { code:'de', name:'German', native:'Deutsch', segmenter:'space', ready:true },
  { code:'it', name:'Italian', native:'Italiano', segmenter:'space', ready:true },
  { code:'pt', name:'Portuguese', native:'Português', segmenter:'space', ready:true },
  { code:'ja', name:'Japanese', native:'日本語', segmenter:'ja', ready:true },
  { code:'zh', name:'Chinese', native:'中文', segmenter:'dict-zh', ready:true },
  { code:'ko', name:'Korean', native:'한국어', segmenter:'ko', ready:true },
  { code:'ru', name:'Russian', native:'Русский', segmenter:'space', ready:true },
  { code:'nl', name:'Dutch', native:'Nederlands', segmenter:'space', ready:true },
  { code:'ar', name:'Arabic', native:'العربية', rtl:true, segmenter:'space', ready:true },
  { code:'yue', name:'Cantonese', native:'粵語', segmenter:'dict-zh', ready:true },
  { code:'th', name:'Thai', native:'ไทย', segmenter:'intl', ready:true },
  { code:'vi', name:'Vietnamese', native:'Tiếng Việt', segmenter:'space', ready:true },
  { code:'sv', name:'Swedish', native:'Svenska', segmenter:'space', ready:true },
  { code:'da', name:'Danish', native:'Dansk', segmenter:'space', ready:true },
  { code:'no', name:'Norwegian', native:'Norsk', segmenter:'space', ready:true },
  { code:'fi', name:'Finnish', native:'Suomi', segmenter:'space', ready:true },
  { code:'pl', name:'Polish', native:'Polski', segmenter:'space', ready:true },
  { code:'uk', name:'Ukrainian', native:'Українська', segmenter:'space', ready:true },
  { code:'el', name:'Greek', native:'Ελληνικά', segmenter:'space', ready:true },
  { code:'tr', name:'Turkish', native:'Türkçe', segmenter:'space', ready:true },
  { code:'id', name:'Indonesian', native:'Bahasa Indonesia', segmenter:'space', ready:true },
];
export const langInfo = (c: LangCode) => LANGUAGES.find(l => l.code === c) ?? LANGUAGES[0];
export const INTERFACE_LANGS = [
  { code:'en', name:'English' }, { code:'it', name:'Italiano' }, { code:'fr', name:'Français' },
  { code:'es', name:'Español' }, { code:'de', name:'Deutsch' }, { code:'pt', name:'Português' },
  { code:'ja', name:'日本語' }, { code:'zh', name:'中文' },
];
