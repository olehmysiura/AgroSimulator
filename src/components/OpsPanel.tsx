import { Bug, Droplet, FlaskRound, Leaf, Moon, ShieldCheck, Sprout, SprayCan, Sun, Tractor, Trash2, Wheat } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CROPS, CROP_ORDER, SPRAYS, TILLAGE } from '../sim/data';
import { liveCrop } from '../sim/diagnostics';
import { effectiveWind } from '../sim/operations';
import type { Action } from '../sim/reducer';
import type { CropId, SimState, SprayOp, TillageOp } from '../sim/types';
import { fmt } from '../sim/util';
import { Btn } from './ui';

type Tab = 'sow' | 'soil' | 'zzr';

const SPRAY_ICONS: Record<SprayOp, ReactNode> = {
  nitrogen: <Droplet className="h-4 w-4 text-sky-300" />,
  preHerbicide: <ShieldCheck className="h-4 w-4 text-lime-300" />,
  postHerbicide: <Leaf className="h-4 w-4 text-lime-300" />,
  fungicide: <FlaskRound className="h-4 w-4 text-violet-300" />,
  insecticide: <Bug className="h-4 w-4 text-orange-300" />,
  antistress: <Sprout className="h-4 w-4 text-emerald-300" />,
};

export default function OpsPanel({ state: s, act }: { state: SimState; act: (a: Action) => void }) {
  const [tab, setTab] = useState<Tab>('sow');
  const [crop, setCrop] = useState<CropId>('corn');
  const [depth, setDepth] = useState(5);
  const [treat, setTreat] = useState(true);
  const [inoc, setInoc] = useState(false);
  const live = liveCrop(s);
  const wind = effectiveWind(s);

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 xl:w-80">
      <h2 className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
        <Tractor className="h-3.5 w-3.5" /> Агротехнологічні операції
      </h2>
      <div className="grid grid-cols-3 gap-1 border-b border-slate-800 p-1.5">
        {([['sow', 'Посів', <Wheat key="i" className="h-3.5 w-3.5" />], ['soil', 'Ґрунт', <Tractor key="i" className="h-3.5 w-3.5" />], ['zzr', 'ЗЗР / Живлення', <SprayCan key="i" className="h-3.5 w-3.5" />]] as [Tab, string, ReactNode][]).map(([id, name, icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium ${tab === id ? 'bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-500/60' : 'text-slate-300 hover:bg-slate-800'}`}>
            {icon}
            {name}
          </button>
        ))}
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto p-2.5">
        {tab === 'sow' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1.5">
              {CROP_ORDER.map((id) => (
                <button key={id} type="button" onClick={() => setCrop(id)} className={`rounded-lg border p-2 text-left transition ${crop === id ? 'border-emerald-500/70 bg-emerald-600/15' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
                  <div className="text-xs font-semibold text-slate-100">{CROPS[id].name}</div>
                  <div className="text-[9px] italic text-slate-500">{CROPS[id].latin}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">потенціал {fmt(CROPS[id].potential)} т/га</div>
                  <div className="text-[10px] text-slate-500">корінь до {CROPS[id].maxRoot} см</div>
                </button>
              ))}
            </div>
            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] text-slate-300">
                <span>Глибина загортання сошником</span>
                <span className="font-mono font-semibold text-emerald-300">{fmt(depth)} см</span>
              </div>
              <input type="range" min={1.5} max={10} step={0.5} value={depth} onChange={(e) => setDepth(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-[9px] text-slate-500"><span>1,5</span><span>10 см</span></div>
            </label>
            <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900 p-2 text-[11px]">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Передпосівна обробка насіння</div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={treat} onChange={(e) => setTreat(e.target.checked)} className="accent-emerald-500" /> Фунгіцидно-інсектицидний протруйник</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={inoc} onChange={(e) => setInoc(e.target.checked)} className="accent-emerald-500" /> Інокуляція бульбочковими бактеріями</label>
            </div>
            <Btn tone="primary" className="w-full py-2" disabled={!!live} onClick={() => act({ type: 'sow', crop, depth, seedTreatment: treat, inoculated: inoc })}>
              <Wheat className="h-4 w-4" /> Виконати посів культури
            </Btn>
            <Btn tone="danger" className="w-full py-2" disabled={!s.crop} onClick={() => act({ type: 'clear' })}>
              <Trash2 className="h-4 w-4" /> Списати посіви / Пересіяти поле
            </Btn>
            {live && <p className="text-[10px] text-slate-500">Поле зайняте: {CROPS[live.id].name}, BBCH {live.bbch}.</p>}
          </div>
        )}

        {tab === 'soil' && (
          <div className="flex flex-col gap-1.5">
            {(Object.keys(TILLAGE) as TillageOp[]).map((op) => (
              <button key={op} type="button" onClick={() => act({ type: 'till', op })} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900 p-2 text-left transition hover:border-amber-600/60 hover:bg-slate-800">
                <Tractor className="h-5 w-5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight text-slate-100">{TILLAGE[op].name}</div>
                  <div className="text-[10px] text-slate-400">Робоча глибина: {TILLAGE[op].depth}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {tab === 'zzr' && (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
              <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-400">Режим обприскувача</div>
              <div className="grid grid-cols-2 gap-1">
                <Btn active={s.sprayMode === 'day'} onClick={() => act({ type: 'sprayMode', mode: 'day' })}><Sun className="h-3.5 w-3.5" />Денна зміна</Btn>
                <Btn active={s.sprayMode === 'evening'} onClick={() => act({ type: 'sprayMode', mode: 'evening' })} className="leading-tight"><Moon className="h-3.5 w-3.5" />Вечірня + інжекторні</Btn>
              </div>
              <div className="mt-1.5 flex justify-between text-[11px]">
                <span className="text-slate-400">Вітер під час роботи:</span>
                <span className={`font-mono font-semibold ${wind > 5 ? 'text-red-400' : 'text-emerald-300'}`}>{fmt(wind)} м/с</span>
              </div>
            </div>
            {(Object.keys(SPRAYS) as SprayOp[]).map((op) => (
              <button key={op} type="button" onClick={() => act({ type: 'spray', op })} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900 p-2 text-left transition hover:border-violet-600/60 hover:bg-slate-800">
                <span className="shrink-0">{SPRAY_ICONS[op]}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight text-slate-100">{SPRAYS[op].name}</div>
                  <div className="text-[10px] text-slate-400">{SPRAYS[op].detail}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
