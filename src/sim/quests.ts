// ============================================================================
// Чотири кризові сценарії (квести). В описі — лише об'єктивні симптоми.
// ============================================================================
import { addLog, createInitialState, cropAtBbch } from './engine';
import { layer, panBlocking } from './soil';
import { gddForBbch } from './data';
import type { QuestId, SimState } from './types';
import { generateWeather } from './weather';

export interface QuestDef {
  id: QuestId;
  title: string;
  zone: SimState['zone'];
  day: number;
  symptoms: string[];
}

export const QUESTS: Record<QuestId, QuestDef> = {
  crust: {
    id: 'crust',
    title: 'Повітряна посуха та ґрунтова кірка після зливи',
    zone: 'lisostep',
    day: 128,
    symptoms: [
      'Соняшник висіяно 8 діб тому, сівалка налаштована на 5 см.',
      '4 доби тому — злива 41 мм за 40 хвилин; після неї спека до +31 °C, відносна вологість повітря 24–30%.',
      'Сходів у рядках немає. Поверхня поля сіра, глянцева, з полігональними тріщинами.',
    ],
  },
  frost: {
    id: 'frost',
    title: 'Нічний приморозок −2 °C по сходах кукурудзи',
    zone: 'lisostep',
    day: 136,
    symptoms: [
      'Минулої ночі температура повітря на висоті 2 м опустилась до −2 °C, на траві — іній.',
      'Кукурудза у фазі 3 листків. Листкові пластинки почорніли, водянисті, частина листків полягла.',
      'Температура ґрунту на глибині 5 см о 6:00 — +1,8 °C.',
    ],
  },
  pan: {
    id: 'pan',
    title: 'В\'янення рослин за наявності вологи в глибоких шарах',
    zone: 'lisostep',
    day: 188,
    symptoms: [
      'Кукурудза, фаза стеблування. Шосту добу поспіль з 12:00 до 17:00 листя скручується «в трубку», рослини втрачають тургор; уночі частково відновлюються.',
      'За травень–червень випало 64 мм опадів, останні 11 діб опадів не було.',
      'Висота рослин нерівномірна, нижнє листя з ознаками передчасного старіння. Багаторічна оранка на 25–27 см.',
    ],
  },
  septoria: {
    id: 'septoria',
    title: 'Спалах септоріозу пшениці при шквальному вітрі 9,5 м/с',
    zone: 'lisostep',
    day: 142,
    symptoms: [
      'Пшениця озима, прапорцевий листок повністю розгорнутий.',
      'На листках нижнього та середнього ярусів — видовжені світло-бурі некротичні плями, обмежені жилками; площа ураження ~44%.',
      'Метеостанція: вітер поривами 9,5 м/с, відносна вологість 78%, температура +16 °C; прогноз — затухання вітру після заходу сонця.',
    ],
  },
};

export function loadQuest(id: QuestId): SimState {
  const q = QUESTS[id];
  const s = createInitialState(q.zone, q.day);
  s.log = [];
  const a = layer(s, 'arable');
  const sb = layer(s, 'seedbed');
  const surf = layer(s, 'surface');
  const pan = layer(s, 'pan');
  const b = layer(s, 'transition');
  const c = layer(s, 'parent');

  switch (id) {
    case 'crust': {
      s.climate = 'drought';
      s.climateUntil = q.day + 5;
      s.residue = 4;
      s.crust = 2.0;
      s.weeds = 3;
      surf.moisture = 20; surf.density = 1.45;
      sb.moisture = 52; a.moisture = 66;
      const crop = cropAtBbch('sunflower', 7, q.day - 8, 5);
      crop.gdd = gddForBbch('sunflower', 10) - 15; // проросток упирається в кірку
      crop.bbch = 9;
      crop.germPotential = 88;
      crop.crustDays = 2;
      crop.corkscrew = true;
      crop.seedTreatment = true;
      s.crop = crop;
      break;
    }
    case 'frost': {
      s.residue = 25;
      sb.moisture = 70; a.moisture = 74;
      const crop = cropAtBbch('corn', 13, 112, 5, 90);
      crop.leafFrost = 0.8;
      crop.stressUntil = q.day + 8;
      crop.stressCause = 'приморозок';
      crop.health = 55;
      crop.growingPointAlive = true;
      crop.losses.frostLeaf = 0.97;
      s.crop = crop;
      s.weeds = 5;
      s.preHerbUntil = q.day + 20;
      break;
    }
    case 'pan': {
      s.residue = 10;
      surf.moisture = 16; sb.moisture = 22; a.moisture = 26;
      pan.resistance = 3.6; pan.density = 1.56; pan.moisture = 75;
      b.moisture = 84; c.moisture = 86;
      const crop = cropAtBbch('corn', 32, 118, 5, 88);
      crop.rootDepth = 30;
      crop.rootBlocked = true;
      crop.wilting = true;
      crop.waterSupply = 0.1;
      crop.waterIndex = 0.86;
      crop.health = 70;
      s.crop = crop;
      s.weeds = 4;
      break;
    }
    case 'septoria': {
      s.climate = 'wind';
      s.climateUntil = q.day + 2;
      s.residue = 30;
      sb.moisture = 66; a.moisture = 72;
      const crop = cropAtBbch('wheat', 39, 262 - 365, 4, 90);
      crop.disease = 44;
      crop.health = 72;
      crop.pests = 0.8;
      s.crop = crop;
      s.weeds = 4;
      break;
    }
  }
  if (s.crop && s.crop.emerged && panBlocking(s) && s.crop.rootDepth > 30) {
    s.crop.rootDepth = 30;
    s.crop.rootBlocked = true;
  }
  s.weather = generateWeather(s.zone, s.day, s.climate, s.crop?.depth ?? 5);
  if (id === 'frost') s.weather = { ...s.weather, tMin: -2, tAir: 6.5, tSoil: 1.8, wind: 1.1, rain: 0, humidity: 86, event: 'frost' };
  if (id === 'pan') s.weather = { ...s.weather, tAir: 26, tMax: 31, rain: 0, humidity: 42 };
  s.quest = { id, diagnosed: false, solved: false, failed: false, startDay: s.day, notes: [] };
  addLog(s, 'quest', `Ситуаційний виклик: ${q.title}`, q.symptoms.join(' '));
  return s;
}
