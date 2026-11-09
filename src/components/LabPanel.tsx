// Розділи «Лабораторія» та «Виклики», а також компактні елементи для розділу «Поле».
import {
  Bug, ChevronDown, ChevronUp, CloudDrizzle, CloudLightning, CloudSun, Dice5, Drill, Droplets, Eye, EyeOff, Flame, GraduationCap, Grid3x3,
  Microscope, Radio, Satellite, ScanLine, Shovel, Snowflake, Sun, Target, TestTubes, Thermometer, Wind,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { TOOLS, ZONES } from '../sim/data';
import { QUESTS, QUEST_ORDER } from '../sim/quests';
import { CLIMATE_NAMES, type Action } from '../sim/reducer';
import type { ClimateMode, SimState, ToolId } from '../sim/types';
import { formatDay } from '../sim/util';

const TOOL_ICONS: Record<ToolId, ReactNode> = {
  penetrometer: <Drill className="h-6 w-6" />,
  auger: <ScanLine className="h-6 w-6" />,
  frame: <Grid3x3 className="h-6 w-6" />,
  shovel: <Shovel className="h-6 w-6" />,
  lens: <Microscope className="h-6 w-6" />,
  ndvi: <Satellite className="h-6 w-6" />,
  thermometer: <Thermometer className="h-6 w-6" />,
  infiltrometer: <Droplets className="h-6 w-6" />,
  traps: <Bug className="h-6 w-6" />,
  agrolab: <TestTubes className="h-6 w-6" />,
  meteo: <Radio className="h-6 w-6" />,
};
const TOOL_GROUPS: { name: string; tools: ToolId[] }[] = [
  { name: 'Ґрунт', tools: ['penetrometer', 'auger', 'thermometer', 'infiltrometer', 'agrolab'] },
  { name: 'Посів і рослини', tools: ['frame', 'shovel', 'lens', 'ndvi'] },
  { name: 'Шкідники та погода', tools: ['traps', 'meteo'] },
];

const CLIMATE_ICONS: Record<ClimateMode, ReactNode> = {
  normal: <CloudSun className="h-3.5 w-3.5" />,
  storm: <CloudLightning className="h-3.5 w-3.5" />,
  rainy: <CloudDrizzle className="h-3.5 w-3.5" />,
  drought: <Sun className="h-3.5 w-3.5" />,
  heat: <Flame className="h-3.5 w-3.5" />,
  frost: <Snowflake className="h-3.5 w-3.5" />,
  wind: <Wind className="h-3.5 w-3.5" />,
};
const CLIMATE_ORDER: ClimateMode[] = ['normal', 'storm', 'rainy', 'drought', 'heat', 'frost', 'wind'];
const LEVEL = ['', 'базовий', 'середній', 'складний'];

// --------------------------------------------------------------------------- розділ «Лабораторія»
export function LabView({ openTool }: { openTool: (t: ToolId) => void }) {
  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h2 className="text-base font-bold text-slate-50">Лабораторія досліджень агронома</h2>
          <p className="text-xs text-slate-400">Оберіть прилад — результати вимірювання відкриються у вікні. Кожне використання фіксується в журналі та звіті.</p>
        </header>
        {TOOL_GROUPS.map((g) => (
          <section key={g.name}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">{g.name}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.tools.map((t) => (
                <button key={t} type="button" onClick={() => openTool(t)} className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-emerald-600/60 hover:bg-slate-800">
                  <span className="mt-0.5 shrink-0 text-emerald-300 group-hover:text-emerald-200">{TOOL_ICONS[t]}</span>
                  <span>
                    <span className="block text-sm font-semibold leading-tight text-slate-100">{TOOLS[t].name}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-slate-400">Вимірює {TOOLS[t].measures}.</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- розділ «Виклики»
export function QuestsView({ state: s, act }: { state: SimState; act: (a: Action) => void }) {
  const q = s.quest;
  const [teacher, setTeacher] = useState(false);
  const start = (id: (typeof QUEST_ORDER)[number]) => { setTeacher(false); act({ type: 'quest', id }); };
  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-2 text-base font-bold text-slate-50">Ситуаційні виклики ({QUEST_ORDER.length})</h2>
          <div className="flex flex-col gap-1.5">
            {QUEST_ORDER.map((id, i) => {
              const done = [...s.questHistory, ...(s.quest ? [s.quest] : [])].filter((h) => h.id === id);
              const solved = done.some((h) => h.solved);
              return (
                <button key={id} type="button" onClick={() => start(id)} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs leading-snug transition ${q?.id === id ? 'border-amber-500/70 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'}`}>
                  <span className="w-5 shrink-0 font-mono text-amber-400">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {QUESTS[id].title}
                    <span className="mt-0.5 block text-[10px] text-slate-500">{ZONES[QUESTS[id].zone].name} · {LEVEL[QUESTS[id].level]} рівень</span>
                  </span>
                  {solved && <span className="text-emerald-400">✔</span>}
                </button>
              );
            })}
            <button type="button" onClick={() => start(QUEST_ORDER[Math.floor(Math.random() * QUEST_ORDER.length)])} className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 px-2 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-600/30">
              <Dice5 className="h-4 w-4" /> Випадковий виклик
            </button>
          </div>
        </section>

        <section>
          {!q ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">Оберіть виклик зі списку. Поле завантажиться в потрібному стані, а умови з'являться тут і в розділі «Поле».</div>
          ) : (
            <div className={`rounded-xl border p-3 ${q.solved ? 'border-emerald-600/60 bg-emerald-950/40' : q.failed ? 'border-red-700/60 bg-red-950/40' : 'border-amber-600/60 bg-amber-950/30'}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                <Target className="h-3.5 w-3.5" /> {ZONES[QUESTS[q.id].zone].name} · {formatDay(q.startDay, true)}
              </div>
              <div className="mb-2 text-sm font-semibold text-slate-100">{QUESTS[q.id].title}</div>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-snug text-slate-300">
                {QUESTS[q.id].symptoms.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <div className="mt-3 text-xs font-semibold">
                {q.solved ? <span className="text-emerald-300">✔ Ситуацію розв'язано</span> : q.failed ? <span className="text-red-300">✖ Виклик провалено</span> : <span className="text-amber-200">Статус: очікує рішення агронома — перейдіть до розділів «Лабораторія» та «Поле»</span>}
              </div>
              <button type="button" onClick={() => setTeacher(!teacher)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-[11px] text-slate-400 hover:text-slate-200">
                {teacher ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <GraduationCap className="h-3.5 w-3.5" /> Еталонне рішення (для викладача)
              </button>
              {teacher && (
                <ol className="mt-2 list-decimal space-y-1 rounded-md bg-slate-950/70 p-2.5 pl-6 text-xs leading-snug text-sky-100">
                  {QUESTS[q.id].solution.map((t) => <li key={t}>{t}</li>)}
                </ol>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- «Поле»: смужка виклику
export function QuestBanner({ state: s, onOpen }: { state: SimState; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const q = s.quest;
  if (!q) return null;
  const tone = q.solved ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100' : q.failed ? 'border-red-700/60 bg-red-950/40 text-red-100' : 'border-amber-600/50 bg-amber-950/30 text-amber-100';
  return (
    <div className={`shrink-0 border-b px-3 py-1.5 text-xs ${tone}`}>
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-semibold">{QUESTS[q.id].title}</span>
        <span className="shrink-0 text-[10px] opacity-80">{q.solved ? 'розв\'язано' : q.failed ? 'провалено' : 'очікує рішення'}</span>
        <button type="button" onClick={() => setOpen(!open)} className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] hover:bg-white/10">
          Умови {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <button type="button" onClick={onOpen} className="shrink-0 rounded px-1.5 py-0.5 text-[10px] underline-offset-2 hover:underline">Усі виклики</button>
      </div>
      {open && <ul className="mt-1.5 list-disc space-y-0.5 pl-6 leading-snug text-slate-200">{QUESTS[q.id].symptoms.map((t) => <li key={t}>{t}</li>)}</ul>}
    </div>
  );
}

// --------------------------------------------------------------------------- «Поле»: кліматичний режим
export function ClimateBar({ state: s, act }: { state: SimState; act: (a: Action) => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-950/50 px-2 py-1" title="Злива та приморозок — разові події поточного дня; інші режими діють до повернення «Норми»">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-500">Погода</span>
      {CLIMATE_ORDER.map((m) => (
        <button key={m} type="button" onClick={() => act({ type: 'climate', mode: m })} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition ${s.climate === m ? 'bg-sky-600/30 text-sky-100 ring-1 ring-sky-500/60' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'}`}>
          {CLIMATE_ICONS[m]}
          {CLIMATE_NAMES[m]}
        </button>
      ))}
    </div>
  );
}
