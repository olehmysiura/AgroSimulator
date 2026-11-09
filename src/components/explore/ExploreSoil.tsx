// ============================================================================
// Вкладка «Ґрунт»: будова і фази, хімічний склад, фізичні явища, динаміка.
// ============================================================================
import { useState, type ReactNode } from 'react';
import { LAYER_DEFS, ZONES } from '../../sim/data';
import { PAN_LIMIT, effRes, productiveMoisture } from '../../sim/soil';
import { availableNutrients, elements, exchangeComplex, grossChemistry, humusQuality, phases, processes, structure, texture, type Process } from '../../sim/soilscience';
import type { LayerId, SimState, SoilLayer } from '../../sim/types';
import { fmt, formatDay } from '../../sim/util';
import MiniChart from './MiniChart';
import SoilScales from './SoilScales';

type Tab = 'build' | 'chem' | 'phys' | 'dyn';
const TABS: [Tab, string][] = [['build', 'Будова і фази'], ['chem', 'Хімічні елементи'], ['phys', 'Фізичні явища'], ['dyn', 'Динаміка']];
const GROUPS: Record<Process['group'], string> = { water: 'Вода і повітря', heat: 'Тепло', mech: 'Механіка', bio: 'Біологія', chem: 'Хімія' };

export default function ExploreSoil({ state: s }: { state: SimState }) {
  const [lid, setLid] = useState<LayerId>('arable');
  const [tab, setTab] = useState<Tab>('build');
  const l = s.layers.find((x) => x.id === lid)!;
  const def = LAYER_DEFS.find((d) => d.id === lid)!;
  const z = ZONES[s.zone];
  const li = s.layers.indexOf(l);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5 text-xs lg:flex-row">
      {/* профіль: вибір горизонту */}
      <div className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
        <div className="hidden text-[10px] uppercase tracking-wide text-slate-400 lg:block">{z.soil}</div>
        {LAYER_DEFS.map((d) => {
          const x = s.layers.find((q) => q.id === d.id)!;
          const red = d.id === 'pan' && effRes(x) >= PAN_LIMIT;
          return (
            <button key={d.id} type="button" onClick={() => setLid(d.id)} style={{ flexGrow: d.id === 'parent' ? 3 : d.id === 'transition' || d.id === 'arable' ? 2 : 1 }} className={`min-w-[120px] rounded-lg border px-2 py-1.5 text-left transition lg:min-w-0 ${lid === d.id ? 'border-emerald-500/70 bg-emerald-600/15' : red ? 'border-red-800 bg-red-950/40' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
              <div className="font-mono text-[10px] text-slate-400">{d.short}</div>
              <div className="text-[11px] font-semibold leading-tight text-slate-100">{d.name}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-sky-400" style={{ width: `${Math.min(100, x.moisture)}%` }} /></div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">{Math.round(x.moisture)}% НВ · {fmt(effRes(x), 1)} МПа · {fmt(x.temp, 0)}°</div>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map(([t, name]) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-2 py-1 text-[11px] font-medium ${tab === t ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/60' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{name}</button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">{def.short} · {def.name} · {formatDay(s.day, true)}</span>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {tab === 'build' && <Build s={s} l={l} />}
          {tab === 'chem' && <Chem s={s} l={l} />}
          {tab === 'phys' && <Phys s={s} l={l} />}
          {tab === 'dyn' && <Dyn s={s} li={li} />}
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-lg border border-slate-800 bg-slate-900 p-2 ${className}`}>
    <h4 className="mb-1.5 text-[11px] font-semibold text-emerald-300">{title}</h4>
    {children}
  </section>
);
const Row = ({ k, v, warn }: { k: ReactNode; v: ReactNode; warn?: boolean }) => (
  <div className="flex justify-between gap-2 border-b border-slate-800/70 py-0.5">
    <span className="text-slate-400">{k}</span>
    <span className={`text-right font-mono ${warn ? 'text-amber-300' : 'text-slate-100'}`}>{v}</span>
  </div>
);
const Stack = ({ parts }: { parts: { name: string; pct: number; color: string }[] }) => (
  <div>
    <div className="flex h-6 overflow-hidden rounded-md ring-1 ring-slate-700">
      {parts.map((p) => <div key={p.name} style={{ width: `${p.pct}%`, background: p.color }} className="grid place-items-center text-[10px] font-semibold text-black/70" title={`${p.name}: ${p.pct}%`}>{p.pct >= 9 ? `${Math.round(p.pct)}%` : ''}</div>)}
    </div>
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-300">
      {parts.map((p) => <span key={p.name}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name} {fmt(p.pct, 1)}%</span>)}
    </div>
  </div>
);

// --------------------------------------------------------------------------- будова і фази
function Build({ s, l }: { s: SimState; l: SoilLayer }) {
  const ph = phases(s, l);
  const tx = texture(s.zone, l.id);
  const st = structure(s, l);
  const hq = humusQuality(s.zone);
  return (
    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Ґрунт під різним збільшенням">
        <SoilScales s={s} l={l} />
      </Card>
      <div className="flex flex-col gap-2">
        <Card title="Чотири фази ґрунту (% об'єму)">
          <Stack parts={[{ name: 'мінеральна тверда', pct: ph.solid, color: '#a8875e' }, { name: 'органічна', pct: ph.organic, color: '#4a3524' }, { name: ph.ice ? 'лід' : 'вода', pct: ph.water, color: ph.ice ? '#a5f3fc' : '#38bdf8' }, { name: 'повітря', pct: ph.air, color: '#e2e8f0' }]} />
          <div className="mt-1.5">
            <Row k="Загальна пористість" v={`${ph.porosity}%`} warn={ph.porosity < 45} />
            <Row k="Пористість аерації" v={`${ph.air}%`} warn={ph.air < 12} />
            <Row k="Щільність будови / твердої фази" v={`${fmt(l.density, 2)} / 2,62 г/см³`} />
            <Row k="Продуктивна волога в шарі" v={`${productiveMoisture(s, l.top, l.bottom)} мм`} />
          </div>
        </Card>
        <Card title={`Гранулометричний склад — ${tx.name}`}>
          <Stack parts={[{ name: 'пісок (1–0,05 мм)', pct: tx.sand, color: '#e6c98a' }, { name: 'пил (0,05–0,001)', pct: tx.silt, color: '#b08d5c' }, { name: 'мул (< 0,001)', pct: tx.clay, color: '#6b4a33' }]} />
          <div className="mt-1.5"><Row k="Фізична глина (< 0,01 мм)" v={`${tx.physClay}%`} /></div>
        </Card>
        <Card title="Структура і гумус">
          <Row k="Структура" v={<span className="font-sans">{st.kind}</span>} />
          <Row k="Водостійких агрегатів > 0,25 мм" v={`${st.wsa}%`} warn={st.wsa < 40} />
          <Row k="Гумус" v={`${fmt(l.humus, 2)}%`} />
          <Row k="Тип гумусу (Сгк : Сфк)" v={`${hq.type} (${fmt(hq.ratio)})`} />
          <p className="mt-1 text-[10px] leading-snug text-slate-500">{hq.note}</p>
        </Card>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- хімія
function Chem({ s, l }: { s: SimState; l: SoilLayer }) {
  const el = elements(s, l);
  const gross = grossChemistry(s, l);
  const av = availableNutrients(s, l);
  const ex = exchangeComplex(s, l);
  const maxLog = Math.log10(el[0].pct * 100);
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <Card title="Елементний склад твердої фази (мас. %)">
        <div className="space-y-0.5">
          {el.map((e) => (
            <div key={e.sym} className="flex items-center gap-1.5">
              <span className="w-7 rounded bg-slate-800 text-center font-mono text-[11px] font-bold text-amber-200">{e.sym}</span>
              <span className="w-32 truncate text-slate-300">{e.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><div className="h-full bg-amber-400/80" style={{ width: `${Math.max(3, (Math.log10(e.pct * 100) / maxLog) * 100)}%` }} /></div>
              <span className="w-14 text-right font-mono text-slate-100">{fmt(e.pct, e.pct < 1 ? 3 : 1)}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Шкала логарифмічна. Понад 80% маси — O, Si, Al: каркас мінералів.</p>
      </Card>
      <div className="flex flex-col gap-2">
        <Card title="Ґрунтовий вбирний комплекс (обмінні катіони)">
          <Stack parts={ex.cations.filter((c) => c.share > 0.2).map((c) => ({ name: c.id, pct: c.share, color: c.color }))} />
          <div className="mt-1.5">
            <Row k="Ємність катіонного обміну" v={`${fmt(ex.cec)} мг-екв/100 г`} />
            <Row k="Ступінь насичення основами" v={`${ex.v}%`} warn={ex.v < 75} />
            <Row k="pH сольовий" v={fmt(l.pH)} warn={l.pH < 5.5} />
          </div>
        </Card>
        <Card title="Валовий склад (оксиди, %)">
          <div className="grid grid-cols-2 gap-x-3">{gross.map((g) => <Row key={g.id} k={g.name} v={fmt(g.pct, g.pct < 1 ? 2 : 1)} />)}</div>
        </Card>
      </div>
      <Card title="Рухомі форми елементів живлення, доступні рослинам (мг/кг)" className="lg:col-span-2">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {av.map((r) => (
            <div key={r.id} className="border-b border-slate-800/70 py-0.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-300">{r.name}</span>
                <span className={`font-mono ${r.crit && r.value < r.crit ? 'text-amber-300' : 'text-slate-100'}`}>{fmt(r.value, r.value < 10 ? 2 : 0)}{r.crit ? <span className="text-slate-500"> / {r.crit}</span> : null}</span>
              </div>
              {r.note && <div className="text-[10px] text-slate-500">{r.note}</div>}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Після косої риски — орієнтовний рівень достатньої забезпеченості.</p>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------- фізичні явища
function Phys({ s, l }: { s: SimState; l: SoilLayer }) {
  const list = processes(s, l);
  const col = { ok: 'border-slate-800', warn: 'border-amber-700/70 bg-amber-950/20', bad: 'border-red-800 bg-red-950/30' };
  const dot = { ok: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-red-500' };
  return (
    <div className="space-y-2">
      {(Object.keys(GROUPS) as Process['group'][]).map((g) => {
        const items = list.filter((p) => p.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{GROUPS[g]}</div>
            <div className="grid gap-1.5 md:grid-cols-2">
              {items.map((p) => (
                <div key={p.id} className={`rounded-lg border bg-slate-900 p-2 ${col[p.state]}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-100"><span className={`h-2 w-2 rounded-full ${dot[p.state]}`} />{p.name}</span>
                    <span className="font-mono text-slate-100">{p.value}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{p.effect}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------- динаміка
function Dyn({ s, li }: { s: SimState; li: number }) {
  const sr = s.series;
  if (sr.length < 3) return <p className="p-4 text-slate-400">Графіки з'являться після кількох діб симуляції — натисніть «+10» або «Авто».</p>;
  const d0 = formatDay(sr[0].d, true), d1 = formatDay(sr[sr.length - 1].d, true);
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <Card title="Вологість горизонту, % НВ"><MiniChart series={[{ data: sr.map((p) => p.m[li]), color: '#38bdf8', name: 'вологість' }]} refs={[{ v: 80, label: '80% — межа виходу техніки', color: '#f59e0b' }, { v: 30, label: 'вологість в\'янення', color: '#ef4444' }]} from={d0} to={d1} min={0} max={125} /></Card>
      <Card title="Температура горизонту та повітря, °C"><MiniChart series={[{ data: sr.map((p) => p.tAir), color: '#64748b', name: 'повітря' }, { data: sr.map((p) => p.t[li]), color: '#f97316', name: 'ґрунт' }]} refs={[{ v: 0, label: '0 °C', color: '#7dd3fc' }, { v: 10, label: '10 °C', color: '#22c55e' }]} from={d0} to={d1} /></Card>
      <Card title="Опади, мм за добу"><MiniChart series={[{ data: sr.map((p) => p.rain), color: '#60a5fa', name: 'опади', bars: true }]} from={d0} to={d1} min={0} /></Card>
      <Card title="Мінеральний азот у шарі 0–30 см, кг/га"><MiniChart series={[{ data: sr.map((p) => p.nA), color: '#a78bfa', name: 'N мін.' }]} from={d0} to={d1} min={0} /></Card>
    </div>
  );
}
