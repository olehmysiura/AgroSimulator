// ============================================================================
// AgroSim UA — типи стану симуляції (State-Driven Simulation, Tick = 1 день)
// ============================================================================

export type ZoneId = 'polissia' | 'lisostep' | 'step';
export type ClimateMode = 'normal' | 'storm' | 'drought' | 'frost' | 'wind' | 'heat' | 'rainy';
export type CropId = 'corn' | 'wheat' | 'sunflower' | 'soy' | 'rapeseed' | 'sugarbeet';
export type SprayMode = 'day' | 'evening';

export type TillageOp =
  | 'plough' | 'chisel' | 'flatCut' | 'stripTill' | 'disc' | 'stubbleDisc'
  | 'cultivate' | 'harrow' | 'rotaryHoe' | 'interRow' | 'roll' | 'mulcher';
export type SprayOp =
  | 'preHerbicide' | 'postHerbicide' | 'glyphosate' | 'fungicide' | 'insecticide' | 'acaricide'
  | 'retardant' | 'desiccant'
  | 'nitrogen' | 'pk' | 'micro' | 'liming' | 'antistress';
export type ToolId =
  | 'penetrometer' | 'auger' | 'frame' | 'shovel' | 'lens' | 'ndvi'
  | 'thermometer' | 'infiltrometer' | 'traps' | 'agrolab' | 'meteo';
export type QuestId =
  | 'crust' | 'frost' | 'pan' | 'septoria'
  | 'nitrogen' | 'mites' | 'wetsoil' | 'weeds' | 'beetle' | 'coldsoil' | 'acid' | 'lodging';
export type CrisisId = QuestId | 'pests' | 'drought';

export type LayerId = 'surface' | 'seedbed' | 'arable' | 'pan' | 'transition' | 'parent';

export interface SoilLayer {
  id: LayerId;
  top: number; // см
  bottom: number; // см
  moisture: number; // % НВ
  density: number; // г/см3
  resistance: number; // базовий опір пенетрації, МПа (при ~75% НВ)
  humus: number; // %
  nitrogen: number; // доступний мінеральний N, мг/кг
  nitrate: number; // промитий нітратний N (NO3), мг/кг
  pH: number;
  temp: number; // °C
}

export interface Nutrients {
  P2O5: number; // мг/кг (за Чиріковим / Мачигіним)
  K2O: number; // мг/кг
  S: number;
  B: number;
  Zn: number;
}

export interface Weather {
  day: number;
  tAir: number; // середньодобова, °C
  tMin: number; // нічний мінімум
  tMax: number;
  tSoil: number; // на глибині посіву
  wind: number; // м/с
  rain: number; // мм (опади всіх видів)
  snowfall: boolean;
  humidity: number; // %
  leafWet: number; // год зволоження листка
  event: ClimateMode;
}

export interface Crop {
  id: CropId;
  sowDay: number;
  depth: number; // глибина загортання, см
  seedTreatment: boolean;
  inoculated: boolean;
  gdd: number; // накопичена САТ (ефективні температури) від посіву
  bbch: number;
  germPotential: number; // потенційна польова схожість, %
  stand: number; // фактична густота відносно цільової, % (може бути >100 — загущення)
  emerged: boolean;
  crustDays: number;
  corkscrew: boolean;
  rootDepth: number; // см
  rootBlocked: boolean;
  health: number; // 0..100
  nStatus: number; // 0..1.4
  leafFrost: number; // частка почорнілого листя 0..1
  growingPointAlive: boolean;
  stressUntil: number;
  stressCause: string;
  disease: number; // % ураження
  fungicideUntil: number;
  pests: number; // особин на рослину (кліщ — на листок)
  insecticideUntil: number;
  nodules: number;
  waterSupply: number;
  waterIndex: number;
  nIndex: number;
  wilting: boolean;
  lodged: boolean;
  retardant: boolean;
  desiccated: boolean;
  losses: Record<string, number>;
  dead: boolean;
  deathCause: string;
  harvested: boolean;
  seedContact: number;
  seedbedQuality: number;
}

export type LogKind = 'info' | 'op' | 'diag' | 'error' | 'success' | 'weather' | 'quest' | 'warn';

export interface LogEntry {
  id: number;
  day: number;
  kind: LogKind;
  title: string;
  text?: string;
}

export interface Mistake {
  id: number;
  day: number;
  action: string;
  cause: string;
  consequence: string;
}

export interface QuestState {
  id: QuestId;
  diagnosed: boolean;
  solved: boolean;
  failed: boolean;
  startDay: number;
  notes: string[];
}

export interface Animation {
  kind: TillageOp | 'sow' | 'spray' | 'clear' | 'spread';
  key: number;
  drift?: boolean;
  evening?: boolean;
}

export interface SimState {
  zone: ZoneId;
  startDay: number; // перший день сезону (абсолютний)
  day: number; // поточний абсолютний день
  climate: ClimateMode;
  climateUntil: number;
  sprayMode: SprayMode;
  weather: Weather;
  wHistory: Weather[]; // останні 14 діб (метеостанція)
  layers: SoilLayer[];
  nutrients: Nutrients;
  residue: number; // % покриття пожнивними рештками
  crust: number; // товщина кірки, см
  snow: number; // запас води в сніговому покриві, мм
  looseUntil: number; // день, до якого діє розпушений «мульчуючий» шар (закрита волога)
  seedbedQuality: number;
  weeds: number; // шт./м2
  weedFlush: number;
  preHerbUntil: number;
  sat: number; // сума активних температур >10 °C з 1 січня поточного року
  crop: Crop | null;
  log: LogEntry[];
  mistakes: Mistake[];
  activeErrors: Mistake[];
  quest: QuestState | null;
  questHistory: QuestState[];
  diagnostics: { day: number; tool: ToolId; relevant: boolean }[];
  operations: { day: number; name: string }[];
  harvests: { day: number; crop: CropId; yield: number; pct: number }[];
  anim: Animation | null;
  seq: number;
}
