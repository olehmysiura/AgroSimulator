// ============================================================================
// Вкладка «Рослина»: дослідження від сухої насінини до повної стиглості.
// Розрізи насінини та органів, шари покривів, етапи органогенезу.
// ============================================================================
import { Link2, Link2Off } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { CROPS, CROP_ORDER, PHYS, bbchStageName } from '../../sim/data';
import { COAT_LAYERS, SEED_PARTS, leafTissues, organogenesis, rootTissues, seedState, stemTissues, type Part } from '../../sim/anatomy';
import { cropAtBbch } from '../../sim/engine';
import { phasePerformance, phaseOf, PHASE_NAMES } from '../../sim/physiology';
import { layer, panBlocking } from '../../sim/soil';
import type { Crop, CropId, SimState } from '../../sim/types';
import { fmt } from '../../sim/util';
import { G, Germinating, Plant, Roots, depthY, plantHeightPx } from '../FieldView';
import SeedSection from './SeedSection';
import { ApexSection, GenSection, LeafSection, RootSection, StemSection, type SectionProps } from './OrganSections';

type View = 'seed' | 'plant' | 'root' | 'stem' | 'leaf' | 'apex' | 'gen';
const VIEWS: [View, string][] = [['seed', 'Насінина / зернина'], ['plant', 'Ціла рослина'], ['root', 'Корінь'], ['stem', 'Стебло'], ['leaf', 'Листок'], ['apex', 'Конус наростання'], ['gen', 'Генеративні органи']];

const APEX_PARTS: Part[] = [
  { id: 'apex', name: 'Апікальна меристема (конус наростання)', color: '#d9e8a0', text: 'Клітини, що безперервно діляться. Тут закладаються всі надземні органи; з переходом до генеративного розвитку конус перетворюється на суцвіття. Загибель конуса = загибель пагона.' },
  { id: 'leafprim', name: 'Листкові примордії', color: '#7fb85a', text: 'Зачатки листків, що послідовно відокремлюються від конуса й огортають його, захищаючи від пересихання та холоду.' },
];
const GEN_PARTS: Record<CropId, Part[]> = {
  corn: [
    { id: 'kernel', name: 'Зернівки', color: '#e0b64a', text: 'Запліднюються від основи до верхівки качана: якщо під час цвітіння була спека чи посуха, верхівка лишається порожньою.' },
    { id: 'cob', name: 'Стрижень качана', color: '#e8dcc0', text: 'Вісь жіночого суцвіття; 14–18 рядів зерен завжди парна кількість.' },
    { id: 'husk', name: 'Обгортки', color: '#b9d67a', text: 'Видозмінені листки; захищають від птахів і вологи, фотосинтезують.' },
    { id: 'silk', name: 'Приймочки («шовк»)', color: '#c98b5a', text: 'Кожна нитка веде до однієї зав\'язі. Буріють після запліднення; у посуху виходять пізніше, ніж висипається пилок.' },
  ],
  wheat: [
    { id: 'spikelet', name: 'Колосок із зернівками', color: '#d9b24c', text: 'У колоску 3–5 квіток, зерно дають 2–3. Середні колоски найпродуктивніші.' },
    { id: 'sterile', name: 'Безплідні колоски', color: '#9bbd5c', text: 'Нижні та верхні колоски редукуються першими за нестачі вологи, азоту чи за приморозку в трубкування.' },
    { id: 'rachis', name: 'Колосовий стрижень', color: '#b9c46a', text: 'Членики стрижня закладаються на III етапі органогенезу — від умов кущіння залежить довжина колоса.' },
  ],
  sunflower: [
    { id: 'achenes', name: 'Сім\'янки (трубчасті квітки)', color: '#2e2a26', text: 'Цвітіння йде від краю до центру 7–10 діб; центральні квітки запилюються останніми і першими страждають від стресу.' },
    { id: 'receptacle', name: 'Ложе кошика', color: '#9fb86a', text: 'Губчаста тканина; після цвітіння — джерело вологи для наливу. Тут розвивається біла та сіра гниль.' },
    { id: 'ray', name: 'Язичкові квітки', color: '#f5c518', text: 'Безплідні — лише приваблюють комах-запилювачів.' },
  ],
  soy: [
    { id: 'seed', name: 'Насінини', color: '#e6cf7a', text: 'Зав\'язуються 2–3; за посухи в цвітіння рослина скидає квітки й молоді боби (абортивність до 70%).' },
    { id: 'valve', name: 'Стулки боба', color: '#8fbf4f', text: 'Фотосинтезують і тимчасово накопичують азот для насіння; перестиглі — розтріскуються.' },
  ],
  rapeseed: [
    { id: 'seed', name: 'Насінини', color: '#2a221c', text: '18–30 насінних зачатків, реалізується 12–20. Квіткоїд, приморозок і брак сірки/бору зменшують їх число.' },
    { id: 'valve', name: 'Стулки стручка', color: '#8fbf4f', text: 'Після опадання листя стручки — головний фотосинтезуючий орган. Розтріскування — джерело втрат при збиранні.' },
    { id: 'septum', name: 'Перегородка', color: '#e9e6d2', text: 'Несправжня плівчаста перегородка, до якої прикріплені насінини.' },
  ],
  sugarbeet: [],
};

function pseudoCrop(id: CropId, bbch: number): Crop {
  const def = CROPS[id];
  return cropAtBbch(id, bbch, 100, (def.depthMin + def.depthMax) / 2, 96);
}

export default function ExplorePlant({ state: s }: { state: SimState }) {
  const field = s.crop && !s.crop.dead ? s.crop : null;
  const [sync, setSync] = useState(true);
  const [cropSel, setCropSel] = useState<CropId>(field?.id ?? 'wheat');
  const [stageIdx, setStageIdx] = useState(0);
  const [view, setView] = useState<View>('seed');
  const [sel, setSel] = useState<string | null>(null);

  const live = sync && field ? field : null;
  const id = live ? live.id : cropSel;
  const stages = CROPS[id].bbch.map((b) => b[1]);
  const bbch = live ? live.bbch : stages[Math.min(stageIdx, stages.length - 1)];
  const c = useMemo(() => live ?? pseudoCrop(id, bbch), [live, id, bbch]);
  const perf: [number, number, number] = live ? phasePerformance(live, true) : [1, 1, 1];
  const fill = Math.min(1, perf[2] ** (PHYS[id].sens[2] * 2.2));
  const st = seedState(id, bbch);
  const a = layer(s, 'arable');
  const sp: SectionProps = { id, c, sel, onSel: setSel, perf, soilMoist: live ? a.moisture : 70, soilPh: live ? a.pH : 6.5 };

  const parts: Part[] =
    view === 'seed' ? SEED_PARTS[PHYS[id].seed.type]
      : view === 'stem' ? stemTissues(id)
        : view === 'root' ? rootTissues(id)
          : view === 'leaf' ? leafTissues(id)
            : view === 'apex' ? APEX_PARTS
              : view === 'gen' ? (id === 'sugarbeet' ? rootTissues(id) : GEN_PARTS[id])
                : [];
  const selPart = parts.find((p) => p.id === sel);
  const org = organogenesis(id, bbch);
  const ph = live ? phaseOf(live) : -1;

  let drawing: ReactNode;
  if (view === 'seed') drawing = <SeedSection id={id} st={st} sel={sel} onSel={setSel} fill={fill} />;
  else if (view === 'stem') drawing = c.emerged ? <StemSection {...sp} /> : <Empty text="Стебло ще не сформоване — рослина у фазі проростання." />;
  else if (view === 'root') drawing = <RootSection {...sp} />;
  else if (view === 'leaf') drawing = c.emerged ? <LeafSection {...sp} /> : <Empty text="Листків ще немає — перший листок згорнутий у колеоптилі / між сім'ядолями." />;
  else if (view === 'apex') drawing = <ApexSection {...sp} />;
  else if (view === 'gen') drawing = <GenSection {...sp} />;
  else drawing = <WholePlant c={c} s={s} live={!!live} onPick={(v) => { setView(v); setSel(null); }} />;

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 text-xs">
      {/* керування: культура, фаза, синхронізація з полем */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CROP_ORDER.map((k) => (
            <button key={k} type="button" disabled={!!live} onClick={() => { setCropSel(k); setStageIdx(0); setSel(null); }} className={`rounded-md px-2 py-1 text-[11px] ${id === k ? 'bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-500/60' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'} disabled:opacity-50`}>
              {CROPS[k].name}
            </button>
          ))}
        </div>
        <button type="button" disabled={!field} onClick={() => { if (!sync && field) { setCropSel(field.id); } else if (field) { setCropSel(field.id); setStageIdx(Math.max(0, stages.indexOf(field.bbch))); } setSync(!sync); }} className={`ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${live ? 'bg-sky-600/30 text-sky-100 ring-1 ring-sky-500/60' : 'bg-slate-800 text-slate-300'} disabled:opacity-40`} title="Показувати фактичний стан рослин на полі або довільну фазу">
          {live ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
          {live ? 'Синхронно з полем' : field ? 'Довільна фаза (поле відв\'язано)' : 'Поле без культури — довільна фаза'}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5">
        <span className="w-44 shrink-0 font-mono text-[11px] text-emerald-200">BBCH {String(bbch).padStart(2, '0')} · {bbchStageName(id, bbch)}</span>
        <input type="range" min={0} max={stages.length - 1} value={live ? Math.max(0, stages.indexOf(bbch)) : stageIdx} disabled={!!live} onChange={(e) => { setStageIdx(+e.target.value); setSel(null); }} className="min-w-0 flex-1 disabled:opacity-50" aria-label="Фаза розвитку" />
        <span className="hidden text-[10px] text-slate-500 sm:block">сухе насіння → повна стиглість</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {VIEWS.map(([v, name]) => (
          <button key={v} type="button" onClick={() => { setView(v); setSel(null); }} className={`rounded-md px-2 py-1 text-[11px] font-medium ${view === v ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/60' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {v === 'seed' ? PHYS[id].seed.name + ' (розріз)' : v === 'gen' && id === 'sugarbeet' ? 'Коренеплід' : name}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-1">{drawing}</div>

        <div className="thin-scroll flex flex-col gap-2 overflow-y-auto">
          {view === 'seed' && (
            <Card title={st.title}>
              <p className="leading-snug text-slate-300">{st.text}</p>
              <dl className="mt-1.5 space-y-0.5">{st.facts.map(([k, v]) => <Row key={k} k={k} v={v} />)}</dl>
            </Card>
          )}
          {view === 'apex' && <Card title={`Етап ${org.stage}: ${org.title}`}><p className="leading-snug text-slate-300">{org.text}</p></Card>}
          {view === 'plant' && (
            <Card title={`${CROPS[id].name} · BBCH ${String(bbch).padStart(2, '0')}`}>
              <Row k="Висота" v={c.emerged ? `${Math.round(plantHeightPx(c) / 0.78)} см` : '—'} />
              <Row k="Глибина коренів" v={`${fmt(c.rootDepth, 0)} см${c.rootBlocked ? ' (впирається в підошву)' : ''}`} />
              <Row k="Листковий індекс (LAI)" v={`${fmt(c.lai, 2)} м²/м²`} />
              <Row k="Надземна суха біомаса" v={`${fmt(c.biomass, 2)} т/га`} />
              <Row k="Етап органогенезу" v={org.stage} />
              <p className="mt-1 text-[10px] text-slate-500">Натисніть на позначку органа, щоб зробити зріз.</p>
            </Card>
          )}
          {live && (
            <Card title="Стан рослин на полі зараз">
              <Row k="Відносний ріст сьогодні" v={`${Math.round(live.gToday * 100)}%`} warn={live.gToday < 0.7} />
              <Row k="Вода (ETa/ETm)" v={fmt(live.waterSupply, 2)} warn={live.waterSupply < 0.6} />
              <Row k="Азот (NNI)" v={fmt(live.nStatus, 2)} warn={live.nStatus < 0.8} />
              <Row k="Винесено N" v={`${Math.round(live.nUptake)} кг/га${live.nFixed > 1 ? ` (фіксація ${Math.round(live.nFixed)})` : ''}`} />
              <Row k="Ураження хворобою" v={`${fmt(live.disease, 0)}%`} warn={live.disease > 15} />
              <Row k={`Шкідник, ${CROPS[id].pest.unit}`} v={fmt(live.pests)} />
              {ph >= 0 && ph <= 2 && <Row k="Поточна фаза формування врожаю" v={PHASE_NAMES[id][ph]} />}
              {panBlocking(s) && live.rootBlocked && <Row k="Коренева система" v="обмежена шаром 0–30 см" warn />}
            </Card>
          )}
          {parts.length > 0 && (
            <Card title={view === 'seed' ? 'Частини насінини' : 'Тканини та органи'}>
              <ul className="space-y-0.5">
                {parts.map((p) => (
                  <li key={p.id}>
                    <button type="button" onMouseEnter={() => setSel(p.id)} onClick={() => setSel(sel === p.id ? null : p.id)} className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left ${sel === p.id ? 'bg-emerald-600/25 text-emerald-100' : 'text-slate-300 hover:bg-slate-800'}`}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white/20" style={{ background: p.color }} />
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
              {selPart && <p className="mt-1.5 rounded-md bg-slate-950 p-2 leading-snug text-sky-100">{selPart.text}</p>}
            </Card>
          )}
          {view === 'seed' && (
            <Card title="Шари покривів під мікроскопом (ззовні → всередину)">
              <div className="overflow-hidden rounded-md border border-slate-700">
                {COAT_LAYERS[PHYS[id].seed.type].map((l) => (
                  <div key={l.name} className="flex items-center justify-between gap-2 px-2 text-[10px] font-medium text-black/80" style={{ background: l.color, height: Math.max(16, l.h * 0.7), color: l.color < '#5' ? '#e2e8f0' : undefined }}>
                    <span>{l.name}</span>
                    <span className="opacity-70">{l.note}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-lg border border-slate-800 bg-slate-900 p-2">
    <h4 className="mb-1 text-[11px] font-semibold text-emerald-300">{title}</h4>
    {children}
  </section>
);
const Row = ({ k, v, warn }: { k: string; v: ReactNode; warn?: boolean }) => (
  <div className="flex justify-between gap-2 border-b border-slate-800/70 py-0.5">
    <span className="text-slate-400">{k}</span>
    <span className={`text-right font-mono ${warn ? 'text-amber-300' : 'text-slate-100'}`}>{v}</span>
  </div>
);
const Empty = ({ text }: { text: string }) => <p className="max-w-xs p-6 text-center text-slate-400">{text}</p>;

// --------------------------------------------------------------------------- ціла рослина з точками зрізів
function WholePlant({ c, s, live, onPick }: { c: Crop; s: SimState; live: boolean; onPick: (v: View) => void }) {
  const x = 150;
  const h = c.emerged ? plantHeightPx(c) : 0;
  const blocked = live && panBlocking(s);
  const spots: [View, string, number, number][] = [];
  if (c.emerged) {
    spots.push(['leaf', 'Листок', x + 46, G - h * 0.55]);
    spots.push(['stem', 'Стебло', x - 52, G - Math.max(10, h * 0.25)]);
    spots.push(['apex', 'Конус наростання', x + 52, c.id === 'corn' && c.bbch < 16 ? depthY(2.5) : G - Math.max(6, h * 0.9)]);
    if (c.bbch >= PHYS[c.id].phases[1] || c.id === 'sugarbeet') spots.push(['gen', c.id === 'sugarbeet' ? 'Коренеплід' : 'Суцвіття / плід', x - 56, c.id === 'sugarbeet' ? depthY(12) : G - h * 0.92]);
  }
  spots.push(['root', 'Корінь', x + 50, depthY(Math.min(c.rootDepth, 60) * 0.7 + 4)]);
  spots.push(['seed', c.bbch >= 71 ? 'Зернина' : 'Насінина', x - 54, c.bbch >= 71 ? G - h * 0.6 : depthY(c.depth)]);
  return (
    <svg viewBox="0 0 300 600" className="h-full max-h-[520px] w-full select-none">
      <rect width={300} height={G} fill="#16324f" />
      {[['#3a2c20', 0, 8], ['#2f241b', 8, 30], ['#4a2f26', 30, 35], ['#5d4630', 35, 80], ['#b39566', 80, 150]].map(([col, t, b]) => <rect key={t as number} x={0} y={depthY(t as number)} width={300} height={depthY(b as number) - depthY(t as number)} fill={col as string} />)}
      {[0, 8, 30, 80, 150].map((d) => <text key={d} x={296} y={Math.min(596, depthY(d) + 10)} fill="#cbd5e1" fontSize={9} textAnchor="end" fontFamily="monospace">{d} см</text>)}
      {c.emerged ? <><Roots c={c} x={x} i={1} blocked={blocked} /><Plant c={c} x={x} i={1} /></> : <Germinating c={c} x={x} i={1} crust={live ? s.crust : 0} />}
      {spots.map(([v, name, sx, sy]) => (
        <g key={v} onClick={() => onPick(v)} className="cursor-pointer">
          <line x1={x} y1={sy} x2={sx} y2={sy} stroke="#fbbf24" strokeWidth={0.8} strokeDasharray="3 2" />
          <circle cx={sx} cy={sy} r={7} fill="#f59e0b" stroke="#0b1220" strokeWidth={1.5} />
          <text x={sx} y={sy + 3} fill="#0b1220" fontSize={9} textAnchor="middle" fontWeight={700}>✂</text>
          <text x={sx + (sx > x ? 11 : -11)} y={sy + 3.5} fill="#fde68a" fontSize={10} textAnchor={sx > x ? 'start' : 'end'}>{name}</text>
        </g>
      ))}
    </svg>
  );
}
