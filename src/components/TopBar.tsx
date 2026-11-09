import { CloudRain, Droplets, FastForward, FileCheck2, Gauge, Layers, MonitorUp, Pause, Play, RotateCcw, Snowflake, Sprout, StepForward, Thermometer, ThermometerSun, Wind } from 'lucide-react';
import { CROPS, ZONES } from '../sim/data';
import { lastDay, yieldForecast } from '../sim/engine';
import { layer, productiveMoisture } from '../sim/soil';
import type { Action } from '../sim/reducer';
import type { SimState, ZoneId } from '../sim/types';
import { fmt, formatDay } from '../sim/util';
import { Btn, Stat } from './ui';

interface Props {
  state: SimState;
  act: (a: Action) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (n: number) => void;
  projector: boolean;
  setProjector: (b: boolean) => void;
  seek: (d: number) => void;
  onReport: () => void;
  onReset: () => void;
  showStats: boolean;
}

const SPEEDS = [1, 3, 7];

export default function TopBar({ state: s, act, playing, setPlaying, speed, setSpeed, projector, setProjector, seek, onReport, onReset, showStats }: Props) {
  const w = s.weather;
  const c = s.crop;
  const y = yieldForecast(s);
  const pm = productiveMoisture(s);
  const dens = layer(s, 'arable').density;
  const gdd = c ? Math.round(c.gdd) : Math.round(s.sat);
  const seasonDay = s.day - s.startDay + 1;
  const end = lastDay(s);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600/20 ring-1 ring-emerald-500/50">
            <Sprout className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-slate-50">AgroSim UA</h1>
            <p className="text-[10px] leading-tight text-slate-400">Віртуальна лабораторія агронома</p>
          </div>
        </div>

        {/* Зона */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(Object.keys(ZONES) as ZoneId[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => z !== s.zone && act({ type: 'zone', zone: z })}
              title={`${ZONES[z].soil}; pH ${ZONES[z].pH}, гумус ${ZONES[z].humus}%. Перемикання створює нове поле з поточної дати.`}
              className={`rounded-md px-2 py-1 text-left text-[11px] leading-tight transition ${s.zone === z ? 'bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-500/60' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <div className="font-semibold">{ZONES[z].name}</div>
              <div className="text-[9px] text-slate-400">{ZONES[z].region}</div>
            </button>
          ))}
        </div>

        {/* Машина часу */}
        <div className={`flex w-full flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 ${projector ? '' : 'lg:w-auto lg:min-w-[360px] lg:flex-1 lg:flex-nowrap'}`}>
          <div className="w-[118px] shrink-0">
            <div className="text-[10px] uppercase text-slate-400">День сезону {seasonDay}</div>
            <div className="font-mono text-sm font-semibold leading-tight text-emerald-200">{formatDay(s.day, true)}</div>
          </div>
          <div className={`flex min-w-0 flex-col ${projector ? 'flex-1' : 'order-last w-full lg:order-none lg:w-auto lg:flex-1'}`}>
            <input aria-label="Шкала часу" type="range" min={s.startDay} max={end} value={s.day} onChange={(e) => { setPlaying(false); seek(+e.target.value); }} className="w-full" />
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>{formatDay(s.startDay, true)}</span>
              <span>{formatDay(end, true)}</span>
            </div>
          </div>
          <Btn onClick={() => setPlaying(!playing)} tone={playing ? 'default' : 'primary'} active={playing} title="Авто-плин часу">
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Пауза' : 'Авто'}
          </Btn>
          <div className="flex rounded-lg bg-slate-800 p-0.5" title="Швидкість авто-плину (діб за секунду)">
            {SPEEDS.map((k) => (
              <button key={k} type="button" onClick={() => setSpeed(k)} className={`rounded-md px-1.5 py-1 font-mono text-[10px] ${speed === k ? 'bg-emerald-600/40 text-emerald-100' : 'text-slate-400 hover:text-slate-200'}`}>×{k}</button>
            ))}
          </div>
          <Btn onClick={() => act({ type: 'tick', days: 1 })} title="+1 день"><StepForward className="h-3.5 w-3.5" />+1</Btn>
          <Btn onClick={() => act({ type: 'tick', days: 10 })} title="+10 днів"><FastForward className="h-3.5 w-3.5" />+10</Btn>
        </div>

        <div className="flex items-center gap-1">
          <Btn active={projector} onClick={() => setProjector(!projector)} title="Режим проектора: збільшений масштаб інтерфейсу для аудиторії"><MonitorUp className="h-3.5 w-3.5" />Проектор</Btn>
          <Btn tone="danger" onClick={onReset} title="Повне скидання симуляції: нове поле, очищення журналу, помилок і викликів"><RotateCcw className="h-3.5 w-3.5" />Скинути все</Btn>
        </div>
      </div>

      {showStats && <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
        <Stat label="Повітря" icon={<Thermometer className="h-3 w-3" />} value={fmt(w.tAir)} unit="°C" tone={w.tMin <= 0 ? 'sky' : w.tMax > 30 ? 'amber' : 'slate'} sub={`мін ${fmt(w.tMin)} / макс ${fmt(w.tMax)}`} />
        <Stat label={`Ґрунт ${c ? fmt(c.depth) : '5'} см`} icon={<ThermometerSun className="h-3 w-3" />} value={fmt(w.tSoil)} unit="°C" tone={w.tSoil < 10 ? 'sky' : 'slate'} />
        <Stat label="Вітер" icon={<Wind className="h-3 w-3" />} value={fmt(w.wind)} unit="м/с" tone={w.wind > 5 ? 'red' : 'slate'} />
        <Stat label={w.snowfall ? 'Сніг' : 'Опади'} icon={w.snowfall ? <Snowflake className="h-3 w-3" /> : <CloudRain className="h-3 w-3" />} value={fmt(w.rain)} unit="мм" tone={w.rain >= 20 ? 'sky' : 'slate'} sub={s.snow > 0 ? `сніг: ${fmt(s.snow, 0)} мм води` : `RH ${w.humidity}%`} />
        <Stat label={c ? 'САТ від посіву' : 'САТ > 10 °C'} icon={<ThermometerSun className="h-3 w-3" />} value={gdd} unit="°C" sub={c ? `база +${CROPS[c.id].baseTemp} °C` : `з 1 січня`} />
        <Stat label="Прод. волога 0–100" icon={<Droplets className="h-3 w-3" />} value={pm} unit="мм" tone={pm < 60 ? 'red' : pm < 110 ? 'amber' : 'emerald'} sub={`A: ${fmt(layer(s, 'arable').moisture, 0)}% НВ`} />
        <Stat label="Щільність A" icon={<Layers className="h-3 w-3" />} value={fmt(dens, 2)} unit="г/см³" tone={dens >= 1.4 ? 'red' : dens > 1.3 ? 'amber' : 'emerald'} />
        <Stat label="Культура" icon={<Sprout className="h-3 w-3" />} value={c ? CROPS[c.id].name : '—'} sub={c ? (c.dead ? 'загинула' : c.harvested ? 'зібрано' : `BBCH ${String(c.bbch).padStart(2, '0')}`) : 'поле вільне'} />
        <Stat label="Прогноз урожаю" icon={<Gauge className="h-3 w-3" />} value={c ? fmt(y.tha, c.id === 'sugarbeet' ? 1 : 2) : '—'} unit={c ? 'т/га' : ''} tone={!c ? 'slate' : y.pct < 50 ? 'red' : y.pct < 80 ? 'amber' : 'emerald'} sub={c ? `${y.pct}% від потенціалу ${fmt(y.potential)}` : ''} />
        <Stat label="Помилки" value={s.mistakes.length} tone={s.mistakes.length ? 'red' : 'emerald'} sub={`діагностик: ${s.diagnostics.length}`} />
        <button type="button" onClick={onReport} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700/80 px-2 py-1.5 text-xs font-semibold text-white ring-1 ring-emerald-400/50 hover:bg-emerald-600">
          <FileCheck2 className="h-4 w-4" />
          Атестаційний звіт
        </button>
      </div>}
    </header>
  );
}
