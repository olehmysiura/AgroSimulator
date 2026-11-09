import { BarChart3, FlaskConical, Layers, Mountain, ScrollText, Sprout, Swords } from 'lucide-react';
import type { ReactNode } from 'react';

export type Section = 'field' | 'lab' | 'quests' | 'plant' | 'soil' | 'yield' | 'log';

const ITEMS: [Section, string, ReactNode][] = [
  ['field', 'Поле', <Layers key="i" className="h-5 w-5" />],
  ['lab', 'Лабораторія', <FlaskConical key="i" className="h-5 w-5" />],
  ['quests', 'Виклики', <Swords key="i" className="h-5 w-5" />],
  ['plant', 'Рослина', <Sprout key="i" className="h-5 w-5" />],
  ['soil', 'Ґрунт', <Mountain key="i" className="h-5 w-5" />],
  ['yield', 'Урожай', <BarChart3 key="i" className="h-5 w-5" />],
  ['log', 'Журнал', <ScrollText key="i" className="h-5 w-5" />],
];

/** Вузька смуга розділів: кожен розділ має власні панелі. */
export default function NavRail({ section, onChange, badges }: { section: Section; onChange: (s: Section) => void; badges: Partial<Record<Section, number | boolean>> }) {
  return (
    <nav aria-label="Розділи" className="flex shrink-0 gap-1 overflow-x-auto border-slate-800 bg-slate-950 p-1.5 xl:w-[72px] xl:flex-col xl:overflow-visible xl:border-r">
      {ITEMS.map(([id, name, icon]) => {
        const b = badges[id];
        return (
          <button key={id} type="button" onClick={() => onChange(id)} title={name} className={`relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium leading-tight transition ${section === id ? 'bg-emerald-600/25 text-emerald-100 ring-1 ring-emerald-500/60' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            {icon}
            {name}
            {b ? <span className="absolute right-1.5 top-1 grid min-h-[14px] min-w-[14px] place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">{typeof b === 'number' ? b : ''}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
