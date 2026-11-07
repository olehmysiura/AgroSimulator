import { OctagonAlert, X } from 'lucide-react';
import type { Mistake } from '../sim/types';
import { formatDay } from '../sim/util';

export default function ErrorPanel({ errors, onClose }: { errors: Mistake[]; onClose: () => void }) {
  if (!errors.length) return null;
  return (
    <div className="thin-scroll absolute inset-x-2 top-2 z-20 max-h-[78%] overflow-y-auto rounded-xl border-2 border-red-600 bg-red-950/95 shadow-2xl shadow-red-900/50 backdrop-blur" role="alert">
      <div className="sticky top-0 flex items-center gap-2 border-b border-red-800 bg-red-900/95 px-3 py-2">
        <OctagonAlert className="h-5 w-5 text-red-200" />
        <h3 className="text-sm font-black uppercase tracking-wider text-red-50">Розбір агрономічної помилки</h3>
        <span className="rounded bg-red-700 px-1.5 text-[10px] font-bold text-white">{errors.length}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded-md p-1 text-red-200 hover:bg-red-800" aria-label="Закрити">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-y divide-red-900">
        {errors.map((e) => (
          <article key={e.id} className="space-y-1.5 px-3 py-2.5 text-xs leading-relaxed">
            <div className="text-[10px] text-red-300">{formatDay(e.day)}</div>
            <p><span className="font-bold text-red-200">Що зроблено неправильно: </span><span className="font-semibold text-white">{e.action}</span></p>
            <p><span className="font-bold text-red-200">Фізико-біологічна причина: </span><span className="text-red-50/90">{e.cause}</span></p>
            <p><span className="font-bold text-red-200">Наслідки для поля та рослини: </span><span className="text-red-50/90">{e.consequence}</span></p>
          </article>
        ))}
      </div>
    </div>
  );
}
