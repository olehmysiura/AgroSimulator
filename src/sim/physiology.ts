// ============================================================================
// Фізіологія посіву: реальний (а не умовний) вплив факторів на ріст і врожай.
//
//  • Щоденний приріст біомаси = ФАР × частка перехопленого світла × RUE × g,
//    де g — добуток коефіцієнтів факторів (вода, аерація, тепло, бур'яни,
//    хвороби, шкідники, ущільнення…) та МІНІМАЛЬНОГО з елементів живлення
//    (закон мінімуму Лібіха: N, P, K, мікроелементи, pH).
//  • Азот — за кривою критичного розведення (індекс азотного живлення NNI),
//    з балансом у кг/га: мінералізація, винос, фіксація бульбочками.
//  • Урожай — мультиплікативна модель Єнсена (FAO): відносна продуктивність
//    кожної фази (вегетативна / генеративна / налив) у степені чутливості фази.
//  • Усі втрати записуються в «облік» за факторами — видно, що саме й коли
//    забрало врожай.
// ============================================================================
import { CROPS, EPSH_WEEDS, FACTORS, PEST_EPSH, PHYS, TARGET_DENSITY, ZONES, gddForBbch, type FactorId } from './data';
import { availFrac, layer, thick } from './soil';
import type { Crop, CropId, SimState, SoilLayer } from './types';
import { clamp, doy, round } from './util';

// --------------------------------------------------------------------------- фази
export function phaseSpans(id: CropId): [number, number, number, number] {
  const ph = PHYS[id].phases;
  return [gddForBbch(id, ph[0]), gddForBbch(id, ph[1]), gddForBbch(id, ph[2]), gddForBbch(id, ph[3])];
}

/** Індекс фази: 0 — вегетативна, 1 — генеративна, 2 — налив; −1 до сходів, 3 — стиглість */
export function phaseOf(c: Crop): number {
  const g = phaseSpans(c.id);
  if (!c.emerged || c.gdd < g[0]) return -1;
  if (c.gdd < g[1]) return 0;
  if (c.gdd < g[2]) return 1;
  if (c.gdd < g[3]) return 2;
  return 3;
}

export const PHASE_NAMES: Record<CropId, [string, string, string]> = {
  corn: ['Вегетативна (сходи – викидання волоті)', 'Генеративна (цвітіння, запліднення)', 'Налив зерна'],
  wheat: ['Кущіння (до виходу в трубку)', 'Трубкування – цвітіння', 'Налив зерна'],
  sunflower: ['Вегетативна (до бутонізації)', 'Бутонізація – цвітіння', 'Налив сім\'янок'],
  soy: ['Вегетативна (до бутонізації)', 'Цвітіння', 'Формування та налив бобів'],
  rapeseed: ['Розетка – стеблування', 'Бутонізація – цвітіння', 'Налив насіння'],
  sugarbeet: ['Формування листкового апарату', 'Наростання коренеплоду', 'Цукронакопичення'],
};

/** Частка проходження всього циклу сходи → стиглість (0..1) */
export function progress(c: Crop): number {
  const g = phaseSpans(c.id);
  return clamp((c.gdd - g[0]) / (g[3] - g[0]), 0, 1);
}

// --------------------------------------------------------------------------- світло
/** ФАР, МДж/м² за добу (широта ~49°) з поправкою на хмарність */
export function dailyPar(s: SimState): number {
  const w = s.weather;
  const rs = 13.2 + 11 * Math.cos((2 * Math.PI * (doy(s.day) - 172)) / 365);
  const cloud = w.rain > 5 ? 0.4 : w.rain > 0.5 ? 0.55 : w.humidity > 80 ? 0.72 : 0.92;
  return round(0.48 * rs * cloud, 2);
}

function laiCurve(id: CropId, p: number): number {
  if (id === 'sugarbeet') return p < 0.45 ? smooth(p / 0.45) : 1 - (p - 0.45) * 0.35;
  if (p < 0.5) return smooth(p / 0.5);
  if (p < 0.72) return 1;
  return Math.max(0.12, 1 - ((p - 0.72) / 0.28) * 0.88);
}
const smooth = (x: number) => x * x * (3 - 2 * x);

export function potentialLai(c: Crop): number {
  return PHYS[c.id].laiMax * laiCurve(c.id, progress(c));
}

export function updateLai(c: Crop) {
  if (!c.emerged) { c.lai = 0; return; }
  const lai = potentialLai(c) * clamp(c.vigor, 0.25, 1) ** 1.2 * Math.min(1.15, (c.stand / 100) ** 0.6) * (1 - 0.8 * c.leafFrost) * (1 - (c.disease / 100) * 0.6) * (c.desiccated ? 0.1 : 1) * (c.lodged ? 0.7 : 1);
  c.lai = round(Math.max(0.02, lai), 2);
}

/** Частка ФАР, перехоплена посівом (закон Бера–Ламберта) */
export const lightInterception = (c: Crop | null) => (!c || !c.emerged || c.dead || c.harvested ? 0 : 1 - Math.exp(-PHYS[c.id].kExt * c.lai));

// --------------------------------------------------------------------------- азот
const kgPerMg = (l: SoilLayer) => thick(l) * l.density * 0.1; // кг/га на 1 мг/кг
export const criticalN = (id: CropId, w: number) => (w < 1 ? PHYS[id].nA : PHYS[id].nA * w ** -PHYS[id].nB); // %

/** Запас мінерального азоту в шарі 0–30 см, кг/га */
export function mineralN(s: SimState): number {
  return round(s.layers.slice(0, 3).reduce((a, l) => a + l.nitrogen * kgPerMg(l), 0), 0);
}

function nitrogenUptake(s: SimState, c: Crop) {
  const w = Math.max(c.biomass, 0.05);
  const crit = 10 * criticalN(c.id, w) * w; // кг/га
  if (w < 0.3) {
    // проросток живе запасом насінини, далі — за концентрацією N у посівному шарі
    c.nStatus = round(clamp(layer(s, 'arable').nitrogen / 9, 0.3, 1.3), 2);
    c.nUptake = crit * c.nStatus;
    return;
  }
  let need = Math.min(6.5, Math.max(0, crit * 1.25 - c.nUptake));
  // біологічна фіксація (соя): залежить від кількості активних бульбочок
  if (c.id === 'soy' && c.nodules > 0 && c.bbch >= 14 && c.bbch < 80) {
    const fix = need * Math.min(0.75, (c.nodules / 28) * 0.75) * clamp(c.waterSupply * 1.3, 0.3, 1);
    c.nUptake += fix;
    c.nFixed += fix;
    need -= fix;
  }
  const zones: { l: SoilLayer; pool: 'nitrogen' | 'nitrate'; acc: number }[] = [];
  for (const l of s.layers) {
    if (l.top >= c.rootDepth) break;
    const pool = l.id === 'transition' || l.id === 'parent' ? 'nitrate' : 'nitrogen';
    const reach = clamp((c.rootDepth - l.top) / thick(l), 0, 1);
    // масовий потік: у сухому ґрунті азот недоступний, навіть якщо він є
    const acc = l[pool] * kgPerMg(l) * 0.11 * reach * Math.sqrt(availFrac(l.moisture) + 0.03) * (l.temp < 4 ? 0.3 : 1);
    zones.push({ l, pool, acc });
  }
  const supply = zones.reduce((a, z) => a + z.acc, 0);
  const take = Math.min(need, supply);
  if (take > 0) for (const z of zones) z.l[z.pool] = Math.max(0.3, z.l[z.pool] - ((take * z.acc) / supply) / kgPerMg(z.l));
  c.nUptake += take;
  c.nStatus = round(clamp(c.nUptake / crit, 0.2, 1.45), 2);
}

/** Задати рослині заданий індекс азотного живлення (для сценаріїв). */
export function setNni(c: Crop, nni: number) {
  const w = Math.max(c.biomass, 0.05);
  c.nUptake = 10 * criticalN(c.id, w) * w * nni;
  c.nStatus = nni;
}

// --------------------------------------------------------------------------- фактори росту
export function computeFactors(s: SimState, c: Crop): Record<FactorId, number> {
  const ph = PHYS[c.id];
  const w = s.weather;
  const a = layer(s, 'arable');
  const sb = layer(s, 'seedbed');
  const z = ZONES[s.zone];
  const n = s.nutrients;
  const phase = phaseOf(c);
  const f = {} as Record<FactorId, number>;

  // вода: відношення фактичної транспірації до потенційної
  f.water = clamp(c.waterSupply, 0.05, 1);
  // аерація: за вологості > НВ пори заповнені водою, корені без кисню
  f.air = a.moisture > 100 ? clamp(1 - ((a.moisture - 100) / 25) * (c.id === 'wheat' ? 0.4 : 0.65), 0.3, 1) : 1;
  // азот
  f.nitrogen = c.nStatus >= 0.95 ? 1 : clamp((c.nStatus / 0.95) ** 0.85, 0.2, 1);
  // фосфор: доступність падає в кислому/лужному середовищі та в холодному ґрунті
  const pH = a.pH;
  const pAvail = n.P2O5 * (pH < 5.5 ? 0.6 : pH > 7.6 ? 0.78 : 1) * (sb.temp < 10 && c.bbch < 16 ? 0.6 : 1);
  f.phosphorus = clamp(0.74 + 0.26 * (pAvail / ph.pCrit), 0.7, 1);
  // калій (у сухому ґрунті дифузія K⁺ сповільнена)
  f.potassium = clamp(0.76 + 0.24 * ((n.K2O * (a.moisture < 40 ? 0.8 : 1)) / ph.kCrit), 0.72, 1);
  // мікро-/мезоелемент, критичний для культури
  const mv = n[ph.micro.el] * (ph.micro.el !== 'S' && pH > 7.4 ? 0.75 : 1);
  f.micro = c.bbch >= ph.micro.from && c.bbch <= ph.micro.to ? clamp(0.7 + 0.3 * (mv / ph.micro.crit), 0.65, 1) : 1;
  // реакція ґрунту: рухомий Al³⁺/Mn²⁺ у кислому середовищі пригнічує корені
  f.ph = pH >= ph.phMin ? (pH > 7.9 ? 0.95 : 1) : clamp(1 - (ph.phMin - pH) * 0.2, 0.55, 1);
  // спека: стерильність пилку в цвітіння, прискорене старіння листя
  const over = w.tMax - ph.heatCrit;
  f.heat = over > 0 ? clamp(1 - over * (phase === 1 ? 0.09 : 0.035), 0.35, 1) : 1;
  // холодовий стрес теплолюбних культур
  f.chill = !CROPS[c.id].winter && c.id !== 'sugarbeet' && w.tMin < 5 && w.tMin > -1.5 ? 0.88 : 1;
  // бур'яни: гіперболічна модель втрат Казенса × критичний період конкуренції
  const d = s.weeds;
  const yl = (ph.weedI * d) / (1 + (ph.weedI * d) / 0.6);
  const cp = c.bbch < 11 ? 0.3 : c.bbch <= 32 ? 1 : c.bbch < 60 ? 0.45 : 0.15;
  f.weeds = clamp(1 - yl * cp, 0.4, 1);
  // хвороби: втрата асиміляційної поверхні (у налив працює прапорцевий лист)
  f.disease = clamp(1 - (c.disease / 100) * (phase === 2 ? 0.8 : phase === 1 ? 0.6 : 0.4), 0.3, 1);
  // шкідники відносно ЕПШ
  const rel = c.pests / PEST_EPSH[c.id];
  const boost = c.id === 'rapeseed' && c.bbch >= 50 && c.bbch < 63 ? 2.5 : 1;
  f.pests = clamp(1 - Math.min(0.5, rel * 0.07 * boost), 0.5, 1);
  // ущільнення: погана аерація й опір росту коренів
  const dc = ph.densCrit + (z.fcPerCm < 2.5 ? 0.12 : 0);
  f.compaction = a.density > dc ? clamp(1 - (a.density - dc) * 2.6, 0.55, 1) : 1;
  // залишкове приморозкове пошкодження листя
  f.frost = clamp(1 - c.leafFrost * 0.7, 0.3, 1);
  // післястресове пригнічення (фітотоксичність, приморозок)
  f.stress = c.stressUntil >= s.day ? 0.8 : 1;
  return f;
}

const NUTRIENTS: FactorId[] = ['nitrogen', 'phosphorus', 'potassium', 'micro', 'ph'];

/** Відносний ріст g та частки відповідальності факторів (за логарифмами). */
export function combine(f: Record<FactorId, number>): { g: number; shares: Partial<Record<FactorId, number>>; limiting: FactorId | null } {
  // закон мінімуму Лібіха для елементів живлення
  let minNut: FactorId = 'nitrogen';
  for (const k of NUTRIENTS) if (f[k] < f[minNut]) minNut = k;
  const active: FactorId[] = (Object.keys(f) as FactorId[]).filter((k) => !NUTRIENTS.includes(k) || k === minNut);
  let g = 1;
  let logSum = 0;
  let limiting: FactorId | null = null;
  for (const k of active) {
    g *= f[k];
    logSum += -Math.log(f[k]);
    if (f[k] < 0.995 && (limiting === null || f[k] < f[limiting])) limiting = k;
  }
  const shares: Partial<Record<FactorId, number>> = {};
  if (logSum > 0) for (const k of active) if (f[k] < 0.999) shares[k] = -Math.log(f[k]) / logSum;
  return { g: clamp(g, 0.02, 1), shares, limiting };
}

// --------------------------------------------------------------------------- добовий ріст
/** Викликається щодня після розрахунку водозабезпечення; `dGdd` — приріст САТ за добу. */
export function dailyGrowth(s: SimState, c: Crop, dGdd: number) {
  nitrogenUptake(s, c);
  const f = computeFactors(s, c);
  const { g, shares, limiting } = combine(f);
  c.factors = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, round(v, 3)]));
  c.limiting = limiting;
  c.gToday = round(g, 3);
  c.gRecent = round(c.gRecent + (g - c.gRecent) * 0.2, 3);

  // біомаса
  updateLai(c);
  const par = dailyPar(s);
  const tF = clamp((s.weather.tAir - CROPS[c.id].baseTemp + 4) / 10, 0, 1); // у холод фотосинтез згасає
  c.biomass = round(c.biomass + PHYS[c.id].rue * par * lightInterception(c) * g * tF * 0.01, 3);

  // облік втрат за фазами
  const p = phaseOf(c);
  if (p >= 0 && p <= 2 && dGdd > 0) {
    const g4 = phaseSpans(c.id);
    const dp = dGdd / (g4[p + 1] - g4[p]);
    c.perfLoss[p] = round(c.perfLoss[p] + dp * (1 - g), 5);
    for (const [k, sh] of Object.entries(shares)) {
      const row = c.ledger[k] ?? [0, 0, 0];
      row[p] = round(row[p] + dp * (1 - g) * (sh ?? 0), 5);
      c.ledger[k] = row;
    }
    const tot = g4[3] - g4[0];
    c.vigor = round((c.vigor * c.vigorW + g * (dGdd / tot)) / (c.vigorW + dGdd / tot), 4);
    c.vigorW = round(c.vigorW + dGdd / tot, 5);
  }
  // загальний стан рослин плавно слідує за відносним ростом
  c.health = round(clamp(c.health + (g * 100 - c.health) * 0.12, 5, 100), 1);
}

/** Перерахувати фактори росту без приросту (стан на момент завантаження сценарію). */
export function refreshFactors(s: SimState, c: Crop) {
  if (!c.emerged) return;
  const f = computeFactors(s, c);
  const { g, limiting } = combine(f);
  c.factors = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, round(v, 3)]));
  c.limiting = limiting;
  c.gToday = round(g, 3);
}

/** Початкові біомаса/листя для культури, заданої одразу у фазі (сценарії). */
export function initPhysiology(c: Crop) {
  const p = progress(c);
  const total = (CROPS[c.id].potential * (c.id === 'sugarbeet' ? 0.24 : 0.86)) / PHYS[c.id].hi; // т/га сухої речовини
  c.biomass = round(Math.max(c.emerged ? 0.02 : 0, total * smooth(p) * c.vigor), 3);
  updateLai(c);
  setNni(c, c.nStatus);
}

// --------------------------------------------------------------------------- урожай
export function phasePerformance(c: Crop, project: boolean): [number, number, number] {
  const g4 = phaseSpans(c.id);
  const gProj = 0.45 + 0.55 * c.gRecent;
  const out: number[] = [];
  for (let p = 0; p < 3; p++) {
    const rem = clamp((g4[p + 1] - Math.max(c.gdd, g4[p])) / (g4[p + 1] - g4[p]), 0, 1);
    out.push(clamp(1 - c.perfLoss[p] - (project && c.emerged ? rem * (1 - gProj) : 0), 0.03, 1));
  }
  return out as [number, number, number];
}

export function relYield(c: Crop, project: boolean): number {
  const r = phasePerformance(c, project);
  const sens = PHYS[c.id].sens;
  return r[0] ** sens[0] * r[1] ** sens[1] * r[2] ** sens[2];
}

export function standFactor(stand: number): number {
  if (stand > 115) return clamp(1 - (stand - 115) * 0.004, 0.75, 1); // загущення: конкуренція
  if (stand >= 85) return 1;
  if (stand <= 0) return 0;
  return clamp(1 - ((85 - stand) / 85) ** 1.3 * 1.05, 0, 1);
}

const EVENT_NAMES: Record<string, string> = {
  bees: 'Загибель запилювачів', phyto: 'Фітотоксичність препарату', frostLeaf: 'Приморозок по сходах',
  frostFlower: 'Заморозок у цвітіння / налив', lateSowing: 'Запізнення зі строком сівби', vernal: 'Відсутність яровизації',
  mechanical: 'Механічне пошкодження рослин', compaction: 'Колії та ущільнення технікою', drift: 'Знесення препарату',
  lodging: 'Вилягання', desiccEarly: 'Передчасна десикація', retard: 'Пізній ретардант', acid: 'Кисла реакція ґрунту',
};

export interface YieldBreakdown {
  potential: number;
  tha: number; // прогноз за поточних умов
  pct: number;
  secured: number; // т/га, якщо решта сезону мине без стресів
  securedPct: number;
  factors: { name: string; value: number }[]; // множники (для звіту)
  losses: { id: string; name: string; tha: number; pct: number; kind: 'stand' | 'factor' | 'event' | 'outlook' }[];
  perf: [number, number, number];
}

export function yieldForecast(s: SimState): YieldBreakdown {
  const c = s.crop;
  const empty: YieldBreakdown = { potential: 0, tha: 0, pct: 0, secured: 0, securedPct: 0, factors: [], losses: [], perf: [1, 1, 1] };
  if (!c) return empty;
  const potential = CROPS[c.id].potential;
  const dec = c.id === 'sugarbeet' ? 1 : 2;
  if (c.dead) return { ...empty, potential, factors: [{ name: 'Загибель посіву', value: 0 }], losses: [{ id: 'dead', name: 'Загибель посіву', tha: potential, pct: 100, kind: 'event' }] };
  const sf = standFactor(c.emerged ? c.stand : c.germPotential);
  const rSec = relYield(c, false);
  const rNow = relYield(c, true);
  const ev = Object.values(c.losses).reduce((a, b) => a * b, 1);
  const total = sf * rNow * ev;
  const losses: YieldBreakdown['losses'] = [];
  if (sf < 0.999) losses.push({ id: 'stand', name: 'Зріджена / загущена густота стояння', tha: potential * (1 - sf), pct: (1 - sf) * 100, kind: 'stand' });
  // динамічні втрати за факторами: зважені на чутливість фаз
  const sens = PHYS[c.id].sens;
  const wts: [string, number][] = Object.entries(c.ledger).map(([k, row]) => [k, row[0] * sens[0] + row[1] * sens[1] + row[2] * sens[2]]);
  const wSum = wts.reduce((a, [, v]) => a + v, 0);
  const dyn = potential * sf * (1 - rSec);
  if (wSum > 0) for (const [k, v] of wts) if (v / wSum > 0.004) losses.push({ id: k, name: FACTORS[k as FactorId]?.name ?? k, tha: (dyn * v) / wSum, pct: ((dyn * v) / wSum / potential) * 100, kind: 'factor' });
  // разові події
  const evLoss = potential * sf * rSec * (1 - ev);
  const logs = Object.entries(c.losses).map(([k, v]) => [k, -Math.log(Math.max(v, 0.001))] as [string, number]);
  const lSum = logs.reduce((a, [, v]) => a + v, 0);
  if (lSum > 0) for (const [k, v] of logs) losses.push({ id: k, name: EVENT_NAMES[k] ?? k, tha: (evLoss * v) / lSum, pct: ((evLoss * v) / lSum / potential) * 100, kind: 'event' });
  // очікувані втрати, якщо поточні умови збережуться
  const outlook = potential * sf * ev * (rSec - rNow);
  if (outlook > potential * 0.004) losses.push({ id: 'outlook', name: 'Очікувані втрати за збереження поточних умов', tha: outlook, pct: (outlook / potential) * 100, kind: 'outlook' });
  losses.sort((x, y) => y.tha - x.tha);
  const factors = [
    { name: 'Густота стояння', value: round(sf, 3) },
    { name: 'Вегетативна фаза', value: round(phasePerformance(c, false)[0] ** sens[0], 3) },
    { name: 'Генеративна фаза', value: round(phasePerformance(c, false)[1] ** sens[1], 3) },
    { name: 'Налив / накопичення', value: round(phasePerformance(c, false)[2] ** sens[2], 3) },
    ...Object.entries(c.losses).map(([k, v]) => ({ name: EVENT_NAMES[k] ?? k, value: round(v, 3) })),
  ];
  return {
    potential,
    tha: round(potential * total, dec),
    pct: Math.round(total * 100),
    secured: round(potential * sf * rSec * ev, dec),
    securedPct: Math.round(sf * rSec * ev * 100),
    factors,
    losses: losses.map((l) => ({ ...l, tha: round(l.tha, dec), pct: round(l.pct, 1) })),
    perf: phasePerformance(c, true),
  };
}

export interface YieldComponents {
  plants: number;
  rows: { name: string; value: number; base: number; unit: string }[];
  formula: string;
  tha: number;
  sugar?: number;
}

/** Структура врожаю: густота × елементи продуктивності (з компенсацією зрідження). */
export function yieldComponents(s: SimState): YieldComponents | null {
  const c = s.crop;
  if (!c || c.dead) return null;
  const ph = PHYS[c.id];
  const potential = CROPS[c.id].potential;
  const stand = c.emerged ? c.stand : c.germPotential;
  const plants = (TARGET_DENSITY[c.id] * stand) / 100;
  const r = phasePerformance(c, true);
  const ev = Object.values(c.losses).reduce((a, b) => a * b, 1);
  const comp = stand > 0 ? standFactor(stand) / (stand / 100) : 0; // компенсаційна здатність рослин
  const b = [...ph.comp.base];
  const y = yieldForecast(s);
  if (c.id === 'sugarbeet') {
    const root = (potential * 100 / TARGET_DENSITY[c.id]) * r[0] ** ph.sens[0] * r[1] ** ph.sens[1] * r[2] ** ph.sens[2] * ev * comp;
    const sugar = b[2] * clamp(0.85 + 0.15 * r[2], 0.7, 1) * (c.nStatus > 1.2 ? 0.94 : 1);
    return {
      plants: round(plants, 1), tha: y.tha, sugar: round(sugar, 1),
      rows: [
        { name: ph.comp.names[0], value: Math.round(b[0] * (0.5 + 0.5 * r[0])), base: b[0], unit: ph.comp.units[0] },
        { name: ph.comp.names[1], value: Math.round(root), base: Math.round(potential * 100 / TARGET_DENSITY[c.id]), unit: ph.comp.units[1] },
        { name: ph.comp.names[2], value: round(sugar, 1), base: b[2], unit: ph.comp.units[2] },
      ],
      formula: `${round(plants, 1)} росл./м² × ${Math.round(root)} г = ${y.tha} т/га коренеплодів · вихід цукру ${round((y.tha * sugar) / 100, 1)} т/га`,
    };
  }
  // нормування бази так, щоб повна реалізація давала генетичний потенціал
  const k = (potential * 100) / ((TARGET_DENSITY[c.id] * b[0] * b[1] * b[2]) / 1000);
  const compIdx = c.id === 'corn' || c.id === 'sunflower' ? 1 : 0;
  const v = [b[0] * r[0] ** ph.sens[0], b[1] * k * r[1] ** ph.sens[1] * ev, b[2] * r[2] ** ph.sens[2]];
  v[compIdx] *= comp;
  const dec = (x: number) => (x >= 100 ? Math.round(x) : x >= 10 ? round(x, 1) : round(x, 2));
  return {
    plants: round(plants, plants < 20 ? 1 : 0),
    tha: y.tha,
    rows: v.map((val, i) => ({ name: ph.comp.names[i], value: dec(val), base: dec(i === 1 ? b[1] * k : b[i]), unit: ph.comp.units[i] })),
    formula: `${round(plants, plants < 20 ? 1 : 0)} × ${dec(v[0])} × ${dec(v[1])} × ${dec(v[2])} г / 100 000 = ${y.tha} т/га`,
  };
}

export { EPSH_WEEDS };
