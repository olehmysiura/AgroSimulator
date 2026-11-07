// ============================================================================
// AgroSim UA — типи стану симуляції (State-Driven Simulation, Tick = 1 день)
// ============================================================================

export type ZoneId = 'polissia' | 'lisostep' | 'step';
export type ClimateMode = 'normal' | 'storm' | 'drought' | 'frost' | 'wind';
export type CropId = 'corn' | 'wheat' | 'sunflower' | 'soy' | 'rapeseed' | 'sugarbeet';
export type SprayMode = 'day' | 'evening';

export type TillageOp = 'plough' | 'chisel' | 'disc' | 'cultivate' | 'rotaryHoe' | 'roll';
export type SprayOp = 'nitrogen' | 'preHerbicide' | 'postHerbicide' | 'fungicide' | 'insecticide' | 'antistress';
export type ToolId = 'penetrometer' | 'auger' | 'frame' | 'shovel' | 'lens' | 'ndvi';
export type QuestId = 'crust' | 'frost' | 'pan' | 'septoria';
export type CrisisId = 'crust' | 'frost' | 'pan' | 'septoria' | 'pests' | 'weeds' | 'nitrogen' | 'drought';

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

export interface Weather {
  tAir: number; // середньодобова, °C
  tMin: number; // нічний мінімум
  tMax: number;
  tSoil: number; // на глибині посіву
  wind: number; // м/с
  rain: number; // мм
  humidity: number; // %
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
  stand: number; // фактична густота відносно цільової, %
  emerged: boolean;
  crustDays: number;
  corkscrew: boolean; // проростки "штопорять" під кіркою
  rootDepth: number; // см
  rootBlocked: boolean;
  health: number; // 0..100
  nStatus: number; // 0..1.2
  leafFrost: number; // частка почорнілого листя 0..1
  growingPointAlive: boolean;
  stressUntil: number; // день, до якого культура у стані стресу
  stressCause: string;
  disease: number; // % ураження (септоріоз/хвороби)
  fungicideUntil: number;
  pests: number; // особин на рослину
  insecticideUntil: number;
  nodules: number; // бульбочок на рослину
  waterSupply: number; // 0..1 поточне забезпечення
  waterIndex: number; // інтегральний водний фактор
  nIndex: number;
  wilting: boolean;
  losses: Record<string, number>; // мультиплікативні фактори втрат
  dead: boolean;
  deathCause: string;
  harvested: boolean;
  seedContact: number; // 0.85..1 (коткування покращує)
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
  kind: TillageOp | 'sow' | 'spray' | 'clear';
  key: number;
  drift?: boolean;
  evening?: boolean;
}

export interface SimState {
  zone: ZoneId;
  day: number;
  climate: ClimateMode;
  climateUntil: number; // день завершення тимчасового режиму
  sprayMode: SprayMode;
  weather: Weather;
  layers: SoilLayer[];
  residue: number; // % покриття пожнивними рештками
  crust: number; // товщина кірки, см
  seedbedQuality: number; // 0..1
  weeds: number; // шт./м2
  weedFlush: number; // потенціал проростання бур'янів (після дискування)
  preHerbUntil: number;
  sat: number; // сума активних температур >10 °C з 1 січня
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
