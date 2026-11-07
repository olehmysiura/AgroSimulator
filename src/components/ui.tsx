import type { ReactNode } from 'react';

export function Panel({ title, icon, children, className = '' }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/80 ${className}`}>
      <h2 className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
        {icon}
        {title}
      </h2>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, icon, tone = 'slate', sub }: { label: string; value: ReactNode; unit?: string; icon?: ReactNode; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'sky'; sub?: ReactNode }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-100',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    red: 'text-red-400',
    sky: 'text-sky-300',
  };
  return (
    <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`font-mono text-[15px] font-semibold leading-tight ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-normal text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="truncate text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Btn({ children, onClick, tone = 'default', active, disabled, className = '', title }: { children: ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger' | 'ghost'; active?: boolean; disabled?: boolean; className?: string; title?: string }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
  const tones: Record<string, string> = {
    default: active ? 'bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/60' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500',
    danger: 'bg-red-900/60 text-red-100 ring-1 ring-red-700/60 hover:bg-red-800/70',
    ghost: 'text-slate-300 hover:bg-slate-800',
  };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`${base} ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}
