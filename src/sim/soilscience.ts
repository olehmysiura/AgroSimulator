// ============================================================================
// Ґрунтознавство для вкладки «Дослідження ґрунту»: фазовий склад, гранулометрія,
// валовий та рухомий хімічний склад, ґрунтовий вбирний комплекс, фізичні процеси.
// Статичні властивості — типові для ґрунтів зони, динамічні — зі стану симуляції.
// ============================================================================
import { PHYS, ZONES } from './data';
import { PAN_LIMIT, WP, effRes, infiltrationRate, layer, mineralizationRate, panBlocking, refET, respiration, thick } from './soil';
import type { LayerId, SimState, SoilLayer, ZoneId } from './types';
import { clamp, round } from './util';

const IDX: Record<LayerId, number> = { surface: 0, seedbed: 0, arable: 0, pan: 1, transition: 2, parent: 3 };

// --------------------------------------------------------------------------- гранулометрія
/** [пісок 1–0,05 мм, пил 0,05–0,001, мул < 0,001] у %, для A / підошви / B / C */
const TEXTURE: Record<ZoneId, [number, number, number][]> = {
  polissia: [[72, 21, 7], [70, 22, 8], [64, 22, 14], [78, 15, 7]],
  lisostep: [[12, 55, 33], [11, 54, 35], [10, 53, 37], [9, 60, 31]],
  step: [[16, 46, 38], [15, 45, 40], [13, 44, 43], [11, 52, 37]],
};
const TEXTURE_NAME: Record<ZoneId, string> = { polissia: 'супісок', lisostep: 'важкий суглинок', step: 'легка глина' };

export function texture(zone: ZoneId, id: LayerId) {
  const [sand, silt, clay] = TEXTURE[zone][IDX[id]];
  return { sand, silt, clay, name: TEXTURE_NAME[zone], physClay: Math.round(clay + silt * 0.45) };
}

// --------------------------------------------------------------------------- фази ґрунту
export interface Phases { solid: number; organic: number; water: number; air: number; porosity: number; ice: boolean }

/** Об'ємні частки фаз, %: тверда мінеральна, органічна, вода, повітря. */
export function phases(s: SimState, l: SoilLayer): Phases {
  const z = ZONES[s.zone];
  const porosity = clamp(1 - l.density / 2.62, 0.3, 0.68);
  const fcVol = z.fcPerCm / 10; // см³/см³ за НВ
  const water = Math.min(porosity * 0.98, (l.moisture / 100) * fcVol);
  const organic = clamp((l.humus * l.density) / 1.4 / 100, 0, 0.12);
  return {
    solid: round((1 - porosity - organic) * 100, 1),
    organic: round(organic * 100, 1),
    water: round(water * 100, 1),
    air: round(Math.max(0, porosity - water) * 100, 1),
    porosity: round(porosity * 100, 1),
    ice: l.temp < -0.5,
  };
}

/** Структурно-агрегатний стан */
export function structure(s: SimState, l: SoilLayer) {
  const z = ZONES[s.zone];
  const base = s.zone === 'polissia' ? 28 : s.zone === 'lisostep' ? 68 : 58;
  const depthF = l.id === 'pan' ? 0.45 : l.id === 'transition' ? 0.8 : l.id === 'parent' ? 0.55 : 1;
  const comp = clamp(1 - Math.max(0, l.density - z.densityA - (IDX[l.id] ? 0.2 : 0)) * 2.2, 0.4, 1);
  const wsa = Math.round(base * depthF * comp * (l.id === 'surface' && s.crust > 0 ? 0.5 : 1));
  const kind: Record<LayerId, string> = {
    surface: s.crust > 0 ? 'злита кірка, розбита тріщинами' : 'дрібногрудочкувата, з рештками',
    seedbed: s.seedbedQuality > 0.8 ? 'дрібногрудочкувата (агрегати 1–10 мм)' : s.seedbedQuality < 0.5 ? 'брилувата (грудки > 50 мм)' : 'грудочкувата',
    arable: l.density > z.densityA + 0.15 ? 'злита, брилувата (переущільнена)' : s.zone === 'polissia' ? 'неміцна грудочкувато-пилувата' : 'зерниста, грудочкувато-зерниста',
    pan: effRes(l) >= PAN_LIMIT ? 'плитчаста, листувата — горизонтальні пластини' : 'грудочкувата з тріщинами (розпушена)',
    transition: s.zone === 'polissia' ? 'плитчасто-горіхувата, ілювіальні кутани' : 'горіхувато-призматична',
    parent: s.zone === 'polissia' ? 'безструктурна (роздільночасткова)' : 'стовпчасто-призматична, пориста',
  };
  return { wsa, kind: kind[l.id] };
}

// --------------------------------------------------------------------------- хімія
/** Валовий склад, % на прожарений ґрунт, для A / підошви / B / C */
const GROSS: Record<ZoneId, Record<string, number>[]> = {
  polissia: [
    { SiO2: 86.5, Al2O3: 6.1, Fe2O3: 1.6, CaO: 0.6, MgO: 0.4, K2O: 1.7, Na2O: 0.8, P2O5: 0.09, TiO2: 0.4, MnO: 0.04 },
    { SiO2: 86.0, Al2O3: 6.4, Fe2O3: 1.8, CaO: 0.6, MgO: 0.4, K2O: 1.7, Na2O: 0.8, P2O5: 0.08, TiO2: 0.4, MnO: 0.04 },
    { SiO2: 81.2, Al2O3: 9.4, Fe2O3: 3.1, CaO: 0.7, MgO: 0.7, K2O: 1.9, Na2O: 0.8, P2O5: 0.07, TiO2: 0.5, MnO: 0.05 },
    { SiO2: 88.4, Al2O3: 5.2, Fe2O3: 1.3, CaO: 0.7, MgO: 0.3, K2O: 1.6, Na2O: 0.8, P2O5: 0.05, TiO2: 0.3, MnO: 0.03 },
  ],
  lisostep: [
    { SiO2: 71.8, Al2O3: 12.6, Fe2O3: 4.3, CaO: 1.9, MgO: 1.4, K2O: 2.3, Na2O: 1.0, P2O5: 0.17, TiO2: 0.7, MnO: 0.09 },
    { SiO2: 71.9, Al2O3: 12.7, Fe2O3: 4.4, CaO: 1.8, MgO: 1.4, K2O: 2.3, Na2O: 1.0, P2O5: 0.16, TiO2: 0.7, MnO: 0.09 },
    { SiO2: 70.6, Al2O3: 12.9, Fe2O3: 4.5, CaO: 3.2, MgO: 1.6, K2O: 2.3, Na2O: 1.0, P2O5: 0.14, TiO2: 0.7, MnO: 0.08 },
    { SiO2: 66.4, Al2O3: 11.2, Fe2O3: 4.0, CaO: 8.9, MgO: 2.0, K2O: 2.1, Na2O: 1.1, P2O5: 0.12, TiO2: 0.7, MnO: 0.07 },
  ],
  step: [
    { SiO2: 68.9, Al2O3: 13.8, Fe2O3: 5.0, CaO: 2.6, MgO: 1.9, K2O: 2.5, Na2O: 1.2, P2O5: 0.15, TiO2: 0.8, MnO: 0.09 },
    { SiO2: 68.8, Al2O3: 13.9, Fe2O3: 5.1, CaO: 2.6, MgO: 1.9, K2O: 2.5, Na2O: 1.2, P2O5: 0.14, TiO2: 0.8, MnO: 0.09 },
    { SiO2: 65.2, Al2O3: 13.4, Fe2O3: 4.9, CaO: 6.8, MgO: 2.2, K2O: 2.4, Na2O: 1.3, P2O5: 0.13, TiO2: 0.8, MnO: 0.08 },
    { SiO2: 61.0, Al2O3: 12.1, Fe2O3: 4.4, CaO: 11.6, MgO: 2.5, K2O: 2.2, Na2O: 1.4, P2O5: 0.11, TiO2: 0.7, MnO: 0.07 },
  ],
};

const OXIDE_LABEL: Record<string, string> = {
  SiO2: 'SiO₂ (кремнезем)', Al2O3: 'Al₂O₃', Fe2O3: 'Fe₂O₃', CaO: 'CaO', MgO: 'MgO', K2O: 'K₂O', Na2O: 'Na₂O', P2O5: 'P₂O₅', TiO2: 'TiO₂', MnO: 'MnO',
};

export function grossChemistry(s: SimState, l: SoilLayer) {
  const g = GROSS[s.zone][IDX[l.id]];
  return Object.entries(g).map(([k, v]) => ({ id: k, name: OXIDE_LABEL[k], pct: v }));
}

/** Елементний склад (мас. %), перерахований з оксидів + органічна речовина. */
export function elements(s: SimState, l: SoilLayer) {
  const g = GROSS[s.zone][IDX[l.id]];
  const c = l.humus * 0.58;
  const el: [string, string, number][] = [
    ['O', 'Оксиген', 0],
    ['Si', 'Силіцій', g.SiO2 * 0.467],
    ['Al', 'Алюміній', g.Al2O3 * 0.529],
    ['Fe', 'Ферум', g.Fe2O3 * 0.699],
    ['Ca', 'Кальцій', g.CaO * 0.715],
    ['K', 'Калій', g.K2O * 0.83],
    ['Mg', 'Магній', g.MgO * 0.603],
    ['Na', 'Натрій', g.Na2O * 0.742],
    ['C', 'Карбон (органічний)', c],
    ['Ti', 'Титан', g.TiO2 * 0.6],
    ['N', 'Нітроген (загальний)', l.humus * 0.05],
    ['P', 'Фосфор', g.P2O5 * 0.436],
    ['Mn', 'Манган', g.MnO * 0.774],
    ['S', 'Сульфур', 0.02 + l.humus * 0.008],
  ];
  const others = el.slice(1).reduce((a, e) => a + e[2], 0);
  el[0][2] = clamp(100 - others - 0.6, 40, 55);
  return el.map(([sym, name, pct]) => ({ sym, name, pct: round(pct, pct < 1 ? 3 : 1) })).sort((a, b) => b.pct - a.pct);
}

/** Ґрунтовий вбирний комплекс: ємність катіонного обміну та склад обмінних катіонів. */
export function exchangeComplex(s: SimState, l: SoilLayer) {
  const t = texture(s.zone, l.id);
  const cec = round(t.clay * 0.55 + l.humus * 2.4 + 2, 1); // мг-екв/100 г
  const acid = clamp((6.9 - l.pH) / 2.6, 0, 0.75); // частка H⁺ + Al³⁺
  const na = s.zone === 'step' ? 0.035 : 0.012;
  const k = clamp((s.nutrients.K2O / 470) / cec * (IDX[l.id] ? 0.5 : 1), 0.008, 0.06);
  const rest = 1 - acid - na - k;
  const al = l.pH < 5.5 ? acid * 0.45 : l.pH < 6 ? acid * 0.1 : 0;
  return {
    cec,
    v: Math.round((1 - acid) * 100), // ступінь насичення основами
    cations: [
      { id: 'Ca²⁺', share: round(rest * 0.82 * 100, 1), color: '#e2e8f0' },
      { id: 'Mg²⁺', share: round(rest * 0.18 * 100, 1), color: '#86efac' },
      { id: 'K⁺', share: round(k * 100, 1), color: '#c4b5fd' },
      { id: 'Na⁺', share: round(na * 100, 1), color: '#fde68a' },
      { id: 'H⁺', share: round((acid - al) * 100, 1), color: '#fca5a5' },
      { id: 'Al³⁺', share: round(al * 100, 1), color: '#f87171' },
    ],
  };
}

/** Рухомі (доступні рослинам) форми елементів живлення у горизонті, мг/кг. */
export function availableNutrients(s: SimState, l: SoilLayer) {
  const n = s.nutrients;
  const k = [1, 0.55, 0.3, 0.15][IDX[l.id]];
  const nit = l.temp > 8 ? 0.82 : l.temp > 3 ? 0.6 : 0.35; // частка нітратної форми (нітрифікація)
  const deep = l.id === 'transition' || l.id === 'parent';
  const nTotal = deep ? l.nitrate + l.nitrogen * 0.3 : l.nitrogen;
  const fix = l.pH < 5.5 ? 0.6 : l.pH > 7.6 ? 0.78 : 1;
  const alk = l.pH > 7.4 ? 0.7 : 1;
  const rows: { id: string; name: string; value: number; crit?: number; note?: string }[] = [
    { id: 'NO3', name: 'N-NO₃⁻ (нітратний)', value: round(nTotal * (deep ? 0.95 : nit), 1), note: 'рухомий, вимивається з водою' },
    { id: 'NH4', name: 'N-NH₄⁺ (амонійний)', value: round(nTotal * (deep ? 0.05 : 1 - nit), 1), note: 'утримується ГВК' },
    { id: 'P', name: 'P₂O₅ рухомий', value: round(n.P2O5 * k, 0), crit: 80, note: fix < 1 ? `доступно рослинам ~${Math.round(fix * 100)}% (фіксація при pH ${l.pH})` : 'оптимальна доступність' },
    { id: 'K', name: 'K₂O обмінний', value: round(n.K2O * (IDX[l.id] ? 0.7 : 1), 0), crit: 100 },
    { id: 'S', name: 'S рухома (сульфати)', value: round(n.S * (deep ? 1.3 : 1), 1), crit: 6 },
    { id: 'Ca', name: 'Ca обмінний', value: Math.round(exchangeComplex(s, l).cec * exchangeComplex(s, l).cations[0].share * 2), note: 'мг/кг' },
    { id: 'Mg', name: 'Mg обмінний', value: Math.round(exchangeComplex(s, l).cec * exchangeComplex(s, l).cations[1].share * 1.2) },
    { id: 'B', name: 'B (бор)', value: round(n.B * k * alk, 2), crit: 0.5 },
    { id: 'Zn', name: 'Zn (цинк)', value: round(n.Zn * k * alk, 2), crit: 0.8 },
    { id: 'Mn', name: 'Mn (манган)', value: round((s.zone === 'polissia' ? 38 : 22) * k * (l.pH < 5.5 ? 1.8 : alk), 0), note: l.pH < 5.3 ? 'надлишок рухомого Mn²⁺ токсичний' : undefined },
    { id: 'Cu', name: 'Cu (купрум)', value: round((s.zone === 'polissia' ? 1.1 : 2.8) * k, 1) },
    { id: 'Mo', name: 'Mo (молібден)', value: round(0.12 * k * (l.pH < 5.5 ? 0.4 : 1), 2), note: l.pH < 5.5 ? 'у кислому ґрунті недоступний (потрібен бульбочкам)' : undefined },
  ];
  return rows;
}

export function humusQuality(zone: ZoneId) {
  return zone === 'polissia'
    ? { ratio: 0.7, type: 'гуматно-фульватний', note: 'переважають рухливі фульвокислоти — гумус нестійкий, вимивається' }
    : zone === 'lisostep'
      ? { ratio: 2.2, type: 'гуматний', note: 'гумінові кислоти, зв\'язані з кальцієм, — стійкий «солодкий» гумус' }
      : { ratio: 1.8, type: 'гуматний', note: 'гумати кальцію; запаси гумусу в профілі до 60–70 см' };
}

// --------------------------------------------------------------------------- фізичні процеси
export interface Process { id: string; group: 'water' | 'heat' | 'mech' | 'bio' | 'chem'; name: string; value: string; state: 'ok' | 'warn' | 'bad'; effect: string }

export function processes(s: SimState, l: SoilLayer): Process[] {
  const z = ZONES[s.zone];
  const w = s.weather;
  const ph = phases(s, l);
  const out: Process[] = [];
  const top = l.id === 'surface' || l.id === 'seedbed' || l.id === 'arable';
  const c = s.crop && !s.crop.dead && !s.crop.harvested ? s.crop : null;
  const mmPerPct = (thick(l) * z.fcPerCm) / 100;

  // ---- вода
  const avail = Math.max(0, l.moisture - WP);
  out.push({ id: 'moist', group: 'water', name: 'Вологість', value: `${Math.round(l.moisture)}% НВ · ${round(l.moisture * mmPerPct, 0)} мм води в шарі`, state: l.moisture > 100 ? 'bad' : l.moisture < 45 ? 'warn' : 'ok',
    effect: l.moisture > 100 ? 'Гравітаційна вода заповнила пори аерації: корені та аеробні мікроорганізми без кисню, іде денітрифікація.' : l.moisture < WP + 5 ? 'Волога утримується плівками міцніше, ніж її можуть відібрати корені (вологість в\'янення).' : `Доступна рослинам волога: ${round(avail * mmPerPct, 0)} мм.` });
  if (l.id === 'surface' || l.id === 'seedbed') {
    const ir = infiltrationRate(s);
    out.push({ id: 'infil', group: 'water', name: 'Вбирання води (інфільтрація)', value: `${ir.steady} мм/год`, state: ir.steady < 8 ? 'bad' : ir.steady < 20 ? 'warn' : 'ok',
      effect: s.crust > 0 ? 'Кірка закупорила пори: злива не вбирається, вода стікає й змиває ґрунт.' : ir.steady < 8 ? 'Вода не встигає проходити вглиб — калюжі, стік, ерозія.' : 'Опади повністю вбираються в ґрунт.' });
    const ev = s.snow > 3 ? 0 : refET(s) * clamp((layer(s, 'surface').moisture - 10) / 60, 0.15, 1) * (1 - s.residue / 220) * (s.looseUntil >= s.day ? 0.55 : 1);
    out.push({ id: 'evap', group: 'water', name: 'Фізичне випаровування', value: `${round(ev, 1)} мм/добу`, state: ev > 3 ? 'warn' : 'ok',
      effect: s.looseUntil >= s.day ? 'Розпушений шар розірвав капіляри — втрати води майже вдвічі менші.' : s.residue > 40 ? 'Мульча затінює поверхню і стримує випаровування.' : 'Вода піднімається капілярами до поверхні та випаровується.' });
  }
  if (l.id === 'pan') {
    out.push({ id: 'perc', group: 'water', name: 'Фільтрація крізь шар', value: panBlocking(s) ? '≤ 6 мм/добу' : 'вільна', state: panBlocking(s) ? 'bad' : 'ok',
      effect: panBlocking(s) ? 'Над підошвою утворюється верховодка, під нею ґрунт недоотримує опади.' : 'Опади вільно поповнюють глибокі горизонти.' });
  }
  // ---- повітря
  out.push({ id: 'air', group: 'water', name: 'Пористість аерації', value: `${ph.air}% об'єму (загальна ${ph.porosity}%)`, state: ph.air < 10 ? 'bad' : ph.air < 15 ? 'warn' : 'ok',
    effect: ph.air < 10 ? 'Менше 10% повітря — анаеробні умови: корені не дихають, нагромаджуються закисні сполуки Fe²⁺, Mn²⁺.' : 'Газообмін достатній: O₂ надходить до коренів, CO₂ виходить назовні.' });

  // ---- тепло
  out.push({ id: 'temp', group: 'heat', name: 'Температура', value: `${round(l.temp, 1)} °C`, state: l.temp < 0 ? 'bad' : l.temp < 5 ? 'warn' : 'ok',
    effect: l.temp < -0.5 ? 'Ґрунтова вода замерзла: лід розширюється на 9% і розриває брили (морозне розпушення), але не пропускає талу воду.' : l.temp < 5 ? 'Біологічні процеси майже зупинені, фосфор і азот малодоступні.' : l.temp > 30 ? 'Перегрів верхнього шару: пригнічення мікрофлори, швидка втрата вологи.' : 'Сприятлива для росту коренів та мікробіологічної діяльності.' });
  if (top) out.push({ id: 'ft', group: 'heat', name: 'Цикли замерзання–відтавання', value: `${s.freezeThaw} за сезон`, state: 'ok', effect: 'Кожен перехід через 0 °C кришить брили й трохи розущільнює орний шар; руйнує кірку.' });

  // ---- механіка
  const res = effRes(l);
  const dc = c ? PHYS[c.id].densCrit + (z.fcPerCm < 2.5 ? 0.12 : 0) : 1.4 + (z.fcPerCm < 2.5 ? 0.12 : 0);
  out.push({ id: 'dens', group: 'mech', name: 'Щільність будови', value: `${round(l.density, 2)} г/см³`, state: top && l.density > dc ? 'bad' : top && l.density > dc - 0.08 ? 'warn' : 'ok',
    effect: top && l.density > dc ? `Вище критичної для культури (${round(dc, 2)}): коріння росте повільніше, менше повітря й доступної води.` : top && l.density < z.densityA - 0.1 ? 'Ґрунт надто пухкий: поганий контакт насіння з ґрунтом, швидко висихає; з часом осяде.' : 'У межах оптимуму.' });
  out.push({ id: 'res', group: 'mech', name: 'Опір проникненню', value: `${round(res, 1)} МПа`, state: res >= PAN_LIMIT ? 'bad' : res >= 2.2 ? 'warn' : 'ok',
    effect: res >= PAN_LIMIT ? 'Понад 3 МПа кінчик кореня не може розсунути частки ґрунту — ріст углиб зупиняється.' : 'Корені проходять шар; у сухому стані опір зростає.' });
  if (l.id === 'surface') {
    out.push({ id: 'crust', group: 'mech', name: 'Ґрунтова кірка', value: s.crust > 0 ? `${s.crust} см` : 'немає', state: s.crust > 0 ? 'bad' : 'ok',
      effect: s.crust > 0 ? 'Краплі зливи розбили агрегати, мул запечатав пори; при висиханні утворилась плита.' : s.residue < 20 ? 'Поверхня не захищена рештками — злива може утворити кірку.' : 'Мульча гасить удари крапель.' });
    out.push({ id: 'eros', group: 'mech', name: 'Втрати ґрунту від ерозії', value: `${s.eroded} т/га за сезон`, state: s.eroded > 5 ? 'bad' : s.eroded > 0 ? 'warn' : 'ok',
      effect: 'Змивається й видувається найродючіший шар з гумусом, фосфором і мулом. 1 мм ґрунту ≈ 12 т/га.' });
  }

  // ---- біологія та хімія
  if (top) {
    const kg = thick(l) * l.density * 0.1;
    const min = mineralizationRate(l) * kg;
    out.push({ id: 'miner', group: 'bio', name: 'Мінералізація гумусу', value: `${round(min, 2)} кг N/га за добу`, state: min < 0.05 ? 'warn' : 'ok',
      effect: l.temp < 5 ? 'Холодно: мікроорганізми неактивні, азот із гумусу не вивільняється.' : l.moisture < 35 ? 'Сухо: мікробіологічна діяльність пригнічена.' : l.moisture > 100 ? 'Без кисню мінералізація гальмується.' : 'Мікроорганізми розкладають гумус до NH₄⁺, нітрифікатори окиснюють його до NO₃⁻.' });
    out.push({ id: 'resp', group: 'bio', name: 'Дихання ґрунту', value: `${respiration(l)} мг CO₂/кг за добу`, state: 'ok', effect: 'Показник біологічної активності: що тепліше та вологіше (до 80% НВ), то інтенсивніше.' });
    const worms = Math.round(clamp(l.humus * 14 * (l.moisture > 40 && l.temp > 4 ? 1 : 0.15) * (l.density > z.densityA + 0.15 ? 0.4 : 1) * (s.residue > 30 ? 1.3 : 0.8), 0, 120));
    if (l.id === 'arable') out.push({ id: 'worm', group: 'bio', name: 'Дощові черв\'яки', value: `~${worms} ос./м²`, state: worms < 15 ? 'warn' : 'ok', effect: 'Ходи черв\'яків — готові канали для коренів і води крізь ущільнені шари.' });
    if (l.moisture > 100 && l.temp > 8) out.push({ id: 'denit', group: 'chem', name: 'Денітрифікація', value: `−${round(l.nitrogen * 0.035 * kg, 1)} кг N/га за добу`, state: 'bad', effect: 'В анаеробних умовах бактерії відновлюють NO₃⁻ до газоподібних N₂O та N₂ — азот втрачається в атмосферу.' });
  }
  out.push({ id: 'ph', group: 'chem', name: 'Реакція ґрунтового розчину', value: `pH ${round(l.pH, 1)}`, state: l.pH < 5.5 ? 'bad' : l.pH < 6 || l.pH > 7.8 ? 'warn' : 'ok',
    effect: l.pH < 5.5 ? 'Кисле середовище: рухомий Al³⁺ отруює корені, фосфор зв\'язується, бульбочкові бактерії пригнічені.' : l.pH > 7.8 ? 'Лужне: фосфати кальцію, недоступні Zn, Fe, Mn, B.' : 'Близька до нейтральної: максимальна доступність елементів.' });
  if (l.id === 'transition' || l.id === 'parent') {
    out.push({ id: 'leach', group: 'chem', name: 'Промитий нітратний азот', value: `${round(l.nitrate, 1)} мг/кг`, state: l.nitrate > 12 ? 'warn' : 'ok',
      effect: c && c.rootDepth > l.top ? 'Корені досягли цього шару й перехоплюють вимиті нітрати.' : 'Нітрати винесені водою нижче кореневої зони — недоступні, доки корені не досягнуть шару.' });
  }
  void w;
  return out;
}
