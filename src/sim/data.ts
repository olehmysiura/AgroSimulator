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
    bbch: [[0, 0], [15, 3], [28, 5], [42, 7], [55, 9], [65, 10], [100, 11], [135, 12], [170, 13], [210, 14], [250, 15], [290, 16], [400, 19], [520, 32], [650, 39], [780, 55], [870, 63], [1000, 71], [1200, 79], [1400, 85], [1550, 89]],
  },
  wheat: {
    id: 'wheat', name: 'Пшениця озима', latin: 'Triticum aestivum L.', baseTemp: 3, depthMin: 3, depthMax: 5, depthSensitivity: 0.13,
    maxRoot: 150, potential: 8.0, maxHeight: 95, rowCrop: false, winter: true, epigeal: false, frostKillTemp: -18,
    nNeed: 16, beePollinated: false, maturityBbch: 89, color: '#4caf50',
    pest: { name: 'Попелиця велика злакова', latin: 'Sitobion avenae', kind: 'insect', unit: 'ос./стебло' }, disease: { name: 'Септоріоз листя', latin: 'Zymoseptoria tritici', sign: 'видовжені світло-бурі плями, обмежені жилками, з чорними пікнідами' },
    bbch: [[0, 0], [30, 3], [55, 5], [80, 7], [100, 9], [115, 10], [170, 12], [250, 13], [340, 21], [560, 25], [950, 30], [1150, 32], [1350, 37], [1450, 39], [1600, 51], [1750, 59], [1850, 65], [2100, 75], [2400, 85], [2600, 89]],
  },
  sunflower: {
    id: 'sunflower', name: 'Соняшник', latin: 'Helianthus annuus L.', baseTemp: 8, depthMin: 4, depthMax: 6, depthSensitivity: 0.12,
    maxRoot: 200, potential: 4.2, maxHeight: 190, rowCrop: true, winter: false, epigeal: true, frostKillTemp: -5,
    nNeed: 13, beePollinated: true, maturityBbch: 89, color: '#3c9a45',
    pest: { name: 'Попелиця соняшникова', latin: 'Brachycaudus helichrysi', kind: 'insect', unit: 'ос./рослину' }, disease: { name: 'Фомопсис (сіра плямистість стебел)', latin: 'Diaporthe helianthi', sign: 'бурі клиноподібні некрози від краю листка до черешка' },
    bbch: [[0, 0], [20, 3], [40, 5], [58, 7], [75, 9], [90, 10], [160, 12], [260, 14], [390, 18], [540, 31], [740, 51], [890, 55], [1040, 61], [1140, 65], [1240, 69], [1440, 79], [1640, 85], [1780, 89]],
  },
  soy: {
    id: 'soy', name: 'Соя', latin: 'Glycine max (L.) Merr.', baseTemp: 10, depthMin: 3, depthMax: 5, depthSensitivity: 0.15,
    maxRoot: 150, potential: 3.4, maxHeight: 95, rowCrop: true, winter: false, epigeal: true, frostKillTemp: -2,
    nNeed: 9, beePollinated: false, maturityBbch: 89, color: '#4c9f3a',
    pest: { name: 'Павутинний кліщ', latin: 'Tetranychus urticae', kind: 'mite', unit: 'ос./листок' }, disease: { name: 'Пероноспороз', latin: 'Peronospora manshurica', sign: 'хлоротичні плями зверху, сіро-фіолетовий наліт знизу листка' },
    bbch: [[0, 0], [15, 3], [30, 5], [45, 7], [60, 9], [70, 10], [110, 12], [170, 13], [230, 14], [330, 16], [450, 51], [550, 61], [640, 65], [780, 71], [950, 79], [1100, 85], [1200, 89]],
  },
  rapeseed: {
    id: 'rapeseed', name: 'Ріпак озимий', latin: 'Brassica napus L.', baseTemp: 3, depthMin: 1.5, depthMax: 2.5, depthSensitivity: 0.2,
    maxRoot: 150, potential: 4.3, maxHeight: 150, rowCrop: false, winter: true, epigeal: true, frostKillTemp: -15,
    nNeed: 18, beePollinated: true, maturityBbch: 89, color: '#3f8f5a',
    pest: { name: 'Ріпаковий квіткоїд', latin: 'Brassicogethes aeneus', kind: 'insect', unit: 'жуків/рослину' }, disease: { name: 'Альтернаріоз', latin: 'Alternaria brassicae', sign: 'концентричні темні плями з жовтим ореолом' },
    bbch: [[0, 0], [25, 3], [45, 5], [65, 7], [80, 9], [90, 10], [150, 12], [250, 14], [400, 16], [560, 19], [1000, 30], [1200, 39], [1350, 51], [1500, 61], [1600, 65], [1700, 69], [1950, 79], [2200, 85], [2400, 89]],
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
export interface SprayDef { name: string; detail: string; group: SprayGroup; spreader?: boolean }
export const SPRAYS: Record<SprayOp, SprayDef> = {
  preHerbicide: { name: 'Ґрунтовий досходовий гербіцид', detail: 'хлорацетаміди + триазинони', group: 'herb' },
  postHerbicide: { name: 'Страховий післясходовий гербіцид', detail: 'сульфонілсечовини', group: 'herb' },
  glyphosate: { name: 'Гербіцид суцільної дії', detail: 'гліфосат, 3 л/га', group: 'herb' },
  fungicide: { name: 'Фунгіцид', detail: 'триазоли + стробілурини', group: 'protect' },
  insecticide: { name: 'Інсектицид системно-контактний', detail: 'неонікотиноїд + піретроїд', group: 'protect' },
  acaricide: { name: 'Акарицид', detail: 'абамектин / спіродиклофен', group: 'protect' },
  retardant: { name: 'Ретардант (регулятор росту)', detail: 'хлормекват-хлорид + тринексапак-етил', group: 'regul' },
  desiccant: { name: 'Десикант перед збиранням', detail: 'дикват, 2 л/га', group: 'regul' },
  nitrogen: { name: 'Підживлення КАС-32 / карбамідом', detail: '+N 40 кг д.р./га', group: 'nutr' },
  pk: { name: 'Основне фосфорно-калійне добриво', detail: 'P₆₀K₉₀ (суперфосфат + KCl), розкидач', group: 'nutr', spreader: true },
  micro: { name: 'Позакореневе мікродобриво', detail: 'B + Zn + Mn (хелати)', group: 'nutr' },
  liming: { name: 'Вапнування (меліорація кислих ґрунтів)', detail: 'вапняне борошно CaCO₃, 4 т/га', group: 'nutr', spreader: true },
  antistress: { name: 'Антистресант', detail: 'амінокислоти + гумати', group: 'nutr' },
};

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
