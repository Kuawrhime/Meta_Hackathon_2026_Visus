// VISUS premium rounded design tokens — single source of truth.
// Editorial identity: warm ivory, charcoal, muted terracotta, petrol blue.
export const COLORS = {
  ivory: '#fffaf0', paper: '#f4ecdb', charcoal: '#2b251d', charcoalSoft: '#37322a',
  terracotta: '#a9714b', terracottaDark: '#965f3a', petrol: '#2f6f8f', petrolDeep: '#0f4c5c',
  sand: '#ddd0b8', sandDark: '#57503f', muted: '#8a8171',
} as const;
export const RADII = { panel: 22, popup: 20, sidebar: 20, card: 16, button: 12, input: 12, pill: 999 } as const;
export const SHADOWS = {
  panel: '0 24px 60px rgba(43,37,29,.32), 0 4px 16px rgba(43,37,29,.18)',
  card: '0 8px 24px rgba(43,37,29,.10)',
  pill: '0 10px 28px rgba(43,37,29,.30)',
} as const;
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const TYPE = {
  serif: 'Georgia, "Songti SC", "Noto Serif CJK SC", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;
export const MOTION = { fast: '160ms ease', slow: '240ms ease' } as const;
export type WidgetState = { x?: number; y?: number; collapsed?: boolean; hidden?: boolean };
export function loadState<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...(JSON.parse(raw) as object) } as T : fallback; } catch { return fallback; }
}
export function saveState(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
