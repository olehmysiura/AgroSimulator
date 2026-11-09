// ============================================================================
// Вкладка «Урожай і фактори»: що саме сьогодні обмежує ріст і скільки врожаю
// вже забрав кожен фактор; структура врожаю та продуктивність фаз.
// ============================================================================
import type { ReactNode } from 'react';
import { CROPS, FACTORS, FACTOR_ORDER, PHYS, type FactorId } from '../../sim/data';
import { PHASE_NAMES, dailyPar, lightInterception, phaseOf, yieldComponents, yieldForecast } from '../../sim/physiology';
import type { SimState } from '../../sim/types';
import { fmt, formatDay } from '../../sim/util';
import MiniChart from './MiniChart';

const WHY: Record<FactorId, string> = {
  water: 'Корені не можуть забрати стільки води, скільки випаровує листя: продихи закриваються, CO₂ не надходить.',
  air: 'Пори заповнені водою — кореням бракує кисню для дихання й поглинання елементів.',
  nitrogen: 'Вміст азоту в рослині нижчий за критичний для її біомаси: менше хлорофілу й білка.',
  phosphorus: 'Фосфору в доступній формі замало (холодний ґрунт, кисла чи лужна реакція, низький запас).',
  potassium: 'Нестача калію: порушено водний режим клітин і транспорт цукрів.',
  micro: 'Брак критичного для культури мікро-/мезоелемента саме у фазу найбільшої потреби.',
  ph: 'Реакція ґрунту поза оптимумом культури: токсичність Al³⁺/Mn²⁺ або недоступність елементів.',
  heat: 'Температура вища за критичну: стерильність пилку, прискорене старіння листя.',
  chill: 'Холодні ночі пригнічують фотосинтез теплолюбної культури.',
  weeds: 'Бур\'яни перехоплюють світло, воду та азот у критичний період конкуренції.',
  disease: 'Уражена частина листкової поверхні не фотосинтезує.',
  pests: 'Шкідники знищують асиміляційну поверхню або генеративні органи.',
  compaction: 'Щільність орного шару вища за критичну — корені ростуть повільно, мало повітря.',
  frost: 'Частина листя загинула від приморозку й ще не відновлена.',
  stress: 'Рослина відновлюється після стресу (приморозок, фітотоксичність).',
};

export default function FactorsView({ state: s }: { state: SimState }) {
  const c = s.crop;
  if (!c) return <p className="p-6 text-sm text-slate-400">Поле без культури. Після посіву тут з'явиться аналіз росту: що обмежує рослини сьогодні та як кожен фактор вплинув на врожайність.</p>;
  const y = yieldForecast(s);
  const comp = yieldComponents(s);
  const def = CROPS[c.id];
  const dec = c.id === 'sugarbeet' ? 1 : 2;
  const live = c.emerged && !c.dead && !c.harvested;
  const fs = FACTOR_ORDER.map((k) => ({ k, v: c.factors[k] ?? 1 })).sort((a, b) => a.v - b.v);
  const ph = phaseOf(c);
  const sr = s.series.filter((p) => p.d >= c.sowDay);
  const maxLoss = Math.max(0.01, ...y.losses.map((l) => l.tha));

  return (
    <div className="thin-scroll grid min-h-0 flex-1 gap-2 overflow-y-auto p-2.5 text-xs lg:grid-cols-2">
      <Card title={`Біологічна врожайність: ${def.name}`}>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Big label="Генетичний потенціал" value={fmt(y.potential, dec)} unit="т/га" tone="text-slate-200" />
          <Big label="Ще досяжно (далі без стресів)" value={fmt(y.secured, dec)} unit={`т/га · ${y.securedPct}%`} tone="text-sky-300" />
          <Big label="Прогноз за поточних умов" value={fmt(y.tha, dec)} unit={`т/га · ${y.pct}%`} tone={y.pct < 50 ? 'text-red-400' : y.pct < 80 ? 'text-amber-300' : 'text-emerald-300'} />
        </div>
        {comp && (
          <div className="mt-2">
            <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">Структура врожаю</div>
            <Row k={`Густота, ${PHYS[c.id].comp.per}`} v={fmt(comp.plants, comp.plants < 20 ? 1 : 0)} />
            {comp.rows.map((r) => <Row key={r.name} k={r.name} v={<>{fmt(r.value, r.value < 10 ? 2 : r.value < 100 ? 1 : 0)} <span className="text-slate-500">з {fmt(r.base, r.base < 10 ? 2 : r.base < 100 ? 1 : 0)} {r.unit}</span></>} warn={r.value < r.base * 0.85} />)}
            <p className="mt-1 rounded bg-slate-950 px-2 py-1 font-mono text-[11px] text-emerald-200">{comp.formula}</p>
          </div>
        )}
      </Card>

      <Card title="Що обмежує ріст сьогодні (1,00 = не лімітує)">
        {!live ? <p className="text-slate-400">{c.dead ? 'Посів загинув.' : c.harvested ? 'Урожай зібрано.' : 'Сходів ще немає — ріст почнеться після появи першого листка.'}</p> : (
          <>
            <div className="mb-1.5 flex items-center justify-between rounded-md bg-slate-950 px-2 py-1">
              <span className="text-slate-300">Відносна швидкість росту</span>
              <span className={`font-mono text-sm font-bold ${c.gToday < 0.6 ? 'text-red-400' : c.gToday < 0.85 ? 'text-amber-300' : 'text-emerald-300'}`}>{Math.round(c.gToday * 100)}% від можливої</span>
            </div>
            <div className="space-y-1">
              {fs.map(({ k, v }) => (
                <div key={k} title={WHY[k]}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-44 truncate ${v < 0.995 ? 'text-slate-100' : 'text-slate-500'}`}>{FACTORS[k].name}{c.limiting === k ? ' ◀' : ''}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><div className={`h-full ${v < 0.6 ? 'bg-red-500' : v < 0.85 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${v * 100}%` }} /></div>
                    <span className="w-9 text-right font-mono text-slate-100">{fmt(v, 2)}</span>
                  </div>
                  {v < 0.9 && <p className="ml-1 text-[10px] leading-snug text-slate-500">{WHY[k]}</p>}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">Елементи живлення (N, P, K, мікро, pH) діють за законом мінімуму: враховується лише найдефіцитніший. Інші фактори перемножуються.</p>
          </>
        )}
      </Card>

      <Card title="Куди подівся врожай: втрати за факторами, т/га">
        {y.losses.length === 0 ? <p className="text-emerald-300">Втрат поки немає — потенціал реалізується повністю.</p> : (
          <div className="space-y-1">
            {y.losses.map((l) => (
              <div key={l.id} className="flex items-center gap-1.5">
                <span className="w-48 truncate text-slate-200" title={l.name}>{l.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-slate-800"><div className={`h-full ${l.kind === 'outlook' ? 'bg-sky-500/70' : l.kind === 'event' ? 'bg-red-500' : l.kind === 'stand' ? 'bg-violet-400' : 'bg-amber-400'}`} style={{ width: `${(l.tha / maxLoss) * 100}%` }} /></div>
                <span className="w-24 text-right font-mono text-slate-100">−{fmt(l.tha, dec)} <span className="text-slate-500">({fmt(l.pct, 0)}%)</span></span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />щоденні фактори росту</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500" />разові події та помилки</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400" />густота</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-500/70" />ще можна відвернути</span>
        </div>
      </Card>

      <Card title="Продуктивність фаз формування врожаю">
        {PHASE_NAMES[c.id].map((name, i) => (
          <div key={name} className="mb-1">
            <div className="flex justify-between"><span className={ph === i ? 'font-semibold text-amber-200' : 'text-slate-300'}>{ph === i ? '▶ ' : ''}{name}</span><span className="font-mono text-slate-100">{Math.round(y.perf[i] * 100)}%</span></div>
            <div className="h-2 overflow-hidden rounded bg-slate-800"><div className={`h-full ${y.perf[i] < 0.6 ? 'bg-red-500' : y.perf[i] < 0.85 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${y.perf[i] * 100}%` }} /></div>
            <div className="text-[10px] text-slate-500">визначає: {PHYS[c.id].comp.names[i].toLowerCase()} · чутливість {fmt(PHYS[c.id].sens[i], 2)}</div>
          </div>
        ))}
        {live && (
          <div className="mt-1.5 border-t border-slate-800 pt-1">
            <Row k="ФАР сьогодні" v={`${fmt(dailyPar(s))} МДж/м²`} />
            <Row k="Перехоплено посівом" v={`${Math.round(lightInterception(c) * 100)}% (LAI ${fmt(c.lai, 2)})`} />
            <Row k="Суха біомаса" v={`${fmt(c.biomass, 2)} т/га`} />
            <Row k="Винос азоту" v={`${Math.round(c.nUptake)} кг/га`} />
          </div>
        )}
      </Card>

      {sr.length > 3 && (
        <>
          <Card title="Відносна швидкість росту за днями, %"><MiniChart series={[{ data: sr.map((p) => p.g * 100), color: '#34d399', name: 'ріст' }]} from={formatDay(sr[0].d)} to={formatDay(sr[sr.length - 1].d)} min={0} max={100} /></Card>
          <Card title="Прогноз урожаю (% потенціалу) та суха біомаса (т/га)">
            <MiniChart series={[{ data: sr.map((p) => p.y), color: '#fbbf24', name: 'прогноз, %' }]} from={formatDay(sr[0].d)} to={formatDay(sr[sr.length - 1].d)} min={0} max={100} height={70} />
            <MiniChart series={[{ data: sr.map((p) => p.bio), color: '#86efac', name: 'біомаса' }]} from="" to="" min={0} height={70} />
          </Card>
        </>
      )}
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-lg border border-slate-800 bg-slate-900 p-2">
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
const Big = ({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) => (
  <div className="rounded-md bg-slate-950 p-1.5">
    <div className="text-[9px] uppercase leading-tight text-slate-500">{label}</div>
    <div className={`font-mono text-lg font-bold leading-tight ${tone}`}>{value}</div>
    <div className="text-[10px] text-slate-400">{unit}</div>
  </div>
);
