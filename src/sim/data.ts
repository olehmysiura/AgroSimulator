// ============================================================================
// Довідкові дані: ґрунтово-кліматичні зони, культури, шкала BBCH, інструменти
// ============================================================================
import type { CropId, LayerId, Nutrients, SoilLayer, TillageOp, SprayOp, ToolId, ZoneId } from './types';

export interface ZoneDef {
  id: ZoneId;
  name: string;
  region: string;
  soil: string;
  pH: number;
  humus: number;
  tMean: number; // середньорічна температура
  tAmp: number; // амплітуда річного ходу
  rainProb: number; // імовірність дня з опадами
  rainMean: number; // середня кількість опадів у дощовий день
  windMean: number;
  humidity: number;
  fcPerCm: number; // повна вологоємність (НВ), мм на 1 см шару
  prodPerCm: number; // макс. продуктивна волога, мм/см
  densityA: number;
  panResistance: number;
  nitrogenA: number;
  potential: Partial<Record<CropId, number>>; // зональна поправка до потенціалу
  soilColor: string;
  nutrients: Nutrients;
  rainPeak: number; // день року з максимумом опадів
  /** кольори горизонтів [A, підошва, B, C] та генетичні індекси */
  horizon: { colors: [string, string, string, string]; codes: [string, string, string, string]; carbonatesFrom: number };
}

export const ZONES: Record<ZoneId, ZoneDef> = {
  polissia: {
    id: 'polissia',
    name: 'Полісся',
    region: 'Житомирська обл.',
    soil: 'Дерново-підзолистий супіщаний',
    pH: 5.4,
    humus: 2.1,
    tMean: 7.6,
    tAmp: 12.6,
    rainProb: 0.34,
    rainMean: 4.8,
    windMean: 3.1,
    humidity: 76,
    fcPerCm: 2.1,
    prodPerCm: 1.15,
    densityA: 1.34,
    panResistance: 2.7,
    nitrogenA: 9,
    potential: { corn: 0.78, wheat: 0.8, sunflower: 0.7, soy: 0.82, rapeseed: 0.85, sugarbeet: 0.75 },
    soilColor: '#6e6150',
    nutrients: { P2O5: 62, K2O: 58, S: 6, B: 0.25, Zn: 0.7 },
    rainPeak: 195,
    horizon: { colors: ['#6e6150', '#7a6b58', '#b7a587', '#d2bd8c'], codes: ['HEорн', 'HEп (підошва)', 'E → I (елювіально-ілювіальний)', 'P (водно-льодовикові відклади / лес)'], carbonatesFrom: 999 },
  },
  lisostep: {
    id: 'lisostep',
    name: 'Лісостеп',
    region: 'Полтавська обл.',
    soil: 'Чорнозем типовий глибокий',
    pH: 6.5,
    humus: 4.6,
    tMean: 8.5,
    tAmp: 13.6,
    rainProb: 0.29,
    rainMean: 4.4,
    windMean: 3.4,
    humidity: 70,
    fcPerCm: 3.4,
    prodPerCm: 1.9,
    densityA: 1.18,
    panResistance: 3.4,
    nitrogenA: 18,
    potential: { corn: 1, wheat: 1, sunflower: 1, soy: 1, rapeseed: 1, sugarbeet: 1 },
    soilColor: '#2f241b',
    nutrients: { P2O5: 118, K2O: 132, S: 9, B: 0.6, Zn: 1.1 },
    rainPeak: 185,
    horizon: { colors: ['#2f241b', '#3a2c20', '#5d4630', '#b39566'], codes: ['Hорн', 'Hп (підошва)', 'Hp → Phk (з гумусовими затьоками)', 'Pk (карбонатний лес)'], carbonatesFrom: 95 },
  },
  step: {
    id: 'step',
    name: 'Степ',
    region: 'Миколаївська обл.',
    soil: 'Чорнозем південний посушливий',
    pH: 7.1,
    humus: 3.4,
    tMean: 10.2,
    tAmp: 13.4,
    rainProb: 0.21,
    rainMean: 5.6,
    windMean: 4.2,
    humidity: 62,
    fcPerCm: 3.0,
    prodPerCm: 1.65,
    densityA: 1.26,
    panResistance: 3.2,
    nitrogenA: 14,
    potential: { corn: 0.72, wheat: 0.9, sunflower: 0.95, soy: 0.68, rapeseed: 0.85, sugarbeet: 0.6 },
    soilColor: '#43301f',
    nutrients: { P2O5: 96, K2O: 260, S: 12, B: 0.9, Zn: 0.5 },
    rainPeak: 165,
    horizon: { colors: ['#43301f', '#4d3826', '#7a5c3c', '#c2a170'], codes: ['Hорн', 'Hп (підошва)', 'Hpk → Phk (білоочка з 50 см)', 'Pk (лес з карбонатами)'], carbonatesFrom: 50 },
  },
};

export const LAYER_DEFS: { id: LayerId; top: number; bottom: number; name: string; short: string }[] = [
  { id: 'surface', top: 0, bottom: 2, name: 'Поверхня / Мульча', short: '0–2 см' },
  { id: 'seedbed', top: 2, bottom: 8, name: 'Посівне ложе', short: '2–8 см' },
  { id: 'arable', top: 8, bottom: 30, name: 'Орний гумусовий горизонт A', short: '8–30 см' },
  { id: 'pan', top: 30, bottom: 35, name: 'Підплужна підошва', short: '30–35 см' },
  { id: 'transition', top: 35, bottom: 80, name: 'Перехідний горизонт B', short: '35–80 см' },
  { id: 'parent', top: 80, bottom: 150, name: 'Материнська порода C — Лес', short: '80–150 см' },
];

export function makeLayers(zone: ZoneId, moistTop = 76, moistDeep = 82): SoilLayer[] {
  const z = ZONES[zone];
  const base = { temp: 6, nitrate: 2 };
  return [
    { ...base, id: 'surface', top: 0, bottom: 2, moisture: moistTop - 6, density: z.densityA - 0.12, resistance: 0.3, humus: z.humus, nitrogen: z.nitrogenA * 0.8, pH: z.pH },
    { ...base, id: 'seedbed', top: 2, bottom: 8, moisture: moistTop - 2, density: z.densityA - 0.06, resistance: 0.6, humus: z.humus, nitrogen: z.nitrogenA, pH: z.pH },
    { ...base, id: 'arable', top: 8, bottom: 30, moisture: moistTop, density: z.densityA, resistance: densityToRes(z.densityA), humus: z.humus, nitrogen: z.nitrogenA, pH: z.pH },
    { ...base, id: 'pan', top: 30, bottom: 35, moisture: moistTop + 2, density: z.densityA + 0.24, resistance: z.panResistance, humus: z.humus * 0.8, nitrogen: z.nitrogenA * 0.5, pH: z.pH + 0.1 },
    { ...base, id: 'transition', top: 35, bottom: 80, moisture: moistDeep, density: z.densityA + 0.16, resistance: 2.0, humus: z.humus * 0.45, nitrogen: z.nitrogenA * 0.3, nitrate: 4, pH: z.pH + 0.3 },
    { ...base, id: 'parent', top: 80, bottom: 150, moisture: moistDeep + 2, density: z.densityA + 0.2, resistance: 1.9, humus: z.humus * 0.12, nitrogen: z.nitrogenA * 0.1, nitrate: 3, pH: Math.min(8.2, z.pH + 0.9) },
  ];
}

export function densityToRes(d: number): number {
  return Math.max(0.4, +((d - 0.92) * 3.3).toFixed(2));
}

// ---------------------------------------------------------------------------
// Культури
// ---------------------------------------------------------------------------
export interface CropDef {
  id: CropId;
  name: string;
  latin: string;
  baseTemp: number; // біологічний мінімум проростання, °C
  depthMin: number;
  depthMax: number;
  depthSensitivity: number; // штраф схожості за 1 см відхилення
  maxRoot: number; // см
  potential: number; // т/га
  maxHeight: number; // см
  rowCrop: boolean;
  winter: boolean;
  epigeal: boolean; // надземне проростання (сім'ядолі виносяться на поверхню)
  frostKillTemp: number; // °С, за якого гинуть сходи з точкою росту над поверхнею
  nNeed: number; // мг/кг доступного N у шарі A для повного живлення
  beePollinated: boolean;
  bbch: [number, number][]; // [GDD, код BBCH]
  maturityBbch: number;
  color: string;
  pest: { name: string; latin: string; kind: 'insect' | 'mite'; unit: string };
  disease: { name: string; latin: string; sign: string };
}

export const CROPS: Record<CropId, CropDef> = {
  corn: {
    id: 'corn', name: 'Кукурудза', latin: 'Zea mays L.', baseTemp: 10, depthMin: 4, depthMax: 6, depthSensitivity: 0.16,
    maxRoot: 180, potential: 11.5, maxHeight: 245, rowCrop: true, winter: false, epigeal: false, frostKillTemp: -2,
    nNeed: 17, beePollinated: false, maturityBbch: 89, color: '#3f9d4b',
    pest: { name: 'Стебловий (кукурудзяний) метелик', latin: 'Ostrinia nubilalis', kind: 'insect', unit: 'гусениць/рослину' }, disease: { name: 'Гельмінтоспоріоз (північна плямистість)', latin: 'Exserohilum turcicum', sign: 'видовжені сіро-бурі «човноподібні» плями 3–15 см' },
    bbch: [[0, 0], [15, 3], [28, 5], [42, 7], [55, 9], [63, 10], [82, 11], [111, 12], [139, 13], [172, 14], [205, 15], [238, 16], [328, 19], [426, 32], [533, 39], [640, 55], [713, 63], [820, 71], [984, 79], [1148, 85], [1271, 89]],
  },
  wheat: {
    id: 'wheat', name: 'Пшениця озима', latin: 'Triticum aestivum L.', baseTemp: 3, depthMin: 3, depthMax: 5, depthSensitivity: 0.13,
    maxRoot: 150, potential: 8.0, maxHeight: 95, rowCrop: false, winter: true, epigeal: false, frostKillTemp: -18,
    nNeed: 16, beePollinated: false, maturityBbch: 89, color: '#4caf50',
    pest: { name: 'Попелиця велика злакова', latin: 'Sitobion avenae', kind: 'insect', unit: 'ос./стебло' }, disease: { name: 'Септоріоз листя', latin: 'Zymoseptoria tritici', sign: 'видовжені світло-бурі плями, обмежені жилками, з чорними пікнідами' },
    bbch: [[0, 0], [30, 3], [55, 5], [80, 7], [100, 9], [108, 10], [116, 12], [155, 13], [211, 21], [347, 25], [589, 30], [713, 32], [837, 37], [899, 39], [992, 51], [1085, 59], [1147, 65], [1302, 75], [1488, 85], [1612, 89]],
  },
  sunflower: {
    id: 'sunflower', name: 'Соняшник', latin: 'Helianthus annuus L.', baseTemp: 8, depthMin: 4, depthMax: 6, depthSensitivity: 0.12,
    maxRoot: 200, potential: 4.2, maxHeight: 190, rowCrop: true, winter: false, epigeal: true, frostKillTemp: -5,
    nNeed: 13, beePollinated: true, maturityBbch: 89, color: '#3c9a45',
    pest: { name: 'Попелиця соняшникова', latin: 'Brachycaudus helichrysi', kind: 'insect', unit: 'ос./рослину' }, disease: { name: 'Фомопсис (сіра плямистість стебел)', latin: 'Diaporthe helianthi', sign: 'бурі клиноподібні некрози від краю листка до черешка' },
    bbch: [[0, 0], [20, 3], [40, 5], [58, 7], [75, 9], [83, 10], [120, 12], [195, 14], [292, 18], [405, 31], [555, 51], [668, 55], [780, 61], [855, 65], [930, 69], [1080, 79], [1230, 85], [1335, 89]],
  },
  soy: {
    id: 'soy', name: 'Соя', latin: 'Glycine max (L.) Merr.', baseTemp: 10, depthMin: 3, depthMax: 5, depthSensitivity: 0.15,
    maxRoot: 150, potential: 3.4, maxHeight: 95, rowCrop: true, winter: false, epigeal: true, frostKillTemp: -2,
    nNeed: 16, beePollinated: false, maturityBbch: 89, color: '#4c9f3a',
    pest: { name: 'Павутинний кліщ', latin: 'Tetranychus urticae', kind: 'mite', unit: 'ос./листок' }, disease: { name: 'Пероноспороз', latin: 'Peronospora manshurica', sign: 'хлоротичні плями зверху, сіро-фіолетовий наліт знизу листка' },
    bbch: [[0, 0], [15, 3], [30, 5], [45, 7], [60, 9], [64, 10], [101, 12], [156, 13], [212, 14], [304, 16], [414, 51], [506, 61], [589, 65], [718, 71], [874, 79], [1012, 85], [1104, 89]],
  },
  rapeseed: {
    id: 'rapeseed', name: 'Ріпак озимий', latin: 'Brassica napus L.', baseTemp: 3, depthMin: 1.5, depthMax: 2.5, depthSensitivity: 0.2,
    maxRoot: 150, potential: 4.3, maxHeight: 150, rowCrop: false, winter: true, epigeal: true, frostKillTemp: -15,
    nNeed: 18, beePollinated: true, maturityBbch: 89, color: '#3f8f5a',
    pest: { name: 'Ріпаковий квіткоїд', latin: 'Brassicogethes aeneus', kind: 'insect', unit: 'жуків/рослину' }, disease: { name: 'Альтернаріоз', latin: 'Alternaria brassicae', sign: 'концентричні темні плями з жовтим ореолом' },
    bbch: [[0, 0], [25, 3], [45, 5], [65, 7], [80, 9], [88, 10], [98, 12], [162, 14], [260, 16], [364, 19], [650, 30], [780, 39], [878, 51], [975, 61], [1040, 65], [1105, 69], [1268, 79], [1430, 85], [1560, 89]],
  },
  sugarbeet: {
    id: 'sugarbeet', name: 'Цукровий буряк', latin: 'Beta vulgaris L.', baseTemp: 5, depthMin: 2, depthMax: 3.5, depthSensitivity: 0.18,
    maxRoot: 200, potential: 58, maxHeight: 55, rowCrop: true, winter: false, epigeal: true, frostKillTemp: -3,
    nNeed: 15, beePollinated: false, maturityBbch: 49, color: '#3a9a52',
    pest: { name: 'Звичайний буряковий довгоносик', latin: 'Asproparthenis punctiventris', kind: 'insect', unit: 'жуків/м²' }, disease: { name: 'Церкоспороз', latin: 'Cercospora beticola', sign: 'дрібні сірі плями з червоно-бурим облямівком' },
    bbch: [[0, 0], [40, 3], [70, 5], [100, 7], [125, 9], [140, 10], [200, 12], [300, 14], [450, 16], [700, 19], [1000, 31], [1400, 39], [1800, 45], [2200, 49]],
  },
};

export const CROP_ORDER: CropId[] = ['corn', 'wheat', 'sunflower', 'soy', 'rapeseed', 'sugarbeet'];

export function bbchFromGdd(crop: CropId, gdd: number): number {
  const t = CROPS[crop].bbch;
  let code = 0;
  for (const [g, b] of t) if (gdd >= g) code = b;
  return code;
}

export function gddForBbch(crop: CropId, bbch: number): number {
  const t = CROPS[crop].bbch;
  for (const [g, b] of t) if (b >= bbch) return g;
  return t[t.length - 1][0];
}

export const EMERGENCE_BBCH = 10;

export function bbchStageName(crop: CropId, b: number): string {
  if (b < 1) return 'Сухе насіння';
  if (b < 5) return 'Набубнявіння насіння';
  if (b < 7) return 'Поява зародкового корінця';
  if (b < 10) return crop === 'corn' || crop === 'wheat' ? 'Колеоптиль виходить з насінини' : 'Гіпокотиль з сім\'ядолями прямує до поверхні';
  if (b < 20) return b === 10 ? 'Сходи' : `${b - 10}-й справжній листок`;
  if (b < 30) return crop === 'wheat' ? 'Кущіння' : crop === 'sugarbeet' ? 'Змикання листків у рядку' : 'Бокові пагони';
  if (b < 40) return crop === 'sugarbeet' ? 'Змикання міжрядь' : crop === 'rapeseed' ? 'Стеблування' : 'Вихід у трубку / ріст стебла';
  if (b < 50) return crop === 'wheat' ? 'Набрякання прапорцевого листка' : crop === 'sugarbeet' ? 'Наростання коренеплоду' : 'Розвиток вегетативних органів';
  if (b < 60) return crop === 'wheat' ? 'Колосіння' : crop === 'corn' ? 'Викидання волоті' : crop === 'sunflower' ? 'Бутонізація' : 'Поява суцвіть';
  if (b < 70) return 'Цвітіння';
  if (b < 80) return crop === 'soy' || crop === 'rapeseed' ? 'Утворення бобів/стручків' : 'Формування та налив зерна';
  if (b < 89) return 'Дозрівання';
  return 'Повна стиглість';
}

// ---------------------------------------------------------------------------
// Операції
// ---------------------------------------------------------------------------
export interface TillageDef { name: string; depth: string; heavy: boolean; workDepth: number; group: 'basic' | 'surface' | 'care' }
export const TILLAGE: Record<TillageOp, TillageDef> = {
  plough: { name: 'Оранка плугом з обертанням скиби', depth: '25–27 см', heavy: true, workDepth: 26, group: 'basic' },
  chisel: { name: 'Глибоке розпушування чизелем', depth: '40–42 см', heavy: true, workDepth: 41, group: 'basic' },
  flatCut: { name: 'Плоскорізний обробіток (КПШ)', depth: '12–16 см', heavy: true, workDepth: 14, group: 'basic' },
  stripTill: { name: 'Смуговий обробіток (Strip-till)', depth: '20–25 см у смугах', heavy: true, workDepth: 22, group: 'basic' },
  disc: { name: 'Дискування важкою бороною', depth: '6–12 см', heavy: true, workDepth: 10, group: 'surface' },
  stubbleDisc: { name: 'Лущення стерні дисковим лущильником', depth: '6–8 см', heavy: true, workDepth: 7, group: 'surface' },
  cultivate: { name: 'Передпосівна культивація', depth: '5–6 см', heavy: true, workDepth: 5.5, group: 'surface' },
  harrow: { name: 'Боронування зубовими боронами («закриття вологи»)', depth: '3–4 см', heavy: false, workDepth: 3.5, group: 'surface' },
  mulcher: { name: 'Подрібнення рослинних решток (мульчувач)', depth: 'поверхня', heavy: false, workDepth: 0, group: 'surface' },
  rotaryHoe: { name: 'Ротаційна борона / мотика', depth: '2–3 см', heavy: false, workDepth: 2.5, group: 'care' },
  interRow: { name: 'Міжрядна культивація з підгортанням', depth: '6–8 см у міжряддях', heavy: false, workDepth: 7, group: 'care' },
  roll: { name: 'Коткування кільчасто-шпоровими котками', depth: 'поверхня', heavy: true, workDepth: 0, group: 'care' },
};

export type SprayGroup = 'herb' | 'protect' | 'regul' | 'nutr';
export interface SprayDef {
  name: string;
  detail: string;
  group: SprayGroup;
  spreader?: boolean;
  unit: string;
  /** зареєстрований діапазон норми витрати [мін, макс] і рекомендована норма */
  rate: [number, number];
  def: number;
  step: number;
  /** спосіб дії: системний, контактний, ґрунтовий, добриво */
  mode: 'systemic' | 'contact' | 'soil' | 'fert';
  /** дощостійкість: год після обробки, потрібних для поглинання */
  rainfast: number;
  /** строк очікування до збирання, діб (0 — не регламентується) */
  phi: number;
  /** максимальна кратність обробок за сезон (0 — не обмежено) */
  maxApps: number;
  /** робочий діапазон температур повітря під час обробки, °C */
  tOpt: [number, number];
  /** група за механізмом дії (FRAC / IRAC / HRAC) — для резистентності */
  moa?: string;
}
export const SPRAYS: Record<SprayOp, SprayDef> = {
  preHerbicide: { name: 'Ґрунтовий досходовий гербіцид', detail: 'С-метолахлор + метрибузин', group: 'herb', unit: 'л/га', rate: [1.5, 3], def: 2, step: 0.1, mode: 'soil', rainfast: 0, phi: 60, maxApps: 1, tOpt: [5, 30], moa: 'HRAC 15 + 5' },
  postHerbicide: { name: 'Страховий післясходовий гербіцид', detail: 'сульфонілсечовини (римсульфурон)', group: 'herb', unit: 'г/га', rate: [20, 30], def: 25, step: 1, mode: 'systemic', rainfast: 4, phi: 60, maxApps: 1, tOpt: [10, 25], moa: 'HRAC 2 (ALS)' },
  glyphosate: { name: 'Гербіцид суцільної дії', detail: 'гліфосат 360 г/л', group: 'herb', unit: 'л/га', rate: [2, 4], def: 3, step: 0.1, mode: 'systemic', rainfast: 6, phi: 14, maxApps: 2, tOpt: [12, 28], moa: 'HRAC 9 (EPSPS)' },
  fungicide: { name: 'Фунгіцид', detail: 'протіоконазол + азоксистробін', group: 'protect', unit: 'л/га', rate: [0.6, 1.0], def: 0.8, step: 0.05, mode: 'systemic', rainfast: 2, phi: 35, maxApps: 2, tOpt: [10, 27], moa: 'FRAC 3 + 11' },
  insecticide: { name: 'Інсектицид системно-контактний', detail: 'тіаклоприд + дельтаметрин', group: 'protect', unit: 'л/га', rate: [0.15, 0.3], def: 0.2, step: 0.01, mode: 'contact', rainfast: 2, phi: 30, maxApps: 2, tOpt: [8, 25], moa: 'IRAC 4A + 3A' },
  acaricide: { name: 'Акарицид', detail: 'абамектин 18 г/л', group: 'protect', unit: 'л/га', rate: [0.4, 0.6], def: 0.5, step: 0.05, mode: 'contact', rainfast: 3, phi: 30, maxApps: 1, tOpt: [12, 30], moa: 'IRAC 6' },
  retardant: { name: 'Ретардант (регулятор росту)', detail: 'хлормекват-хлорид + тринексапак-етил', group: 'regul', unit: 'л/га', rate: [1, 2], def: 1.5, step: 0.1, mode: 'systemic', rainfast: 4, phi: 60, maxApps: 2, tOpt: [8, 25] },
  desiccant: { name: 'Десикант перед збиранням', detail: 'дикват 150 г/л', group: 'regul', unit: 'л/га', rate: [1.5, 2.5], def: 2, step: 0.1, mode: 'contact', rainfast: 1, phi: 5, maxApps: 1, tOpt: [5, 30] },
  nitrogen: { name: 'Підживлення КАС-32 / карбамідом', detail: 'азот — струменеві розпилювачі або розкидач', group: 'nutr', unit: 'кг N/га', rate: [20, 60], def: 40, step: 5, mode: 'fert', rainfast: 0, phi: 0, maxApps: 0, tOpt: [-50, 25] },
  pk: { name: 'Основне фосфорно-калійне добриво', detail: 'суперфосфат + KCl, відцентровий розкидач', group: 'nutr', spreader: true, unit: 'кг д.р. P₂O₅+K₂O/га', rate: [90, 180], def: 150, step: 10, mode: 'fert', rainfast: 0, phi: 0, maxApps: 0, tOpt: [-50, 50] },
  micro: { name: 'Позакореневе мікродобриво', detail: 'B + Zn + Mn (хелати)', group: 'nutr', unit: 'л/га', rate: [0.5, 2], def: 1, step: 0.1, mode: 'systemic', rainfast: 2, phi: 0, maxApps: 3, tOpt: [8, 25] },
  liming: { name: 'Вапнування (меліорація кислих ґрунтів)', detail: 'вапняне борошно CaCO₃, розкидач', group: 'nutr', spreader: true, unit: 'т/га', rate: [2, 6], def: 4, step: 0.5, mode: 'fert', rainfast: 0, phi: 0, maxApps: 0, tOpt: [-50, 50] },
  antistress: { name: 'Антистресант', detail: 'амінокислоти + гумати', group: 'nutr', unit: 'л/га', rate: [0.5, 2], def: 1, step: 0.1, mode: 'systemic', rainfast: 2, phi: 0, maxApps: 3, tOpt: [5, 28] },
};

/** Препарати, що є пестицидами (для індексу обробок і строків очікування). */
export const PESTICIDES: SprayOp[] = ['preHerbicide', 'postHerbicide', 'glyphosate', 'fungicide', 'insecticide', 'acaricide', 'retardant', 'desiccant'];

export const TOOLS: Record<ToolId, { name: string; short: string; measures: string }> = {
  penetrometer: { name: 'Пенетрометр (твердомір ґрунту)', short: 'Пенетрометр', measures: 'механічний опір ґрунту проникненню конуса по глибині 0–150 см' },
  auger: { name: 'Ґрунтовий бур + вологомір', short: 'Бур + вологомір', measures: 'пошарову вологість, вміст азоту та реакцію ґрунтового розчину' },
  frame: { name: 'Агрономічна рамка 1 м²', short: 'Рамка 1 м²', measures: 'густоту стояння культури та чисельність бур\'янів на облікову площу' },
  shovel: { name: 'Агрономічна лопатка + лінійка', short: 'Лопатка + лінійка', measures: 'фактичну глибину посіву, стан проростків, точки росту та кореневої системи' },
  lens: { name: 'N-тестер хлорофілу + агрономічна лупа ×20', short: 'N-тестер + лупа', measures: 'вміст хлорофілу в листку та мікроскопічні ознаки хвороб і шкідників на листі' },
  ndvi: { name: 'Супутниковий NDVI-сканер', short: 'NDVI-сканер', measures: 'відбивну здатність рослинного покриву в червоному та ближньому ІЧ-діапазонах' },
  thermometer: { name: 'Колінчасті ґрунтові термометри (Савінова)', short: 'Ґрунтові термометри', measures: 'температуру ґрунту на глибинах 2–40 см уранці та вдень' },
  infiltrometer: { name: 'Кільцевий інфільтрометр', short: 'Інфільтрометр', measures: 'швидкість вбирання води ґрунтом (мм/год)' },
  traps: { name: 'Жовті клейові та феромонні пастки', short: 'Пастки', measures: 'льотну активність комах (вилов за тиждень)' },
  agrolab: { name: 'Агрохімічний аналіз ґрунту (лабораторія)', short: 'Агрохім. аналіз', measures: 'реакцію ґрунту, вміст гумусу, N, P₂O₅, K₂O, S та мікроелементів у шарі 0–30 см' },
  meteo: { name: 'Агрометеостанція (датчик зволоження листка)', short: 'Агрометеостанція', measures: 'погодний ряд за 14 діб та тривалість зволоження листка' },
};

export const EPSH_WEEDS = 12; // економічний поріг шкідливості, шт./м2
export const TARGET_DENSITY: Record<CropId, number> = {
  corn: 7.5, wheat: 450, sunflower: 5.5, soy: 55, rapeseed: 45, sugarbeet: 11,
};

/** Економічні пороги шкідливості шкідників (довідково для звіту/вікон приладів) */
export const PEST_EPSH: Record<CropId, number> = {
  corn: 1, wheat: 10, sunflower: 15, soy: 5, rapeseed: 3, sugarbeet: 2,
};

// ---------------------------------------------------------------------------
// Фізіологічні параметри культур (модель росту, структура врожаю, анатомія)
// ---------------------------------------------------------------------------
export interface CropPhys {
  c4: boolean;
  monocot: boolean;
  rue: number; // ефективність використання ФАР, г сухої речовини / МДж
  kExt: number; // коефіцієнт екстинкції світла в посіві
  laiMax: number;
  hi: number; // індекс урожаю (товарна частка в сухій біомасі)
  nA: number; // крива критичного вмісту азоту: Nc% = nA · W^(−nB)
  nB: number;
  pCrit: number; // P2O5, мг/кг — рівень, вище якого фосфор не лімітує
  kCrit: number; // K2O, мг/кг
  micro: { el: 'B' | 'Zn' | 'S'; crit: number; from: number; to: number; name: string };
  phMin: number; // нижня межа оптимуму pH
  heatCrit: number; // °C, критична t макс. у цвітіння
  densCrit: number; // г/см³ — критична щільність орного шару
  weedI: number; // втрата врожаю на 1 бур'ян/м² (гіпербола Казенса)
  /** чутливість фаз (показники моделі Єнсена): вегетативна, генеративна, налив */
  sens: [number, number, number];
  /** межі фаз у кодах BBCH: [сходи, поч. генеративної, поч. наливу, стиглість] */
  phases: [number, number, number, number];
  /** елементи структури врожаю: [закладається у вегетативну, генеративну фазу, налив] */
  comp: { names: [string, string, string]; base: [number, number, number]; units: [string, string, string]; per: string };
  seed: { type: 'caryopsis' | 'cornKernel' | 'achene' | 'dicot' | 'glomerule'; tkw: number; starch: number; protein: number; oil: number; name: string };
}

export const PHYS: Record<CropId, CropPhys> = {
  corn: {
    c4: true, monocot: true, rue: 3.4, kExt: 0.6, laiMax: 4.8, hi: 0.5, nA: 3.4, nB: 0.37, pCrit: 100, kCrit: 100,
    micro: { el: 'Zn', crit: 0.8, from: 12, to: 39, name: 'цинк' }, phMin: 5.5, heatCrit: 33, densCrit: 1.4, weedI: 0.024,
    sens: [0.25, 0.6, 0.4], phases: [10, 51, 71, 89],
    comp: { names: ['Качанів на рослину', 'Зерен у качані', 'Маса 1000 зерен'], base: [1.0, 525, 292], units: ['шт.', 'шт.', 'г'], per: 'рослин/м²' },
    seed: { type: 'cornKernel', tkw: 292, starch: 71, protein: 9.5, oil: 4.5, name: 'Зернівка' },
  },
  wheat: {
    c4: false, monocot: true, rue: 2.8, kExt: 0.5, laiMax: 6.0, hi: 0.45, nA: 5.35, nB: 0.44, pCrit: 80, kCrit: 80,
    micro: { el: 'S', crit: 6, from: 25, to: 59, name: 'сірка' }, phMin: 5.8, heatCrit: 30, densCrit: 1.45, weedI: 0.006,
    sens: [0.25, 0.5, 0.3], phases: [10, 31, 71, 89],
    comp: { names: ['Продуктивних стебел на рослину', 'Зерен у колосі', 'Маса 1000 зерен'], base: [1.35, 32, 41], units: ['шт.', 'шт.', 'г'], per: 'рослин/м²' },
    seed: { type: 'caryopsis', tkw: 41, starch: 66, protein: 12.5, oil: 2, name: 'Зернівка' },
  },
  sunflower: {
    c4: false, monocot: false, rue: 2.4, kExt: 0.8, laiMax: 3.6, hi: 0.36, nA: 4.5, nB: 0.42, pCrit: 70, kCrit: 120,
    micro: { el: 'B', crit: 0.5, from: 31, to: 69, name: 'бор' }, phMin: 5.8, heatCrit: 34, densCrit: 1.4, weedI: 0.014,
    sens: [0.2, 0.45, 0.3], phases: [10, 51, 71, 89],
    comp: { names: ['Кошиків на рослину', 'Виповнених сім\'янок у кошику', 'Маса 1000 сім\'янок'], base: [1.0, 1250, 61], units: ['шт.', 'шт.', 'г'], per: 'рослин/м²' },
    seed: { type: 'achene', tkw: 61, starch: 5, protein: 19, oil: 50, name: 'Сім\'янка' },
  },
  soy: {
    c4: false, monocot: false, rue: 2.0, kExt: 0.6, laiMax: 5.0, hi: 0.4, nA: 4.9, nB: 0.3, pCrit: 80, kCrit: 90,
    micro: { el: 'B', crit: 0.35, from: 51, to: 69, name: 'бор' }, phMin: 6.0, heatCrit: 32, densCrit: 1.35, weedI: 0.016,
    sens: [0.15, 0.4, 0.3], phases: [10, 51, 71, 89],
    comp: { names: ['Бобів на рослину', 'Насінин у бобі', 'Маса 1000 насінин'], base: [22, 2.0, 140], units: ['шт.', 'шт.', 'г'], per: 'рослин/м²' },
    seed: { type: 'dicot', tkw: 140, starch: 6, protein: 39, oil: 20, name: 'Насінина' },
  },
  rapeseed: {
    c4: false, monocot: false, rue: 2.6, kExt: 0.7, laiMax: 4.5, hi: 0.3, nA: 4.5, nB: 0.25, pCrit: 90, kCrit: 100,
    micro: { el: 'S', crit: 8, from: 30, to: 69, name: 'сірка' }, phMin: 6.0, heatCrit: 29, densCrit: 1.4, weedI: 0.007,
    sens: [0.25, 0.45, 0.3], phases: [10, 51, 71, 89],
    comp: { names: ['Стручків на рослину', 'Насінин у стручку', 'Маса 1000 насінин'], base: [150, 14, 4.55], units: ['шт.', 'шт.', 'г'], per: 'рослин/м²' },
    seed: { type: 'dicot', tkw: 4.6, starch: 4, protein: 22, oil: 44, name: 'Насінина' },
  },
  sugarbeet: {
    c4: false, monocot: false, rue: 3.0, kExt: 0.7, laiMax: 4.5, hi: 0.62, nA: 4.5, nB: 0.35, pCrit: 120, kCrit: 140,
    micro: { el: 'B', crit: 0.55, from: 16, to: 45, name: 'бор' }, phMin: 6.5, heatCrit: 31, densCrit: 1.35, weedI: 0.02,
    sens: [0.3, 0.4, 0.2], phases: [10, 31, 39, 49],
    comp: { names: ['Розетка: листків на рослину', 'Маса коренеплоду', 'Цукристість'], base: [22, 527, 17.5], units: ['шт.', 'г', '%'], per: 'рослин/м²' },
    seed: { type: 'glomerule', tkw: 13, starch: 30, protein: 12, oil: 5, name: 'Плід-горішок (клубочок)' },
  },
};

export type FactorId =
  | 'water' | 'air' | 'nitrogen' | 'phosphorus' | 'potassium' | 'micro' | 'ph' | 'heat' | 'chill'
  | 'weeds' | 'disease' | 'pests' | 'compaction' | 'frost' | 'stress';

export const FACTORS: Record<FactorId, { name: string; unit: string }> = {
  water: { name: 'Вода (ETa/ETm)', unit: '' },
  air: { name: 'Аерація (перезволоження)', unit: '' },
  nitrogen: { name: 'Азот (індекс NNI)', unit: '' },
  phosphorus: { name: 'Фосфор', unit: '' },
  potassium: { name: 'Калій', unit: '' },
  micro: { name: 'Мікро- та мезоелементи', unit: '' },
  ph: { name: 'Реакція ґрунту (pH)', unit: '' },
  heat: { name: 'Тепловий стрес', unit: '' },
  chill: { name: 'Холодовий стрес', unit: '' },
  weeds: { name: 'Конкуренція бур\'янів', unit: '' },
  disease: { name: 'Хвороби листя', unit: '' },
  pests: { name: 'Шкідники', unit: '' },
  compaction: { name: 'Ущільнення ґрунту', unit: '' },
  frost: { name: 'Приморозкове пошкодження', unit: '' },
  stress: { name: 'Післястресове пригнічення', unit: '' },
};
export const FACTOR_ORDER = Object.keys(FACTORS) as FactorId[];
