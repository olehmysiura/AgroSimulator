// ============================================================================
// Ядро симуляції: початковий стан, денний такт (Tick = 1 день), прогноз урожаю
// ============================================================================
import { CROPS, EMERGENCE_BBCH, EPSH_WEEDS, ZONES, bbchFromGdd, gddForBbch, makeLayers } from './data';
import {
  drain, evaporate, infiltrate, layer, nitrogenCycle, panBlocking, redistribute, transpire, updateSoilTemps, weedTranspire,
} from './soil';
import type { Crop, CropId, LogKind, Mistake, SimState, ZoneId } from './types';
import { computeSat, generateWeather, weatherHistory } from './weather';
import { SEASON_LEN, clamp, doy, formatDay, round } from './util';

/** Сезонна вологість профілю на дату старту (весною — після сніготанення, восени — після посушливого літа). */
function seasonalMoisture(zone: ZoneId, day: number): [number, number] {
  const d = doy(day);
  const dry = zone === 'step' ? 8 : zone === 'polissia' ? -2 : 0;
  if (d < 75) return [80 - dry, 82 - dry];
  if (d < 130) return [78 - dry, 80 - dry];
  if (d < 200) return [64 - dry, 72 - dry];
  if (d < 280) return [48 - dry, 60 - dry];
  return [66 - dry, 64 - dry];
}

export function createInitialState(zone: ZoneId = 'lisostep', startDay = 91): SimState {
  const w = generateWeather(zone, startDay, 'normal');
  const [mt, md] = seasonalMoisture(zone, startDay);
  const d = doy(startDay);
  const z = ZONES[zone];
  const s: SimState = {
    zone,
    startDay,
    day: startDay,
    climate: 'normal',
    climateUntil: 99999,
    sprayMode: 'day',
    weather: w,
    wHistory: weatherHistory(zone, startDay),
    layers: makeLayers(zone, mt, md),
    nutrients: { ...z.nutrients },
    residue: d > 190 && d < 260 ? 75 : 45,
    crust: 0,
    snow: d < 70 || d > 340 ? 20 : 0,
    looseUntil: -1,
    seedbedQuality: 0.7,
    weeds: d > 100 && d < 280 ? 9 : 4,
    weedFlush: 0,
    preHerbUntil: -1,
    sat: computeSat(zone, startDay),
    crop: null,
    log: [],
    mistakes: [],
    activeErrors: [],
    quest: null,
    questHistory: [],
    diagnostics: [],
    operations: [],
    harvests: [],
    anim: null,
    seq: 1,
  };
  s.layers.forEach((l, i) => (l.temp = round(i < 4 ? w.tAir - i * 0.5 : (w.tAir + 2 * 9.5) / 3)));
  addLog(s, 'info', `Поле ініціалізовано: ${z.name} (${z.region}), ${formatDay(startDay, true)}`, `${z.soil}; pH ${z.pH}, гумус ${z.humus}%. Попередник — пшениця озима, стерня на поверхні.`);
  return s;
}

export function addLog(s: SimState, kind: LogKind, title: string, text?: string) {
  s.log.push({ id: s.seq++, day: s.day, kind, title, text });
  if (s.log.length > 600) s.log.splice(0, s.log.length - 600);
}

/** Реєструє агрономічну помилку: червоний блок розбору + запис у журналі. */
export function addMistake(s: SimState, action: string, cause: string, consequence: string) {
  const m: Mistake = { id: s.seq++, day: s.day, action, cause, consequence };
  s.mistakes.push(m);
  s.activeErrors.push(m);
  addLog(s, 'error', `ПОМИЛКА: ${action}`, `${cause} Наслідок: ${consequence}`);
  if (s.quest && !s.quest.solved) s.quest.notes.push(`Помилка: ${action}`);
}

export function newCrop(id: CropId, day: number, depth: number, seedTreatment: boolean, inoculated: boolean): Crop {
  return {
    id, sowDay: day, depth, seedTreatment, inoculated,
    gdd: 0, bbch: 0, germPotential: 92, stand: 0, emerged: false, crustDays: 0, corkscrew: false,
    rootDepth: depth, rootBlocked: false, health: 100, nStatus: 1, leafFrost: 0, growingPointAlive: true,
    stressUntil: -1, stressCause: '', disease: 0, fungicideUntil: -1, pests: 0, insecticideUntil: -1,
    nodules: 0, waterSupply: 1, waterIndex: 1, nIndex: 1, wilting: false, losses: {}, dead: false,
    deathCause: '', harvested: false, seedContact: 0.92, seedbedQuality: 0.8, lodged: false, retardant: false, desiccated: false,
  };
}

/** Встановити культуру одразу у задану фазу (для квестів). */
export function cropAtBbch(id: CropId, bbch: number, day: number, depth: number, stand = 92): Crop {
  const c = newCrop(id, day, depth, true, id === 'soy');
  c.gdd = gddForBbch(id, bbch) + 2;
  c.bbch = bbchFromGdd(id, c.gdd);
  if (c.bbch >= EMERGENCE_BBCH) {
    c.emerged = true;
    c.stand = stand;
    c.germPotential = stand;
  }
  c.rootDepth = targetRoot(c);
  return c;
}

export function targetRoot(c: Crop): number {
  const def = CROPS[c.id];
  if (!c.emerged) return c.depth + Math.min(6, c.gdd * 0.05);
  const gFull = gddForBbch(c.id, c.id === 'sugarbeet' ? 45 : 65);
  return clamp(c.depth + (def.maxRoot - c.depth) * Math.min(1, (c.gdd / gFull) ** 0.85), c.depth, def.maxRoot);
}

export function canopyCover(c: Crop | null): number {
  if (!c || !c.emerged || c.dead) return 0;
  const b = c.bbch;
  const base = b < 12 ? 0.05 : b < 16 ? 0.15 : b < 30 ? 0.35 : b < 40 ? 0.7 : b < 80 ? 0.92 : 0.5;
  return clamp(base * (c.stand / 100) * (0.5 + c.health / 200) * (1 - c.leafFrost * 0.7), 0, 0.95);
}

// ---------------------------------------------------------------------------
// TICK
// ---------------------------------------------------------------------------
export const lastDay = (s: SimState) => s.startDay + SEASON_LEN - 1;

export function tick(s: SimState) {
  if (s.day >= lastDay(s)) return;
  s.day += 1;
  s.anim = null;
  const d = doy(s.day);
  if (d === 1) s.sat = 0;
  if (s.climateUntil < s.day) s.climate = 'normal';
  const mode = s.climate;
  const w = generateWeather(s.zone, s.day, mode, s.crop?.depth ?? 5);
  s.weather = w;
  s.wHistory = [...s.wHistory.slice(-13), w];
  if (mode === 'storm' || mode === 'frost') s.climate = 'normal'; // разові події
  if (w.tAir > 10) s.sat += w.tAir;

  if (w.rain >= 20 && !w.snowfall) addLog(s, 'weather', `Злива ${round(w.rain)} мм`, `Інтенсивні опади, вітер ${w.wind} м/с.`);
  if (w.tMin <= -1.5 && d > 85 && d < 290) addLog(s, 'weather', `Приморозок: мінімум ${w.tMin} °C`, 'Радіаційне вихолодження в нічні години, іній на поверхні.');
  if ((mode === 'drought' || mode === 'heat') && s.day % 5 === 0) addLog(s, 'weather', `Повітряна посуха: +${w.tMax} °C`, `Відносна вологість повітря ${w.humidity}%.`);

  updateSoilTemps(s, w.tAir - (s.snow > 5 ? (w.tAir < 0 ? w.tAir * 0.7 : 0) : 0));

  // ---- сніг: накопичення та весняне сніготанення
  const c = s.crop && !s.crop.dead && !s.crop.harvested ? s.crop : null;
  const cover = canopyCover(c);
  let liquid = w.rain;
  if (w.snowfall) {
    s.snow = round(s.snow + w.rain, 1);
    liquid = 0;
    if (w.rain > 3) addLog(s, 'weather', `Снігопад ${round(w.rain)} мм води`, `Запас води в снігу ${round(s.snow)} мм.`);
  } else if (s.snow > 0 && w.tAir > 0) {
    const melt = Math.min(s.snow, 2.5 * w.tAir + (w.rain > 0 ? 3 : 0));
    s.snow = round(s.snow - melt, 1);
    liquid += melt;
    if (s.snow <= 0) addLog(s, 'weather', 'Сніговий покрив зійшов', 'Талі води поповнили запаси вологи в профілі.');
  }
  if (liquid > 0) {
    const { perched } = infiltrate(s, liquid * (1 - cover * 0.12));
    if (perched && liquid > 15) addLog(s, 'warn', 'Застій води в орному шарі', 'Вода не проходить нижче 30 см, на поверхні калюжі.');
    // кірка: формується після зливи на ґрунті без мульчі та без змиканого покриву
    if (w.rain >= 22 && !w.snowfall && s.residue < 35 && cover < 0.4) {
      s.crust = round(clamp(0.8 + w.rain / 30, 1, 2.4), 1);
      layer(s, 'surface').density = 1.42;
      addLog(s, 'weather', 'Після зливи на поверхні утворилась ґрунтова кірка', `Товщина ~${s.crust} см, при підсиханні — тріщини.`);
    }
  }
  drain(s);
  redistribute(s);
  const et0 = s.snow > 3 ? 0 : Math.max(0, 0.2 * (w.tAir + 5) * (1 + w.wind * 0.05) * (1 - w.humidity / 200));
  evaporate(s, et0, cover);
  weedTranspire(s, et0, s.weeds, cover);
  nitrogenCycle(s, w.tSoil);
  // повільне розкладання рослинних решток
  if (w.tAir > 8 && layer(s, 'surface').moisture > 35) s.residue = round(Math.max(0, s.residue - 0.06), 2);

  // ---- бур'яни: весняна (березень–червень) та осіння хвилі проростання
  const sb = layer(s, 'seedbed');
  const wave = (d > 75 && d < 190) || (d > 230 && d < 290);
  if (w.tSoil > 7 && sb.moisture > 45 && wave) {
    const herb = s.preHerbUntil >= s.day ? 0.15 : 1;
    const shade = 1 - cover * 0.8;
    s.weeds += (0.2 + s.weeds * 0.012 + s.weedFlush * 0.08) * herb * shade;
    s.weedFlush = Math.max(0, s.weedFlush - 0.25);
  }
  if (w.tMin < -4) s.weeds *= 0.85;
  s.weeds = round(clamp(s.weeds, 0, 400), 1);

  if (c) growCrop(s, c);
}

function growCrop(s: SimState, c: Crop) {
  const def = CROPS[c.id];
  const w = s.weather;
  // після BBCH 71 дозрівання (втрата вологи зерном) йде і за прохолодної погоди
  const dailyG = c.desiccated ? 40 : Math.max(c.bbch >= 71 ? 8 : 0, Math.min(w.tAir, 30) - def.baseTemp);
  const sb = layer(s, 'seedbed');

  if (!c.emerged) {
    // ---- проростання: залежить від температури ґрунту, вологи ложа і глибини
    const moist = sb.moisture > 45 ? 1 : sb.moisture > 30 ? 0.5 : 0.1;
    const soilG = Math.max(0, Math.min(w.tSoil, 30) - def.baseTemp);
    const depthF = clamp(((def.depthMin + def.depthMax) / 2 / c.depth) ** 0.6, 0.45, 1.4);
    const add = soilG * moist * depthF * c.seedContact;
    const gEmerge = gddForBbch(c.id, EMERGENCE_BBCH);
    if (w.tSoil < def.baseTemp - 2 && s.day - c.sowDay > 3) {
      // тривале перебування насіння у холодному ґрунті — пліснявіння
      const loss = c.seedTreatment ? 0.4 : 1.2;
      c.germPotential = Math.max(5, c.germPotential - loss);
    }
    if (s.crust > 0 && c.gdd + add >= gEmerge - 15) {
      // кірка: проросток впирається, деформується («штопорить»)
      c.gdd = Math.max(c.gdd, gEmerge - 15);
      c.crustDays += 1;
      c.corkscrew = true;
      if (c.crustDays > 2) c.germPotential = Math.max(0, c.germPotential * 0.9);
      if (c.crustDays === 3) addLog(s, 'warn', 'Сходи у рядках відсутні', 'Поверхня ущільнена, сіра, з полігональними тріщинами.');
      if (c.germPotential < 8) {
        c.dead = true;
        c.deathCause = 'Проростки загинули під ґрунтовою кіркою, вичерпавши запас поживних речовин ендосперму/сім\'ядолей.';
        addLog(s, 'error', 'Загибель посіву під кіркою', c.deathCause);
        questFailed(s, 'Посів загинув під кіркою.');
      }
    } else {
      c.gdd += add;
    }
    c.bbch = bbchFromGdd(c.id, c.gdd);
    c.rootDepth = targetRoot(c);
    if (c.bbch >= EMERGENCE_BBCH && !c.dead) {
      c.emerged = true;
      c.corkscrew = false;
      c.stand = round(c.germPotential * (c.crustDays > 0 ? 0.92 : 1), 0);
      addLog(s, 'info', `Сходи: ${def.name}`, `Польова схожість ${c.stand}%. Тривалість посів–сходи: ${s.day - c.sowDay} діб.`);
    }
    return;
  }

  // ---- вегетація
  if (c.bbch >= def.maturityBbch) {
    harvest(s, c);
    return;
  }
  // фенологія керується температурою; водний стрес лише гальмує розвиток
  const growth = dailyG * clamp(0.85 + 0.2 * c.waterSupply, 0.85, 1) * (c.stressUntil >= s.day ? 0.85 : 1);
  c.gdd += growth;
  const prevB = c.bbch;
  c.bbch = bbchFromGdd(c.id, c.gdd);
  if (Math.floor(prevB / 10) !== Math.floor(c.bbch / 10)) addLog(s, 'info', `Фенофаза: ${def.name} BBCH ${c.bbch}`);

  // ---- коріння: обмежується підплужною підошвою ≥3 МПа
  const target = targetRoot(c);
  let rd = c.rootDepth + clamp(target - c.rootDepth, 0, 3);
  if (panBlocking(s) && rd > 30) {
    rd = 30;
    if (!c.rootBlocked) addLog(s, 'warn', 'Ріст коріння сповільнився', `Глибина основної маси коренів ~30 см (культура ${def.name}).`);
    c.rootBlocked = true;
  } else if (!panBlocking(s)) c.rootBlocked = false;
  c.rootDepth = round(rd, 1);

  // ---- вода
  const cover = canopyCover(c);
  const et0 = Math.max(0, 0.2 * (w.tAir + 5) * (1 + w.wind * 0.05) * (1 - w.humidity / 200));
  const supply = transpire(s, et0, cover, c.rootDepth);
  const heat = w.tMax > 32 ? 0.12 : 0;
  c.waterSupply = round(clamp(supply - heat, 0, 1), 2);
  const wasWilting = c.wilting;
  c.wilting = c.waterSupply < 0.28 && et0 > 3;
  if (c.wilting && !wasWilting) addLog(s, 'warn', 'Денне в\'янення листя', `Тургор втрачається у полуденні години; t° повітря ${w.tMax} °C.`);
  const critical = c.bbch >= 51 && c.bbch <= 75;
  const wf = clamp(c.waterSupply / 0.5, 0, 1);
  c.waterIndex = round(c.waterIndex * (critical ? 0.985 : 0.993) + wf * (critical ? 0.015 : 0.007), 4);

  // ---- азот
  const a = layer(s, 'arable');
  const uptake = c.bbch > 13 && c.bbch < 75 ? 0.06 * cover : 0.01;
  a.nitrogen = Math.max(1, a.nitrogen - uptake);
  const nAvail = a.nitrogen + (c.rootDepth > 35 ? layer(s, 'transition').nitrate * 0.5 : 0);
  let ns = nAvail / def.nNeed;
  if (c.id === 'soy') {
    if (c.inoculated && c.bbch >= 12) c.nodules = Math.min(c.nodules + (a.pH < 5.6 ? 0.3 : 1.1), a.pH < 5.6 ? 8 : 28);
    ns += c.nodules / 20;
  }
  c.nStatus = round(clamp(ns, 0.2, 1.45), 2);
  c.nIndex = round(c.nIndex * 0.99 + clamp(c.nStatus, 0, 1) * 0.01, 4);
  if (c.retardant && c.health < 100) c.health = Math.min(100, c.health + 0.1);

  // ---- приморозок
  if (w.tMin <= -1.5) frostEvent(s, c);
  if (c.dead) return;

  // ---- хвороби (крапельно-рідинна волога листка + температура)
  const wet = w.leafWet >= 8 || w.rain > 2;
  if (c.fungicideUntil < s.day) {
    const wheat = c.id === 'wheat';
    if (wheat && c.bbch >= 25 && c.disease < 1 && doy(s.day) > 80 && doy(s.day) < 200) c.disease = 1;
    if (!wheat && c.bbch >= 30 && c.disease < 0.5) c.disease = 0.5;
    const fav = wet && w.tAir > 9 && w.tAir < 26;
    const r = wheat ? (fav ? 1.07 : 1.012) : fav ? 1.035 : 1.004;
    if (c.bbch < 80 && w.tAir > 3) c.disease = round(clamp(c.disease * r + (wet ? (wheat ? 0.08 : 0.03) : 0), 0, wheat ? 92 : 45), 1);
  }

  // ---- шкідники
  if (c.insecticideUntil < s.day) {
    const def2 = CROPS[c.id];
    let inc = 0;
    if (def2.pest.kind === 'mite') {
      // павутинний кліщ: спалахи в спеку та суху погоду, дощ змиває
      if (w.tAir > 22 && w.humidity < 60) inc = 0.25 + c.pests * 0.14;
      if (w.rain > 5) inc -= c.pests * 0.25;
    } else if (c.id === 'rapeseed') {
      if (c.bbch >= 50 && c.bbch < 70 && w.tAir > 11) inc = 0.12 + c.pests * 0.05;
    } else {
      const warm = w.tAir > 18 ? 0.035 : 0.003;
      const prot = c.seedTreatment && c.bbch < 16 ? 0.2 : 1;
      inc = (warm + c.pests * warm * 0.35) * prot - (w.rain > 10 ? c.pests * 0.08 : 0);
    }
    c.pests = round(clamp(c.pests + inc, 0, 80), 1);
  }

  // ---- вилягання: загущення + надлишок N + злива/вітер
  if ((c.id === 'wheat' || c.id === 'rapeseed') && !c.lodged && c.bbch >= 51 && c.bbch < 87) {
    const risk = (c.stand / 100) * Math.max(0.8, c.nStatus) * (c.retardant ? 0.72 : 1);
    if (risk > 1.2 && (w.rain >= 12 || w.wind >= 8)) {
      c.lodged = true;
      c.losses.lodging = 0.74;
      addLog(s, 'warn', 'Вилягання посіву', 'Після зливи з вітром стебла поламались біля основи; рослини полягли «плямами».');
    }
  }

  // ---- зимівля озимих
  if (CROPS[c.id].winter && w.tMin < -21 && s.snow < 10) {
    c.stand = round(c.stand * 0.85, 0);
    addLog(s, 'warn', 'Вимерзання озимих', `Мороз ${w.tMin} °C без снігового покриву: частина вузлів кущіння загинула.`);
  }

  // ---- здоров'я
  let h = c.health;
  if (c.wilting) h -= 0.6;
  if (c.disease > 20) h -= 0.3;
  if (c.stressUntil < s.day) h += 0.8;
  c.leafFrost = Math.max(0, c.leafFrost - 0.03);
  c.health = round(clamp(h, 5, 100), 1);
}

function frostEvent(s: SimState, c: Crop) {
  const def = CROPS[c.id];
  const t = s.weather.tMin;
  if (def.winter) {
    if (c.bbch >= 51 && c.bbch <= 69) {
      c.losses.frostFlower = (c.losses.frostFlower ?? 1) * 0.88;
      addLog(s, 'warn', 'Приморозок у фазу цвітіння', 'Частина квіток стерильна (побуріння пиляків).');
    }
    return;
  }
  if (c.bbch >= 71 && t > -6) {
    // осінній заморозок на дозріваючому посіві: вегетація припиняється, налив зупинено
    if (!c.desiccated) {
      c.desiccated = true;
      if (c.bbch < 85) c.losses.frostFlower = (c.losses.frostFlower ?? 1) * (c.bbch < 79 ? 0.85 : 0.95);
      addLog(s, 'warn', `Заморозок ${t} °C зупинив вегетацію`, `${def.name}: листя загинуло, налив насіння припинено (BBCH ${c.bbch}).`);
    }
    return;
  }
  if (c.id === 'corn') {
    c.leafFrost = Math.max(c.leafFrost, 0.75);
    c.stressUntil = s.day + 8;
    c.stressCause = 'приморозок';
    c.health = Math.min(c.health, 58);
    if (c.bbch < 16) {
      c.growingPointAlive = true;
      c.losses.frostLeaf = (c.losses.frostLeaf ?? 1) * 0.97;
      addLog(s, 'warn', 'Листя кукурудзи почорніло після приморозку', 'Листкові пластинки водянисто-темні, згодом буріють та підсихають.');
    } else if (t <= def.frostKillTemp) {
      c.growingPointAlive = false;
      c.dead = true;
      c.deathCause = 'Точка росту кукурудзи після BBCH 16 знаходиться над поверхнею ґрунту і загинула від приморозку.';
      addLog(s, 'error', 'Загибель посіву кукурудзи від приморозку', c.deathCause);
    }
    return;
  }
  if (t <= def.frostKillTemp) {
    const loss = c.bbch < 14 ? 0.55 : 0.35;
    c.stand = round(c.stand * (1 - loss), 0);
    c.leafFrost = 0.8;
    c.stressUntil = s.day + 8;
    c.stressCause = 'приморозок';
    addLog(s, 'warn', `Пошкодження сходів (${def.name}) приморозком`, `Частина рослин з надземною точкою росту загинула; густота ${c.stand}%.`);
  } else {
    c.leafFrost = Math.max(c.leafFrost, 0.3);
    c.stressUntil = s.day + 4;
    c.stressCause = 'приморозок';
  }
}

function harvest(s: SimState, c: Crop) {
  const y = yieldForecast(s);
  c.harvested = true;
  s.residue = c.id === 'soy' || c.id === 'sugarbeet' ? 25 : 80;
  s.harvests.push({ day: s.day, crop: c.id, yield: y.tha, pct: y.pct });
  addLog(s, 'success', `Збирання врожаю: ${CROPS[c.id].name}`, `Біологічна врожайність ${y.tha} т/га (${y.pct}% від потенціалу), ${formatDay(s.day)}.`);
}

// ---------------------------------------------------------------------------
// Прогноз біологічної врожайності
// ---------------------------------------------------------------------------
export interface YieldBreakdown {
  potential: number;
  tha: number;
  pct: number;
  factors: { name: string; value: number }[];
}

export function standFactor(stand: number): number {
  if (stand > 115) return clamp(1 - (stand - 115) * 0.004, 0.75, 1); // загущення: конкуренція
  if (stand >= 85) return 1;
  if (stand <= 0) return 0;
  return clamp(1 - ((85 - stand) / 85) ** 1.3 * 1.05, 0, 1);
}

export function yieldForecast(s: SimState): YieldBreakdown {
  const c = s.crop;
  if (!c) return { potential: 0, tha: 0, pct: 0, factors: [] };
  const def = CROPS[c.id];
  const potential = round(def.potential * (ZONES[s.zone].potential[c.id] ?? 1), 1);
  if (c.dead) return { potential, tha: 0, pct: 0, factors: [{ name: 'Загибель посіву', value: 0 }] };
  const stand = c.emerged ? c.stand : c.germPotential;
  const factors: { name: string; value: number }[] = [
    { name: 'Густота стояння', value: standFactor(stand) },
    { name: 'Водозабезпечення', value: clamp(0.35 + 0.65 * c.waterIndex, 0, 1) },
    { name: 'Азотне живлення', value: clamp(0.55 + 0.45 * Math.min(1, c.nIndex), 0, 1) },
    { name: 'Хвороби', value: 1 - Math.min(0.6, (c.disease / 100) * 0.75) },
    { name: CROPS[c.id].pest.kind === 'mite' ? 'Павутинний кліщ' : 'Шкідники', value: 1 - Math.min(0.4, c.pests * (CROPS[c.id].pest.kind === 'mite' ? 0.006 : c.id === 'rapeseed' ? 0.03 : 0.008)) },
    { name: 'Бур\'яни', value: 1 - Math.min(0.4, Math.max(0, s.weeds - EPSH_WEEDS) * 0.0045 * (c.emerged && c.bbch > 30 ? 0.5 : 1)) },
  ];
  const lossNames: Record<string, string> = {
    bees: 'Загибель запилювачів', phyto: 'Фітотоксичність гербіциду', frostLeaf: 'Приморозкове пошкодження листя',
    frostFlower: 'Приморозок у цвітіння', lateSowing: 'Пізній пересів', vernal: 'Відсутність яровизації',
    mechanical: 'Механічне пошкодження', compaction: 'Ущільнення ґрунту', drift: 'Неефективний захист',
    lodging: 'Вилягання', desiccEarly: 'Передчасна десикація', acid: 'Кисла реакція ґрунту', retard: 'Пізній ретардант',
  };
  for (const [k, v] of Object.entries(c.losses)) factors.push({ name: lossNames[k] ?? k, value: v });
  const total = factors.reduce((p, f) => p * f.value, 1);
  const tha = round(potential * total, c.id === 'sugarbeet' ? 1 : 2);
  return { potential, tha, pct: Math.round(total * 100), factors: factors.map((f) => ({ ...f, value: round(f.value, 3) })) };
}

// ---------------------------------------------------------------------------
// Статус ситуаційного виклику
// ---------------------------------------------------------------------------
export function questSolved(s: SimState, text: string) {
  if (!s.quest || s.quest.solved || s.quest.failed) return;
  s.quest.solved = true;
  if (!s.quest.diagnosed) s.quest.notes.push('Рішення ухвалено без попередньої інструментальної діагностики');
  addLog(s, 'success', 'Виклик розв\'язано', text + (s.quest.diagnosed ? '' : ' (зауваження: дію виконано без інструментальної діагностики).'));
}

export function questFailed(s: SimState, why: string) {
  if (!s.quest || s.quest.solved || s.quest.failed) return;
  s.quest.failed = true;
  s.quest.notes.push(why);
  addLog(s, 'quest', 'Виклик провалено', why);
}
