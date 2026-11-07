import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import type { LogEntry, LogKind } from '../sim/types';
import { formatDay } from '../sim/util';

export const KIND_STYLE: Record<LogKind, { name: string; dot: string; text: string }> = {
  op: { name: 'Операції', dot: 'bg-sky-400', text: 'text-sky-200' },
  diag: { name: 'Діагностика', dot: 'bg-violet-400', text: 'text-violet-200' },
  error: { name: 'Помилки', dot: 'bg-red-500', text: 'text-red-300' },
  success: { name: 'Успіх', dot: 'bg-emerald-400', text: 'text-emerald-200' },
  weather: { name: 'Погода', dot: 'bg-cyan-300', text: 'text-cyan-100' },
  warn: { name: 'Спостереження', dot: 'bg-amber-400', text: 'text-amber-200' },
  info: { name: 'Стан поля', dot: 'bg-slate-400', text: 'text-slate-200' },
  quest: { name: 'Виклики', dot: 'bg-orange-400', text: 'text-orange-200' },
};

export default function LogDock({ log, compact = false }: { log: LogEntry[]; compact?: boolean }) {
  const [off, setOff] = useState<Set<LogKind>>(new Set());
  const items = log.filter((l) => !off.has(l.kind)).slice(-250).reverse();
  const toggle = (k: LogKind) => {
    const n = new Set(off);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setOff(n);
  };
  return (
    <footer className={`mx-2 mb-2 flex ${compact ? 'h-28' : 'h-44'} shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80`}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-3 py-1.5">
        <span className="mr-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
          <ScrollText className="h-3.5 w-3.5" /> Бортовий журнал
        </span>
        {(Object.keys(KIND_STYLE) as LogKind[]).map((k) => (
          <button key={k} type="button" onClick={() => toggle(k)} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${off.has(k) ? 'border-slate-800 text-slate-600' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${KIND_STYLE[k].dot} ${off.has(k) ? 'opacity-30' : ''}`} />
            {KIND_STYLE[k].name}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-500">{log.length} записів</span>
      </div>
      <ol className="thin-scroll flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px]">
        {items.map((l) => (
          <li key={l.id} className="flex gap-2 border-b border-slate-800/60 py-0.5">
            <span className="w-32 shrink-0 text-slate-500">{formatDay(l.day, true)}</span>
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${KIND_STYLE[l.kind].dot}`} />
            <span className="min-w-0">
              <span className={`font-semibold ${KIND_STYLE[l.kind].text}`}>{l.title}</span>
              {l.text && <span className="text-slate-400"> — {l.text}</span>}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-slate-500">Записів немає.</li>}
      </ol>
    </footer>
  );
}
