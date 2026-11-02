// LanguageFilterService — the user's selected learning language is the single source of truth.
// Text is classified per block/sentence (Unicode script + stopword evidence) and only matching
// blocks are ever sent to the highlighting engine. Low-confidence blocks are ignored.
import type { LangCode } from '../types';

export interface LangGuess { lang: LangCode | 'unknown' | 'number' | 'url'; confidence: number; script: string; }
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const HIRAGANA = /[\u3040-\u309f]/g; const KATAKANA = /[\u30a0-\u30ff]/g;
const HANGUL = /[\uac00-\ud7a3]/g; const ARABIC = /[\u0600-\u06ff]/g; const CYRILLIC = /[\u0400-\u04ff]/g;
const LETTERS = /\p{L}/gu;
const STOPWORDS: Partial<Record<LangCode, Set<string>>> = {
  en: new Set('the,and,is,of,to,in,that,it,was,for,on,are,with,as,have,be,this,will,my,one,had,what,were,your,when,there,use,each,which,she,how,their,other,about,out,many,then,them,these,some,her,would,make,like,him,into,time,has,look,two,more,go,see,no,way,could,people,first,water,been,call,who,now,find,long,down,day,did,get,come,made,may,an,by,or,not,are,were,been,being,am'.split(',')),
  fr: new Set('le,la,les,de,des,du,un,une,et,est,à,au,aux,je,tu,il,elle,nous,vous,ils,elles,ce,cette,ces,qui,que,dans,sur,pour,pas,plus,être,avoir,faire,comme,aussi,très,chez,mais,ou,où,donc,alors,quand,même,après,avant,entre,école,les,des,une,aux,ces,était,sont,ont,avec,sans,sous,chez,très,peu,bien,peut,faire,dire,aller,voir,savoir,pouvoir,vouloir,venir,prendre,donner,trouver,parler,aimer'.split(',')),
  es: new Set('el,la,los,las,un,una,unos,unas,de,del,al,y,o,en,con,por,para,que,se,su,como,más,pero,sus,le,ya,este,sí,porque,esta,él,son,entre,cuando,muy,sin,sobre,también,me,hasta,hay,donde,quien,desde,todo,es,están,una,los,del,las,por,para,con,más,pero,este,esta,esto,ese,esa,eso,mi,tu,su,nuestro,vuestro,their'.split(',')),
  de: new Set('der,die,das,den,dem,des,ein,eine,einer,einem,einen,und,ist,ich,du,er,sie,es,wir,ihr,nicht,mit,von,zu,sich,auf,für,im,dem,von,als,auch,an,werden,aus,hat,dass,nach,wird,bei,um,am,sind,noch,wie,über,einen,so,zum,haben,nur,oder,aber,vor,sein,haben,werden,können,müssen,sollen,wollen,machen,sagen,gehen,sehen,wissen,geben,finden,sprechen,lernen,schule,arbeit,zeit,tag,haus,buch'.split(',')),
  it: new Set('il,lo,la,i,gli,le,un,uno,una,di,a,da,in,con,su,per,tra,che,e,è,non,si,come,ma,anche,se,del,della,dello,dei,delle,al,alla,allo,ai,alle,nel,nella,questo,questa,questi,queste,essere,avere,fare,quando,molto,senza,sotto,sopra,dopo,prima,lui,lei,noi,voi,loro,io,tu,sono,stato,essere,anche,così,già,più,può,deve,voglio,andare,vedere,sapere,potere,volere,venire,prendere,dare,trovare,parlare'.split(',')),
  pt: new Set('o,a,os,as,um,uma,uns,umas,de,do,da,dos,das,em,no,na,nos,nas,por,pelo,pela,pelos,pelas,para,com,sem,que,e,é,ser,estar,ter,como,mais,mas,ao,à,se,não,muito,quando,também,sobre,entre,depois,antes,ele,ela,nós,vocês,eles,elas,isso,este,esta,estes,estas,ser,estar,ter,fazer,dizer,ir,ver,saber,poder,querer,vir,aprender,escola,livro,casa,tempo,dia'.split(',')),
  nl: new Set('de,het,een,en,van,ik,te,dat,die,in,hij,niet,zijn,is,op,aan,met,als,voor,had,er,maar,naar,heb,je,zijn,was,aan,hij,met,zij,niet,er,ook,als,bij,nog,wel,nu,uit,over,tot,door,worden,zou,hebben,kunnen,moeten,willen,maken,zeggen,gaan,zien,weten,komen,nemen,geven,vinden,spreken,leren,school,boek,huis,tijd,dag,werk,stad,land'.split(',')),
  ru: new Set('в,на,и,что,не,он,с,как,а,то,все,она,так,его,но,да,ты,к,у,же,вы,за,бы,по,только,её,мне,было,вот,от,меня,ещё,нет,о,из,ему,теперь,когда,даже,ну,вдруг,ли,если,уже,или,ни,быть,был,него,до,вас,нибудь,уж,вам,сказал,ведь,там,потом,себя,ничего,ей,может,они,тут,где,есть,надо,ней,для,мы,тебя,их,чем,была,сам,чтоб,без,будто,чего,раз,тоже,себе,под,будет,ж,тогда,кто,этот,того,потому,этого,какой,совсем,ним,здесь,этом,один,почти,мой,тем,чтобы,нее,сейчас,были,куда,зачем,всех,никогда,можно,при,наконец,два,об,другой,хоть,после,над,больше,тот,через,эти,нас,про,всего,них,какая,много,разве,только,три,эту,моя,впрочем,хорошо,свою,этой,перед,иногда,лучше,чуть,том,нельзя,такой,им,более,всегда,конечно,всю,между'.split(',')),
};
const ACCENTS: Partial<Record<LangCode, RegExp>> = {
  fr: /[àâçéèêëîïôûùÿœæ]/gi, es: /[ñáéíóúü¿¡]/gi, de: /[äöüß]/gi, it: /[àèéìòù]/gi, pt: /[ãõáéíóúç]/gi, nl: /[ëïé]/gi,
};
const count = (t: string, re: RegExp) => (t.match(re) ?? []).length;
export function classifyText(text: string): LangGuess {
  const t = text.trim();
  if (!t) return { lang: 'unknown', confidence: 0, script: 'none' };
  if (/^(https?:\/\/|www\.)/i.test(t) || /^\S+@\S+\.\S+$/.test(t)) return { lang: 'url', confidence: 1, script: 'url' };
  const letters = count(t, LETTERS); if (letters === 0) return { lang: 'number', confidence: 1, script: 'none' };
  const han = count(t, HAN), kana = count(t, HIRAGANA) + count(t, KATAKANA), hangul = count(t, HANGUL), arabic = count(t, ARABIC), cyr = count(t, CYRILLIC);
  const cjk = han + kana;
  if (hangul / letters > 0.3) return { lang: 'ko', confidence: Math.min(1, hangul / letters + 0.3), script: 'hangul' };
  if (kana > 0 && cjk / letters > 0.25) return { lang: 'ja', confidence: Math.min(1, (kana + han) / letters + 0.2), script: 'kana' };
  if (han / letters > 0.3) {
    // Han without kana: Chinese. Isolated single Han characters are ambiguous — require context (>=2 chars or known word context handled downstream).
    return { lang: 'zh', confidence: han >= 2 ? Math.min(1, han / letters + 0.25) : 0.45, script: 'han' };
  }
  if (han > 0 && han / letters > 0.12) return { lang: 'zh', confidence: 0.5, script: 'han-mixed' };
  if (arabic / letters > 0.3) return { lang: 'ar', confidence: Math.min(1, arabic / letters + 0.25), script: 'arabic' };
  if (cyr / letters > 0.3) {
    const ukr = /[іїєґІЇЄҐ]/.test(t);
    return { lang: ukr ? 'uk' : 'ru', confidence: Math.min(1, cyr / letters + 0.25), script: 'cyrillic' };
  }
  // Latin-script languages: stopword + accent evidence.
  const words = t.toLowerCase().replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
  if (words.length < 2) return { lang: 'unknown', confidence: 0.2, script: 'latin' };
  const scores: Array<{ lang: LangCode; score: number }> = [];
  for (const [code, set] of Object.entries(STOPWORDS) as Array<[LangCode, Set<string>]>) {
    if (!set) continue;
    let s = words.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0);
    const acc = ACCENTS[code]; if (acc) s += count(t, acc) * 0.8;
    if (code === 'en') s += words.filter(w => /^(the|and|is|are|was|were|have|has|will|would|this|that|with|from|they|them|then|than)$/.test(w)).length * 0.4;
    scores.push({ lang: code, score: s / Math.sqrt(words.length) });
  }
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0], second = scores[1];
  if (!top || top.score < 0.55) return { lang: 'unknown', confidence: Math.min(0.5, top?.score ?? 0), script: 'latin' };
  const margin = second ? top.score - second.score : top.score;
  const confidence = Math.min(1, top.score / 2 + (margin > 0.25 ? 0.25 : 0));
  return { lang: top.lang, confidence, script: 'latin' };
}
/** Strict gate: only text classified as the learning language (with confidence) may be highlighted. */
export function shouldProcessText(text: string, learning: LangCode, minConfidence = 0.5): boolean {
  if (!text || text.trim().length < 2) return false;
  const g = classifyText(text);
  if (g.lang === 'number' || g.lang === 'url' || g.lang === 'unknown') return false;
  // Chinese <-> Japanese disambiguation: kana means Japanese; han-only means Chinese.
  if (learning === 'zh' || learning === 'yue') return g.lang === 'zh' && g.confidence >= 0.45;
  if (learning === 'ja') return g.lang === 'ja' && g.confidence >= minConfidence;
  return g.lang === learning && g.confidence >= minConfidence;
}
export function scriptOfToken(token: string): string {
  if (HAN.test(token)) return 'han'; HAN.lastIndex = 0;
  if (/[\u3040-\u30ff]/.test(token)) return 'kana';
  if (/[\uac00-\ud7a3]/.test(token)) return 'hangul';
  if (/[\u0600-\u06ff]/.test(token)) return 'arabic';
  if (/[\u0400-\u04ff]/.test(token)) return 'cyrillic';
  return 'latin';
}
/** Token-level guard used inside mixed blocks (e.g. a Chinese sentence inside an English page). */
export function tokenMatchesLearning(token: string, learning: LangCode): boolean {
  if (/^\d[\d.,:%/-]*$/.test(token)) return false; // numbers ignored
  if (/^(https?:|www\.|@)/i.test(token) || token.includes('://')) return false; // URLs ignored
  const s = scriptOfToken(token);
  switch (s) {
    case 'han': return learning === 'zh' || learning === 'yue' || learning === 'ja';
    case 'kana': return learning === 'ja';
    case 'hangul': return learning === 'ko';
    case 'arabic': return learning === 'ar';
    case 'cyrillic': return learning === 'ru' || learning === 'uk';
    default: return !['zh', 'yue', 'ja', 'ko', 'ar', 'ru', 'uk'].includes(learning);
  }
}
export const LanguageFilterService = { classifyText, shouldProcessText, tokenMatchesLearning };
