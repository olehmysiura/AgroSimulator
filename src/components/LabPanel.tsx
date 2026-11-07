import {
  Bug, CloudDrizzle, CloudLightning, CloudSun, Dice5, Drill, Droplets, Eye, EyeOff, FlaskConical, Flame, GraduationCap, Grid3x3,
  Microscope, Radio, Satellite, ScanLine, Shovel, Snowflake, Sun, Swords, Target, TestTubes, Thermometer, Wind,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { TOOLS, ZONES } from '../sim/data';
import { QUESTS, QUEST_ORDER } from '../sim/quests';
import { CLIMATE_NAMES, type Action } from '../sim/reducer';
import type { ClimateMode, SimState, ToolId } from '../sim/types';
import { formatDay } from '../sim/util';
import { Panel } from './ui';

const TOOL_ICONS: Record<ToolId, ReactNode> = {
  penetrometer: <Drill className="h-4 w-4" />,
  auger: <ScanLine className="h-4 w-4" />,
  frame: <Grid3x3 className="h-4 w-4" />,
  shovel: <Shovel className="h-4 w-4" />,
  lens: <Microscope className="h-4 w-4" />,
  ndvi: <Satellite className="h-4 w-4" />,
  thermometer: <Thermometer className="h-4 w-4" />,
  infiltrometer: <Droplets className="h-4 w-4" />,
  traps: <Bug className="h-4 w-4" />,
  agrolab: <TestTubes className="h-4 w-4" />,
  meteo: <Radio className="h-4 w-4" />,
};

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

export default function LabPanel({ state: s, act, openTool }: { state: SimState; act: (a: Action) => void; openTool: (t: ToolId) => void }) {
  const q = s.quest;
  const [teacher, setTeacher] = useState(false);
  return (
    <aside className="thin-scroll flex w-full shrink-0 flex-col gap-2 overflow-y-auto xl:w-72">
      <Panel title="Лабораторія досліджень" icon={<FlaskConical className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(TOOLS) as ToolId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => openTool(t)}
              title={TOOLS[t].name}
              className="group flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-left transition hover:border-emerald-600/60 hover:bg-slate-800"
            >
              <span className="shrink-0 text-emerald-300 group-hover:text-emerald-200">{TOOL_ICONS[t]}</span>
              <span className="text-[11px] font-medium leading-tight text-slate-200">{TOOLS[t].short}</span>
            </button>
          ))}
        </div>
      </Panel>

      {q && (
        <section className={`rounded-xl border p-2.5 ${q.solved ? 'border-emerald-600/60 bg-emerald-950/40' : q.failed ? 'border-red-700/60 bg-red-950/40' : 'border-amber-600/60 bg-amber-950/30'}`}>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            <Target className="h-3.5 w-3.5" /> Виклик · {ZONES[QUESTS[q.id].zone].name} · {formatDay(q.startDay)}
          </div>
          <div className="mb-1.5 text-xs font-semibold text-slate-100">{QUESTS[q.id].title}</div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-slate-300">
            {QUESTS[q.id].symptoms.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="mt-2 text-[11px] font-semibold">
            {q.solved ? <span className="text-emerald-300">✔ Ситуацію розв'язано</span> : q.failed ? <span className="text-red-300">✖ Виклик провалено</span> : <span className="text-amber-200">Статус: очікує рішення агронома</span>}
          </div>
          <button type="button" onClick={() => setTeacher(!teacher)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200">
            {teacher ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            <GraduationCap className="h-3 w-3" /> Еталонне рішення (для викладача)
          </button>
          {teacher && (
            <ol className="mt-1.5 list-decimal space-y-1 rounded-md bg-slate-950/70 p-2 pl-5 text-[11px] leading-snug text-sky-100">
              {QUESTS[q.id].solution.map((t) => <li key={t}>{t}</li>)}
            </ol>
          )}
        </section>
      )}

      <Panel title={`Ситуаційні виклики (${QUEST_ORDER.length})`} icon={<Swords className="h-3.5 w-3.5" />}>
        <div className="flex flex-col gap-1">
          {QUEST_ORDER.map((id, i) => {
            const done = [...s.questHistory, ...(s.quest ? [s.quest] : [])].filter((h) => h.id === id);
            const solved = done.some((h) => h.solved);
            return (
              <button
                key={id}
                type="button"
                onClick={() => { setTeacher(false); act({ type: 'quest', id }); }}
                className={`flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-snug transition ${q?.id === id ? 'border-amber-500/70 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'}`}
              >
                <span className="w-5 shrink-0 font-mono text-amber-400">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  {QUESTS[id].title}
                  <span className="mt-0.5 block text-[9px] text-slate-500">{ZONES[QUESTS[id].zone].name} · {LEVEL[QUESTS[id].level]} рівень</span>
                </span>
                {solved && <span className="text-emerald-400">✔</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => { setTeacher(false); act({ type: 'quest', id: QUEST_ORDER[Math.floor(Math.random() * QUEST_ORDER.length)] }); }}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600/20 px-2 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-600/30"
          >
            <Dice5 className="h-3.5 w-3.5" /> Випадковий виклик
          </button>
        </div>
      </Panel>

      <Panel title="Кліматичний режим" icon={<CloudSun className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-1">
          {CLIMATE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => act({ type: 'climate', mode: m })}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] leading-tight transition ${s.climate === m ? 'bg-sky-600/30 text-sky-100 ring-1 ring-sky-500/60' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'} ${m === 'normal' ? 'col-span-2' : ''}`}
            >
              {CLIMATE_ICONS[m]}
              {CLIMATE_NAMES[m]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">Злива та приморозок — разові події поточного дня; інші режими діють до повернення «Норми».</p>
      </Panel>
    </aside>
  );
}
