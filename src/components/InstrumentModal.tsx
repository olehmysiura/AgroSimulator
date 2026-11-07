// ============================================================================
// Вікна лабораторних приладів: лише сирі дані вимірювань
// ============================================================================
import { AlertTriangle, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { CROPS, EPSH_WEEDS, LAYER_DEFS, TARGET_DENSITY, TOOLS, gddForBbch } from '../sim/data';
import { liveCrop, toolRelevance } from '../sim/diagnostics';
import { canopyCover } from '../sim/engine';
import { PAN_LIMIT, effRes, layer, panBlocking, penetrometerProfile, productiveMoisture } from '../sim/soil';
import type { SimState, ToolId } from '../sim/types';
import { clamp, fmt, formatDay, hashRand } from '../sim/util';

export default function InstrumentModal({ tool, state: s, onClose }: { tool: ToolId; state: SimState; onClose: () => void }) {
  const rel = toolRelevance(s, tool);
  const body: Record<ToolId, () => ReactNode> = {
    penetrometer: () => <Penetrometer s={s} />,
    auger: () => <Auger s={s} />,
    frame: () => <Frame s={s} />,
    shovel: () => <Shovel s={s} />,
    lens: () => <Lens s={s} />,
    ndvi: () => <Ndvi s={s} />,
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="thin-scroll max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-50">{TOOLS[tool].name}</h3>
            <p className="text-[11px] text-slate-400">Вимірювання: {formatDay(s.day)} · {s.crop ? CROPS[s.crop.id].name : 'поле без культури'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Закрити"><X className="h-4 w-4" /></button>
        </div>
        {!rel.relevant && rel.warning && (
          <div className="mx-4 mt-3 flex gap-2 rounded-lg border border-amber-600/70 bg-amber-950/60 p-2.5 text-xs leading-relaxed text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>{rel.warning}</span>
          </div>
        )}
        <div className="p-4 text-xs text-slate-200">{body[tool]()}</div>
      </div>
    </div>
  );
}

const Row = ({ k, v, warn }: { k: string; v: ReactNode; warn?: boolean }) => (
  <div className="flex justify-between gap-3 border-b border-slate-800 py-1">
    <span className="text-slate-400">{k}</span>
    <span className={`text-right font-mono ${warn ? 'text-red-300' : 'text-slate-100'}`}>{v}</span>
  </div>
);

// --------------------------------------------------------------------------- пенетрометр
function Penetrometer({ s }: { s: SimState }) {
  const prof = penetrometerProfile(s);
  const W = 520, H = 360, L = 50, T = 20;
  const xs = (mpa: number) => L + (mpa / 5) * (W - L - 20);
  const ys = (d: number) => T + (d / 150) * (H - T - 20);
  const pts = prof.map((p) => `${xs(p.mpa)},${ys(p.depth)}`).join(' ');
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-slate-950">
        <rect x={xs(0)} y={T} width={xs(2.2) - xs(0)} height={H - T - 20} fill="#16a34a" opacity={0.16} />
        <rect x={xs(2.2)} y={T} width={xs(3.0) - xs(2.2)} height={H - T - 20} fill="#eab308" opacity={0.18} />
        <rect x={xs(3.0)} y={T} width={xs(5) - xs(3.0)} height={H - T - 20} fill="#dc2626" opacity={0.18} />
        {[0, 1, 2, 2.2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={xs(v)} y1={T} x2={xs(v)} y2={H - 20} stroke="#334155" strokeDasharray={v === 2.2 || v === 3 ? '0' : '3 3'} />
            <text x={xs(v)} y={T - 6} fill="#94a3b8" fontSize={10} textAnchor="middle">{fmt(v, v % 1 ? 1 : 0)}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 35, 50, 80, 100, 120, 150].map((d) => (
          <g key={d}>
            <line x1={L - 4} y1={ys(d)} x2={W - 20} y2={ys(d)} stroke="#1e293b" />
            <text x={L - 8} y={ys(d) + 3} fill="#94a3b8" fontSize={10} textAnchor="end">{d}</text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={2.2} />
        {prof.map((p) => <circle key={p.depth} cx={xs(p.mpa)} cy={ys(p.depth)} r={1.8} fill={p.mpa >= 3 ? '#f87171' : p.mpa >= 2.2 ? '#facc15' : '#4ade80'} />)}
        <text x={W - 22} y={H - 4} fill="#94a3b8" fontSize={10} textAnchor="end">Опір пенетрації, МПа</text>
        <text x={12} y={H / 2} fill="#94a3b8" fontSize={10} transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">Глибина, см</text>
      </svg>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Максимум по горизонтах</div>
        {LAYER_DEFS.map((d) => {
          const pts2 = prof.filter((p) => p.depth >= d.top && p.depth < d.bottom);
          const mx = Math.max(...pts2.map((p) => p.mpa));
          return <Row key={d.id} k={d.short} v={`${fmt(mx, 2)} МПа`} warn={mx >= PAN_LIMIT} />;
        })}
        <div className="mt-3 space-y-1 text-[10px] text-slate-400">
          <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />&lt; 2,2 МПа</div>
          <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-yellow-400" />2,2–2,9 МПа</div>
          <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />≥ 3,0 МПа</div>
          <div className="pt-1">Конус 30°, Ø 12,83 мм; швидкість занурення 2 см/с. Вологість A: {fmt(layer(s, 'arable').moisture, 0)}% НВ.</div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- бур + вологомір
function Auger({ s }: { s: SimState }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left font-mono text-[11px]">
          <thead className="text-[10px] uppercase text-slate-400">
            <tr className="border-b border-slate-700">
              <th className="py-1.5">Горизонт</th><th>Вологість, % НВ</th><th>Прод. волога, мм</th><th>Щільн., г/см³</th><th>N доступ., мг/кг</th><th>NO₃, мг/кг</th><th>pH</th><th>Гумус, %</th><th>t°, °C</th>
            </tr>
          </thead>
          <tbody>
            {s.layers.map((l) => (
              <tr key={l.id} className="border-b border-slate-800">
                <td className="py-1.5 font-sans text-slate-300">{LAYER_DEFS.find((d) => d.id === l.id)!.short} <span className="text-slate-500">{LAYER_DEFS.find((d) => d.id === l.id)!.name.split(' ')[0]}</span></td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 overflow-hidden rounded bg-slate-800"><div className="h-full bg-sky-500" style={{ width: `${clamp(l.moisture, 0, 100)}%` }} /></div>
                    {fmt(l.moisture, 0)}
                  </div>
                </td>
                <td>{productiveMoisture(s, l.top, l.bottom)}</td>
                <td>{fmt(l.density, 2)}</td>
                <td>{fmt(l.nitrogen, 1)}</td>
                <td>{fmt(l.nitrate, 1)}</td>
                <td>{fmt(l.pH, 1)}</td>
                <td>{fmt(l.humus, 1)}</td>
                <td>{fmt(l.temp, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Row k="Прод. волога 0–20 см" v={`${productiveMoisture(s, 0, 20)} мм`} />
        <Row k="Прод. волога 0–100 см" v={`${productiveMoisture(s, 0, 100)} мм`} />
        <Row k="Прод. волога 0–150 см" v={`${productiveMoisture(s, 0, 150)} мм`} />
      </div>
      <p className="text-[10px] text-slate-500">Відбір проб ґрунтовим буром Ø 30 мм, термостатно-ваговий метод, експрес-аналіз нітратів іоноселективним електродом.</p>
    </div>
  );
}

// --------------------------------------------------------------------------- рамка 1 м²
const WEEDS = [
  ['Амброзія полинолиста', 'Ambrosia artemisiifolia', 0.28],
  ['Лобода біла', 'Chenopodium album', 0.22],
  ['Плоскуха звичайна', 'Echinochloa crus-galli', 0.2],
  ['Щириця загнута', 'Amaranthus retroflexus', 0.18],
  ['Осот рожевий', 'Cirsium arvense', 0.12],
] as const;

function Frame({ s }: { s: SimState }) {
  const c = s.crop;
  const target = c ? TARGET_DENSITY[c.id] : 0;
  const actual = c && c.emerged && !c.dead ? (target * c.stand) / 100 : 0;
  const unit = c?.id === 'wheat' || c?.id === 'soy' || c?.id === 'rapeseed' ? 'шт./м²' : 'шт./м²';
  const weedsTotal = Math.round(s.weeds);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Культура</div>
        <Row k="Культура" v={c ? CROPS[c.id].name : '—'} />
        <Row k="Норма висіву (схожих насінин)" v={c ? `${fmt(target, target < 20 ? 1 : 0)} ${unit}` : '—'} />
        <Row k="Рослин на 1 м²" v={c ? `${fmt(actual, actual < 20 ? 1 : 0)} ${unit}` : '—'} />
        <Row k="Польова схожість / густота" v={c ? (c.emerged ? `${Math.round(c.stand)}%` : '0% (сходів немає)') : '—'} warn={!!c && c.emerged && c.stand < 70} />
        <Row k="Фаза BBCH" v={c ? String(c.bbch).padStart(2, '0') : '—'} />
        <Row k="Рядки (облік у 4 повтореннях)" v={c ? [0, 1, 2, 3].map((k) => fmt(actual * (0.9 + hashRand(s.day, k, 'fr') * 0.2), actual < 20 ? 1 : 0)).join(' / ') : '—'} />
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Бур'яни (облікова рамка 1 м²)</div>
        {WEEDS.map(([n, lat, f]) => (
          <Row key={n} k={`${n} (${lat})`} v={`${Math.round(weedsTotal * f)} шт.`} />
        ))}
        <Row k="Усього бур'янів" v={`${weedsTotal} шт./м²`} warn={weedsTotal > EPSH_WEEDS} />
        <Row k="ЕПШ (довідково)" v={`${EPSH_WEEDS} шт./м²`} />
        <Row k="Фаза бур'янів" v={s.weeds < 3 ? 'сім\'ядолі' : s.weeds < 15 ? '2–4 листки' : 'розетка / кущіння'} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- лопатка + лінійка
function Shovel({ s }: { s: SimState }) {
  const c = s.crop;
  if (!c) {
    return (
      <div className="space-y-1">
        <Row k="Посів" v="відсутній" />
        <Row k="Кірка на поверхні" v={s.crust ? `${fmt(s.crust)} см` : 'немає'} warn={s.crust > 0} />
        <Row k="Вологість шару 2–8 см (на дотик)" v={layer(s, 'seedbed').moisture > 60 ? 'волога, скочується в джгут' : layer(s, 'seedbed').moisture > 40 ? 'свіжа, грудочкувата' : 'суха, пилувата'} />
        <Row k="Стерня" v={`${s.residue}% поверхні`} />
      </div>
    );
  }
  const def = CROPS[c.id];
  const measured = c.depth + (hashRand(s.day, 'dep') - 0.5) * 0.4;
  const gE = gddForBbch(c.id, 10);
  const prog = clamp(c.gdd / gE, 0, 1);
  const alive10 = Math.round((c.emerged ? c.stand : c.germPotential) / 10);
  let seed = '';
  if (c.dead && !c.emerged) seed = 'Насіння та проростки розм\'яклі, бурі, з ознаками гниття.';
  else if (!c.emerged) {
    if (c.bbch < 1) seed = 'Насіння сухе, не набубнявіле.';
    else if (c.bbch < 5) seed = 'Насіння набубнявіле, оболонка розм\'якла.';
    else if (c.bbch < 7) seed = `Зародковий корінець ${Math.round(prog * 18)} мм.`;
    else if (c.corkscrew && s.crust > 0)
      seed = `${def.epigeal ? 'Гіпокотиль' : 'Колеоптиль'} довжиною ${Math.round((c.depth - s.crust) * 10 + 9)} мм досягає нижньої межі кірки, спірально («штопором») закручений, верхівка сплющена, блідо-жовта; ${def.epigeal ? 'сім\'ядолі' : 'листок'} не виходять на поверхню. Живих проростків: ${alive10} з 10.`;
    else seed = `${def.epigeal ? 'Гіпокотиль' : 'Колеоптиль'} ${Math.round(prog * c.depth * 10)} мм, прямий, тургесцентний. Живих проростків: ${alive10} з 10.`;
  }
  const gpUnder = c.id === 'corn' || c.id === 'wheat' ? c.bbch < (c.id === 'corn' ? 16 : 30) : false;
  const gpText = !c.emerged
    ? '—'
    : gpUnder
      ? `під поверхнею, на глибині ~${c.id === 'corn' ? '2,5' : '1,5–2'} см`
      : c.id === 'corn' || c.id === 'wheat'
        ? `у стеблі над поверхнею (~${Math.round(heightGP(c))} см)`
        : 'верхівкова, над поверхнею ґрунту';
  const gpState = !c.emerged ? '—' : c.growingPointAlive && !c.dead
    ? 'поздовжній розріз: конус наростання щільний, біло-кремовий, тургесцентний, без запаху'
    : 'поздовжній розріз: тканини водянисті, буро-сірі, розм\'яклі, гнильний запах';
  const blocked = panBlocking(s) && c.rootBlocked;
  const roots = !c.emerged
    ? `зародковий корінь ${Math.round(prog * 18)} мм`
    : blocked
      ? c.id === 'sugarbeet'
        ? 'коренеплід на глибині 28–30 см роздвоєний («хвостатий»), бічні відгалуження розходяться горизонтально; кінчики потовщені, сплющені'
        : 'основна маса коренів на глибині 28–30 см різко змінює напрямок на горизонтальний (Г-подібний вигин); кінчики коренів потовщені, сплющені, буруваті'
      : `коріння рівномірно проникає вглиб, без деформацій`;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Row k="Фактична глибина загортання (лінійка)" v={`${fmt(measured)} см`} />
        <Row k="Стан насіння / проростків" v={<span className="block max-w-[240px] font-sans text-[11px] leading-snug">{seed || 'сходи на поверхні'}</span>} />
        <Row k="Кірка" v={s.crust ? `${fmt(s.crust)} см, міцна, при натисканні ламається пластинами` : 'немає'} warn={s.crust > 0} />
        <Row k="Вологість на глибині насіння" v={`${fmt(layer(s, 'seedbed').moisture, 0)}% НВ`} />
        <Row k="t° ґрунту на глибині насіння" v={`${fmt(s.weather.tSoil)} °C`} />
      </div>
      <div>
        <Row k="Точка росту: розташування" v={<span className="block max-w-[230px] font-sans text-[11px] leading-snug">{gpText}</span>} />
        <Row k="Точка росту: стан" v={<span className="block max-w-[230px] font-sans text-[11px] leading-snug">{gpState}</span>} warn={c.emerged && !c.growingPointAlive} />
        <Row k="Листя" v={<span className="block max-w-[230px] font-sans text-[11px] leading-snug">{c.leafFrost > 0.15 ? `${Math.round(c.leafFrost * 100)}% листкової поверхні — темні, мацеровані, некротизовані тканини` : c.emerged ? 'без механічних і термічних пошкоджень' : '—'}</span>} />
        <Row k="Глибина проникнення коренів" v={`${fmt(c.rootDepth, 0)} см`} />
        <Row k="Морфологія коренів" v={<span className="block max-w-[230px] font-sans text-[11px] leading-snug">{roots}</span>} />
        {c.id === 'soy' && c.emerged && (
          <Row
            k="Бульбочки на коренях"
            v={c.nodules < 1 ? 'відсутні' : `${Math.round(c.nodules)} шт./рослину, на розрізі ${c.nodules > 6 ? 'рожево-червоні' : 'білі / зеленуваті'}`}
          />
        )}
      </div>
    </div>
  );
}

function heightGP(c: NonNullable<SimState['crop']>) {
  return clamp((c.bbch - 15) * 2.5, 2, 120);
}

// --------------------------------------------------------------------------- N-тестер + лупа
const PESTS: Record<string, string> = {
  corn: 'Попелиця злакова (Rhopalosiphum padi), личинки стеблового метелика',
  wheat: 'Попелиця велика злакова (Sitobion avenae), п\'явиця червоногруда',
  sunflower: 'Попелиця соняшникова (Brachycaudus helichrysi)',
  soy: 'Павутинний кліщ (Tetranychus urticae)',
  rapeseed: 'Ріпаковий квіткоїд (Meligethes aeneus)',
  sugarbeet: 'Бурякова блішка (Chaetocnema concinna)',
};

function Lens({ s }: { s: SimState }) {
  const c = liveCrop(s) ?? s.crop;
  if (!c || !c.emerged) return <Row k="Листкова поверхня" v="відсутня — вимірювання неможливе" />;
  const spad = clamp(26 + 22 * Math.min(1.1, c.nStatus) - c.leafFrost * 14 - c.disease * 0.12, 5, 58);
  const wheat = c.id === 'wheat';
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">N-тестер хлорофілу (30 замірів)</div>
        <Row k="Показник хлорофілу, SPAD" v={fmt(spad, 1)} />
        <Row k="Розкид замірів" v={`${fmt(spad - 3.1, 1)} … ${fmt(spad + 2.7, 1)}`} />
        <Row k="Колір верхнього листка" v={c.nStatus < 0.6 ? 'світло-зелений, жовтіє від верхівки' : c.nStatus < 0.85 ? 'зелений з посвітлінням' : 'темно-зелений'} />
        <Row k="Нижні листки" v={c.nStatus < 0.6 ? 'жовтіють V-подібно вздовж центральної жилки' : 'зелені'} />
      </div>
      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Агрономічна лупа ×20</div>
        <Row k="Площа некротичних плям" v={`${fmt(c.disease, 0)}% (нижній ярус)`} />
        {wheat ? (
          <>
            <Row k="Пікніди в межах плям" v={c.disease > 3 ? `темно-бурі, ~${Math.round(c.disease * 1.4)} шт./см²` : 'не виявлено'} />
            <Row k="Форма плям" v={c.disease > 3 ? 'видовжені, обмежені жилками, світло-бурі з темним облямівком' : '—'} />
          </>
        ) : (
          <Row k="Спороношення" v={c.disease > 5 ? 'поодинокі пустули / наліт на нижніх листках' : 'не виявлено'} />
        )}
        <Row k="Шкідники, ос./рослину" v={fmt(c.pests, 1)} />
        <Row k="Видовий склад" v={<span className="block max-w-[230px] font-sans text-[11px] leading-snug">{c.pests > 0.5 ? PESTS[c.id] : 'не виявлено'}</span>} />
        <Row k="Тканини листка" v={c.leafFrost > 0.15 ? 'клітини зруйновані, тканина мацерована' : c.wilting ? 'тургор знижений, продихи закриті' : 'тургесцентні'} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- NDVI
function Ndvi({ s }: { s: SimState }) {
  const c = liveCrop(s);
  const cols = 18, rows = 10;
  const cover = canopyCover(c);
  const weedsG = Math.min(0.25, s.weeds * 0.006);
  const pan = effRes(layer(s, 'pan'));
  const cells: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const n = (hashRand(r, k, 'nd') - 0.5) * 0.08 + Math.sin(k * 0.6 + r * 0.3) * 0.03;
      let v = 0.15 + weedsG;
      if (c) {
        v += cover * 0.75 * (0.6 + c.health * 0.004) * (0.6 + Math.min(1, c.nStatus) * 0.4);
        if (c.wilting && pan >= PAN_LIMIT) v -= ((Math.sin(k * 0.9) + 1) / 2) * 0.12;
        v -= c.disease * 0.002;
      }
      cells.push(clamp(v + n, 0.15, 0.88));
    }
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  const color = (v: number) => {
    const t = (v - 0.15) / 0.73;
    const h = t * 120;
    return `hsl(${h} 70% ${32 + t * 10}%)`;
  };
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_200px]">
      <div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-slate-700" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {cells.map((v, i) => (
            <div key={i} className="aspect-square text-center text-[7px] leading-[2.2] text-black/60" style={{ background: color(v) }} title={fmt(v, 2)}>
              {fmt(v, 2).slice(1)}
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 rounded" style={{ background: 'linear-gradient(90deg, hsl(0 70% 32%), hsl(60 70% 37%), hsl(120 70% 42%))' }} />
        <div className="flex justify-between text-[10px] text-slate-400"><span>0,15</span><span>0,50</span><span>0,88</span></div>
      </div>
      <div>
        <Row k="NDVI середній" v={fmt(mean, 2)} />
        <Row k="NDVI мін." v={fmt(Math.min(...cells), 2)} />
        <Row k="NDVI макс." v={fmt(Math.max(...cells), 2)} />
        <Row k="Коефіцієнт варіації" v={`${fmt((Math.sqrt(cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length) / mean) * 100, 1)}%`} />
        <Row k="Знімок" v="Sentinel-2, 10 м/піксель" />
        <Row k="Хмарність" v={s.weather.rain > 2 ? '64% (дані частково)' : '3%'} />
      </div>
    </div>
  );
}
