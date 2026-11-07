import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { ZONES } from '../sim/data';
import type { ZoneId } from '../sim/types';
import { dayOf, formatDay } from '../sim/util';

export const SEASON_STARTS: { day: number; name: string; note: string }[] = [
  { day: dayOf(3, 1), name: 'Весняний сезон', note: 'сніготанення, ранні ярі, підживлення озимих' },
  { day: dayOf(4, 1), name: 'Квітень', note: 'фізична стиглість ґрунту, сівба ранніх ярих' },
  { day: dayOf(4, 25), name: 'Сівба пізніх ярих', note: 'кукурудза, соняшник, соя, буряк' },
  { day: dayOf(7, 20), name: 'Після збирання попередника', note: 'лущення, основний обробіток' },
  { day: dayOf(9, 1), name: 'Осінній сезон', note: 'сівба озимих → збирання наступного літа' },
];

export default function ResetModal({ zone, onClose, onConfirm }: { zone: ZoneId; onClose: () => void; onConfirm: (z: ZoneId, start: number) => void }) {
  const [z, setZ] = useState<ZoneId>(zone);
  const [start, setStart] = useState(SEASON_STARTS[0].day);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 text-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-50"><RotateCcw className="h-4 w-4 text-red-300" />Повне скидання — нове заняття</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Закрити"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 rounded-lg border border-red-900/60 bg-red-950/40 p-2 text-red-100">
          Буде очищено: стан поля, журнал, усі помилки, діагностики, виклики, історію «машини часу» та дані атестаційного звіту.
        </p>
        <div className="mb-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Ґрунтово-кліматична зона</div>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(ZONES) as ZoneId[]).map((k) => (
              <button key={k} type="button" onClick={() => setZ(k)} className={`rounded-lg border p-2 text-left ${z === k ? 'border-emerald-500/70 bg-emerald-600/15' : 'border-slate-800 hover:border-slate-600'}`}>
                <div className="font-semibold text-slate-100">{ZONES[k].name}</div>
                <div className="text-[10px] text-slate-400">{ZONES[k].soil}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Дата початку сезону (шкала часу — 2 роки від неї)</div>
          <div className="flex flex-col gap-1">
            {SEASON_STARTS.map((o) => (
              <label key={o.day} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 ${start === o.day ? 'border-emerald-500/70 bg-emerald-600/15' : 'border-slate-800 hover:border-slate-600'}`}>
                <input type="radio" name="start" checked={start === o.day} onChange={() => setStart(o.day)} className="accent-emerald-500" />
                <span className="w-24 font-mono text-emerald-200">{formatDay(o.day)}</span>
                <span className="font-semibold text-slate-100">{o.name}</span>
                <span className="text-slate-400">— {o.note}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-2 hover:bg-slate-700">Скасувати</button>
          <button type="button" onClick={() => onConfirm(z, start)} className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white hover:bg-red-600">Скинути все й почати</button>
        </div>
      </div>
    </div>
  );
}
