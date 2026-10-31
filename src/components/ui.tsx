import React from 'react';
import type { WordStatus } from '../types';
import { STATUS_LABEL } from '../types';
// VISUS premium rounded design system (see src/design/tokens.ts).
// Editorial serif for headings, clean sans for controls. Radii:
// panels 20-24, cards 14-18, buttons/inputs 10-14, badges pill.
export const Button = ({ children, onClick, variant = 'primary', className = '', disabled }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'ghost'|'danger'|'soft'; className?: string; disabled?: boolean }) => {
  const styles = { primary: 'bg-[#a9714b] text-[#fff7ea] hover:bg-[#965f3a] shadow-[0_6px_18px_rgba(169,113,75,.35)]', ghost: 'hover:bg-[#2b251d]/5 dark:hover:bg-white/10', danger: 'bg-red-700 text-white hover:bg-red-800', soft: 'border border-[#ddd0b8] dark:border-[#57503f] hover:bg-[#2b251d]/5 dark:hover:bg-white/10 bg-[#fffaf0]/60 dark:bg-white/[.04]' }[variant];
  return <button disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${styles} ${className}`}>{children}</button>;
};
export const RoundedButton = Button;
export const IconButton = ({ children, onClick, label, className = '' }: { children: React.ReactNode; onClick?: () => void; label: string; className?: string }) => (
  <button aria-label={label} title={label} onClick={onClick} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0]/70 dark:bg-white/[.05] transition hover:bg-[#a9714b] hover:text-[#fff7ea] focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${className}`}>{children}</button>
);
export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`rounded-2xl border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0]/60 dark:bg-white/[.03] shadow-[0_8px_24px_rgba(43,37,29,.08)] px-4 py-4 ${className}`}>{children}</div>;
export const RoundedPanel = Card;
export const FloatingPanel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`rounded-[22px] border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0] dark:bg-[#37322a] shadow-[0_24px_60px_rgba(43,37,29,.25)] p-5 ${className}`}>{children}</div>;
export const StatusBadge = ({ status, children }: { status?: WordStatus; children?: React.ReactNode }) => {
  const bg = status === 'new' ? '#bfdbfe' : status === 'l1' ? '#fde047' : status === 'l2' ? '#fef08a' : status === 'l3' ? '#fef9c3' : status === 'known' ? '#2f6f8f' : '#e7dcc4';
  const fg = status === 'known' ? '#fff7ea' : '#2b251d';
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{children ?? (status ? STATUS_LABEL[status] : '')}</span>;
};
export const SegmentedControl = <T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) => (
  <div role="tablist" className="inline-flex rounded-full border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0]/70 dark:bg-white/[.05] p-1 gap-1">
    {options.map(o => <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${value === o.value ? 'bg-[#a9714b] text-[#fff7ea] shadow' : 'hover:bg-[#2b251d]/5 dark:hover:bg-white/10'}`}>{o.label}</button>)}
  </div>
);
export const VocabularyLevelSelector = ({ status, onGrade }: { status: WordStatus; onGrade: (s: WordStatus) => void }) => (
  <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Learning level">
    {(['l1', 'l2', 'l3', 'l4', 'known', 'ignored'] as WordStatus[]).map((s, i) => (
      <button key={s} onClick={() => onGrade(s)} aria-pressed={status === s} className={`rounded-xl border px-1 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${status === s ? 'bg-[#a9714b] text-[#fff7ea] border-[#a9714b]' : 'border-[#ddd0b8] dark:border-[#57503f] hover:bg-[#a9714b] hover:text-[#fff7ea]'}`}>{s === 'known' ? 'Known' : s === 'ignored' ? 'Ignore' : `L${i + 1}`}</button>
    ))}
  </div>
);
export const ProgressIndicator = ({ value, max = 100, label }: { value: number; max?: number; label?: string }) => {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return <div><div className="h-2.5 rounded-full bg-[#ddd0b8] dark:bg-[#57503f] overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className="h-full rounded-full bg-[#a9714b] transition-all duration-300" style={{ width: `${pct}%` }} /></div>{label && <p className="text-[11px] text-zinc-500 mt-1">{label} · {Math.round(pct)}%</p>}</div>;
};
export const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => <span title={text} className="inline-flex">{children}</span>;
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`rounded-xl border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0]/70 dark:bg-white/[.04] px-3 py-2 text-sm w-full focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${p.className ?? ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`rounded-xl border border-[#ddd0b8] dark:border-[#57503f] bg-[#fffaf0] dark:bg-[#403a30] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${p.className ?? ''}`} />;
export const Label = ({ children }: { children: React.ReactNode }) => <label className="text-[11px] font-semibold tracking-[.18em] uppercase text-zinc-500 dark:text-zinc-400 block mb-1 mt-2">{children}</label>;
export const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label className="flex items-center justify-between gap-3 py-2 cursor-pointer text-sm border-b border-[#e7dcc4] dark:border-[#4c4636]"><span>{label}</span>
    <button role="switch" aria-checked={checked} onClick={e => { e.preventDefault(); onChange(!checked); }} className={`h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-[#2f6f8f] ${checked ? 'bg-[#a9714b]' : 'bg-zinc-300 dark:bg-zinc-700'}`}><span className={`block h-5 w-5 rounded-full bg-white transition translate-x-${checked ? '5' : '0'} ml-0.5`} /></button></label>
);
export const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="border-l border-[#ddd0b8] dark:border-[#57503f] pl-4 first:border-0 first:pl-0"><div className="v-statnum">{value}</div><div className="v-statlabel">{label}</div>{sub && <div className="text-xs text-[#a9714b] mt-1">{sub}</div>}</div>
);
export const BarChart = ({ data, color = '#a79c8a', height = 90 }: { data: Array<{ label: string; value: number }>; color?: string; height?: number }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  return <div className="flex items-end gap-1" style={{ height }}>{data.map((d, i) => <div key={i} className="flex-1 flex flex-col items-center gap-1"><div title={`${d.label}: ${d.value}`} className="w-full rounded-t-md" style={{ height: `${Math.max(2, (d.value / max) * (height - 18))}px`, background: color }} />{data.length <= 8 && <span className="text-[9px] text-zinc-400">{d.label.slice(5)}</span>}</div>)}</div>;
};
