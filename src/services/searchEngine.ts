// SearchEngineDetector — search results pages must never be processed.
// Detection combines: known domains (incl. regional), search URL patterns, and search-specific DOM structure.
// The URL check runs BEFORE any DOM processing in the content script.
const SEARCH_HOST_PATTERNS: RegExp[] = [
  /(^|\.)google\.[a-z.]+$/, /(^|\.)bing\.com$/, /(^|\.)search\.yahoo\.[a-z.]+$/, /(^|\.)yahoo\.[a-z.]+$/,
  /(^|\.)baidu\.com$/, /(^|\.)duckduckgo\.com$/, /(^|\.)html\.duckduckgo\.com$/, /(^|\.)startpage\.com$/,
  /(^|\.)ecosia\.org$/, /(^|\.)search\.brave\.com$/, /(^|\.)yandex\.[a-z.]+$/, /(^|\.)sogou\.com$/,
  /(^|\.)so\.com$/, /(^|\.)naver\.com$/, /(^|\.)search\.aol\.[a-z.]+$/, /(^|\.)ask\.com$/, /(^|\.)qwant\.com$/,
];
const SEARCH_PATH = /^(\/search|\/imghp|\/images|\/videos|\/news|\/maps|\/s\?|\/s$|\/web|\/spider|\/lite )/;
const SEARCH_PARAMS = ['q', 'query', 'wd', 'word', 'text', 'p', 'keyword', 'keywords', 'search_query'];
const SEARCH_DOM_SELECTORS = [
  '#search', '#b_results', '#web', '#center_col', '#rso', '[data-testid="results"]', '#results',
  'input[name="q"]', 'textarea[name="q"]', 'input[name="wd"]', 'input[name="p"]', 'form[role="search"]',
  '#b_content', '.gsc-results', '#search-results', '[aria-label="Search results"]',
];
function hostOf(url: string): string { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } }
export function isSearchEngineUrl(rawUrl: string): boolean {
  let u: URL; try { u = new URL(rawUrl); } catch { return false; }
  const host = u.hostname.toLowerCase();
  const hostMatch = SEARCH_HOST_PATTERNS.some(re => re.test(host));
  const isSearchHost = hostMatch && !/(^|\.)(mail|maps|drive|docs|news\.google)\./.test(host) || host.startsWith('search.');
  const hasQueryParam = SEARCH_PARAMS.some(p => u.searchParams.has(p));
  const path = u.pathname;
  if (isSearchHost && (hasQueryParam || SEARCH_PATH.test(path) || host === 'duckduckgo.com' || host === 'html.duckduckgo.com')) return true;
  // Google regional/search subpaths even when host list evolves.
  if (/google\./.test(host) && (path.startsWith('/search') || path.startsWith('/imghp') || hasQueryParam && path === '/')) return true;
  if (host.endsWith('bing.com') && (path.startsWith('/search') || path.startsWith('/images') || path.startsWith('/videos') || path.startsWith('/news'))) return true;
  if (host.includes('baidu.com') && (path.startsWith('/s') || hasQueryParam)) return true;
  if ((host.includes('duckduckgo.com')) && (hasQueryParam || path === '/' || path.startsWith('/lite') || path.startsWith('/html'))) return true;
  if (host.includes('yahoo.') && (path.startsWith('/search') || host.startsWith('search.'))) return true;
  return false;
}
export function hasSearchDomStructure(doc: Document = document): boolean {
  try { return SEARCH_DOM_SELECTORS.some(sel => doc.querySelector(sel)); } catch { return false; }
}
export function isSearchEnginePage(url: string, doc?: Document): boolean {
  if (isSearchEngineUrl(url)) return true;
  // Structural fallback: search box + results landmarks on an unrecognized/regional engine.
  if (doc && hasSearchDomStructure(doc)) {
    const hasSearchInput = !!doc.querySelector('input[name="q"], textarea[name="q"], input[type="search"], form[role="search"] input');
    const hasResults = !!doc.querySelector('#search, #rso, #b_results, #results, [data-testid="results"]');
    if (hasSearchInput && hasResults) return true;
  }
  return false;
}
export const SearchEngineDetector = { isSearchEngineUrl, isSearchEnginePage, hasSearchDomStructure };
