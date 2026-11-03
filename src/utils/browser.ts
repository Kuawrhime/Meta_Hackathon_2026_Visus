// Cross-browser WebExtensions compatibility layer (Chrome MV3 / Firefox / Edge / Brave).
// Uses webextension-polyfill semantics via chrome.* promise wrappers; falls back to mocks in tests/pages.
type AnyApi = Record<string, any>;
function rawApi(): AnyApi | null {
  const g = globalThis as AnyApi;
  if (g.chrome?.storage) return g.chrome;
  if (g.browser?.storage) return g.browser;
  return null;
}
function promisify(fn: (...a: any[]) => void, thisArg: unknown, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    try { fn.call(thisArg, ...args, (res: any) => { const e = (globalThis as AnyApi).chrome?.runtime?.lastError; e ? reject(new Error(e.message)) : resolve(res); }); }
    catch (e) { reject(e); }
  });
}
export const isExtensionContext = () => !!rawApi()?.runtime?.id;
export const browserKind = (): 'firefox'|'chrome'|'edge'|'brave'|'unknown' => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Edg\//.test(ua)) return 'edge';
  return 'chrome';
};
const memStorage: Record<string, unknown> = {};
export const extStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    const api = rawApi();
    if (!api?.storage?.local) return memStorage[key] as T;
    try { const r = api.storage.local.get.length >= 2 ? await promisify(api.storage.local.get, api.storage.local, [key]) : await api.storage.local.get([key]); return r?.[key] as T; }
    catch { return memStorage[key] as T; }
  },
  async set(key: string, value: unknown): Promise<void> {
    memStorage[key] = value;
    const api = rawApi(); if (!api?.storage?.local) { try { localStorage.setItem('lf:' + key, JSON.stringify(value)); } catch { /* noop */ } return; }
    try { api.storage.local.set.length >= 2 ? await promisify(api.storage.local.set, api.storage.local, { [key]: value }) : await api.storage.local.set({ [key]: value }); } catch { /* noop */ }
  },
  async remove(key: string): Promise<void> { delete memStorage[key]; const api = rawApi(); try { await api?.storage?.local?.remove?.(key); } catch { /* noop */ } },
};
export function sendMessage(msg: unknown): Promise<any> {
  const api = rawApi();
  if (!api?.runtime?.sendMessage) return Promise.resolve(undefined);
  try { const r = api.runtime.sendMessage(msg); return Promise.resolve(r).catch(() => undefined); } catch { return Promise.resolve(undefined); }
}
export function onMessage(handler: (msg: any, sender: any) => unknown): void {
  const api = rawApi(); api?.runtime?.onMessage?.addListener?.((m: any, s: any, respond: any) => { const out = handler(m, s); if (out instanceof Promise) { out.then(v => { try { respond(v); } catch { /* noop */ } }); return true; } try { return out; } catch { return undefined; } });
}
export function extensionUrl(path: string): string {
  const api = rawApi();
  try { return api?.runtime?.getURL ? api.runtime.getURL(path) : path; } catch { return path; }
}
