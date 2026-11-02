import { useEffect, useState } from 'react';
import type { Settings } from '../types';
import { SettingsService, DEFAULT_SETTINGS } from '../services/settings';
export function useSettings(): [Settings, (p: Partial<Settings>) => Promise<void>, boolean] {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    SettingsService.get().then(v => { if (live) { setS(v); setReady(true); } });
    const unsub = SettingsService.subscribe(v => setS({ ...v }));
    return () => { live = false; unsub(); };
  }, []);
  useEffect(() => {
    const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [s.theme]);
  return [s, async p => { setS(await SettingsService.set(p)); }, ready];
}
