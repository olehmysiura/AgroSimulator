import { CloudLightning, CloudSun, Dice5, FlaskConical, Grid3x3, Microscope, Satellite, Shovel, Snowflake, Sun, Target, Wind, Drill, ScanLine, Swords } from 'lucide-react';
import type { ReactNode } from 'react';
import { TOOLS } from '../sim/data';
import { QUESTS } from '../sim/quests';
import type { Action } from '../sim/reducer';
import type { ClimateMode, QuestId, SimState, ToolId } from '../sim/types';
import { formatDay } from '../sim/util';
import { Panel } from './ui';

const TOOL_ICONS: Record<ToolId, ReactNode> = {
  penetrometer: <Drill className="h-4 w-4" />,
  auger: <ScanLine className="h-4 w-4" />,
  frame: <Grid3x3 className="h-4 w-4" />,
  shovel: <Shovel className="h-4 w-4" />,
  lens: <Microscope className="h-4 w-4" />,
  ndvi: <Satellite className="h-4 w-4" />,
};

const CLIMATES: { id: ClimateMode; name: string; icon: ReactNode }[] = [
  { id: 'normal', name: 'Норма', icon: <CloudSun className="h-3.5 w-3.5" /> },
  { id: 'storm', name: 'Злива', icon: <CloudLightning className="h-3.5 w-3.5" /> },
  { id: 'drought', name: 'Посуха', icon: <Sun className="h-3.5 w-3.5" /> },
  { id: 'frost', name: 'Приморозок −2 °C', icon: <Snowflake className="h-3.5 w-3.5" /> },
  { id: 'wind', name: 'Вітер 9,5 м/с', icon: <Wind className="h-3.5 w-3.5" /> },
];

const QUEST_ORDER: QuestId[] = ['crust', 'frost', 'pan', 'septoria'];

export default function LabPanel({ state: s, act, openTool }: { state: SimState; act: (a: Action) => void; openTool: (t: ToolId) => void }) {
  const q = s.quest;
  return (
    <aside className="thin-scroll flex w-full shrink-0 flex-col gap-2 overflow-y-auto xl:w-72">
      <Panel title="Лабораторія досліджень" icon={<FlaskConical className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(TOOLS) as ToolId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => openTool(t)}
              className="group flex flex-col items-start gap-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-left transition hover:border-emerald-600/60 hover:bg-slate-800"
            >
              <span className="text-emerald-300 group-hover:text-emerald-200">{TOOL_ICONS[t]}</span>
              <span className="text-[11px] font-medium leading-tight text-slate-200">{TOOLS[t].short}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Ситуаційні виклики" icon={<Swords className="h-3.5 w-3.5" />}>
        <div className="flex flex-col gap-1">
          {QUEST_ORDER.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => act({ type: 'quest', id })}
              className={`rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug transition ${q?.id === id ? 'border-amber-500/70 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'}`}
            >
              <span className="mr-1 font-mono text-amber-400">{i + 1}.</span>
              {QUESTS[id].title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => act({ type: 'quest', id: QUEST_ORDER[Math.floor(Math.random() * 4)] })}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 px-2 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-600/30"
          >
            <Dice5 className="h-3.5 w-3.5" /> Випадковий виклик
          </button>
        </div>
      </Panel>

      {q && (
        <section className={`rounded-xl border p-2.5 ${q.solved ? 'border-emerald-600/60 bg-emerald-950/40' : q.failed ? 'border-red-700/60 bg-red-950/40' : 'border-amber-600/60 bg-amber-950/30'}`}>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            <Target className="h-3.5 w-3.5" /> Поле: виклик з {formatDay(q.startDay)}
          </div>
          <div className="mb-1.5 text-xs font-semibold text-slate-100">{QUESTS[q.id].title}</div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-slate-300">
            {QUESTS[q.id].symptoms.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="mt-2 text-[11px] font-semibold">
            {q.solved ? <span className="text-emerald-300">✔ Ситуацію розв'язано</span> : q.failed ? <span className="text-red-300">✖ Виклик провалено</span> : <span className="text-amber-200">Статус: очікує рішення агронома</span>}
          </div>
        </section>
      )}

      <Panel title="Кліматичний режим" icon={<CloudSun className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-1">
          {CLIMATES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => act({ type: 'climate', mode: c.id })}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition ${s.climate === c.id ? 'bg-sky-600/30 text-sky-100 ring-1 ring-sky-500/60' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'} ${c.id === 'normal' ? 'col-span-2' : ''}`}
            >
              {c.icon}
              {c.name}
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  );
}
