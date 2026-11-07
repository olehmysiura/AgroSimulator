// ============================================================================
// Метеостанція: детермінований кліматичний генератор із «пам'яттю» погоди
//  • температурні аномалії тривають кілька діб (інерція повітряних мас)
//  • опади групуються в синоптичні періоди (дощові / сухі тижні)
//  • сезонний хід опадів з максимумом у червні–липні
//  • за температури < 0 °C опади випадають снігом
// ============================================================================
import { ZONES } from './data';
import type { ClimateMode, Weather, ZoneId } from './types';
import { clamp, doy, hashRand, round } from './util';

export function climTemp(zone: ZoneId, day: number): number {
  const z = ZONES[zone];
  return z.tMean - z.tAmp * Math.cos((2 * Math.PI * (doy(day) - 18)) / 365);
}

/** Згладжена температурна аномалія (інерція 4–5 діб) */
function tAnomaly(zone: ZoneId, day: number): number {
  const w = [0.36, 0.26, 0.18, 0.12, 0.08];
  let a = 0;
  for (let k = 0; k < w.length; k++) a += w[k] * (hashRand(zone, day - k, 't') - 0.5);
  // синоптичний масштаб (тепла/холодна хвиля ~ тиждень)
  a += 0.6 * (hashRand(zone, Math.floor(day / 7), 'wave') - 0.5);
  return a * 9;
}

/** Генерує погоду дня. `mode` — режим кліматичного перемикача. */
export function generateWeather(zone: ZoneId, day: number, mode: ClimateMode, depth = 5): Weather {
  const z = ZONES[zone];
  const d = doy(day);
  const r1 = hashRand(zone, day, 't');
  const r2 = hashRand(zone, day, 'r');
  const r3 = hashRand(zone, day, 'a');
  const r4 = hashRand(zone, day, 'w');
  let tAir = climTemp(zone, day) + tAnomaly(zone, day);
  // синоптичний період: «дощовий» або «сухий» тиждень
  const syn = hashRand(zone, Math.floor((day + 3) / 6), 'syn');
  const season = 1 + 0.35 * Math.cos((2 * Math.PI * (d - z.rainPeak)) / 365);
  const p = clamp(z.rainProb * season * (0.35 + 1.3 * syn), 0.03, 0.8);
  let rain = r2 < p ? -Math.log(1 - r3 * 0.985) * z.rainMean * (0.8 + 0.4 * syn) : 0;
  let wind = clamp(z.windMean + (r4 - 0.5) * 3.2 + (rain > 8 ? 1.5 : 0), 0.4, 8.5);
  let humidity = clamp(z.humidity + (rain > 0 ? 16 : -4) + (syn - 0.5) * 16 - Math.max(0, tAir - 20) * 1.4, 22, 98);
  let amp = rain > 0 ? 6 : 10 + (1 - humidity / 100) * 6;

  switch (mode) {
    case 'storm':
      rain = 38 + r3 * 8;
      humidity = 96;
      wind = Math.max(wind, 6.5);
      tAir = Math.max(tAir - 3, tAir * 0.85);
      amp = 5;
      break;
    case 'rainy':
      rain = Math.max(rain, 6 + r3 * 10);
      humidity = Math.max(humidity, 88);
      tAir -= 2;
      amp = 5;
      break;
    case 'drought':
      rain = 0;
      tAir = Math.max(tAir + 4, 25 + r1 * 4);
      humidity = 26 + r1 * 8;
      wind = Math.max(wind, 4.5);
      amp = 14;
      break;
    case 'heat':
      rain = 0;
      tAir = Math.max(tAir + 6, 29 + r1 * 3);
      humidity = 30 + r1 * 8;
      amp = 13;
      break;
    case 'frost':
      tAir = Math.min(tAir, 5.5);
      rain = 0;
      humidity = 82;
      wind = 1.2;
      break;
    case 'wind':
      wind = 9.5;
      break;
  }
  let tMin = tAir - amp / 2;
  let tMax = tAir + amp / 2;
  if (mode === 'frost') {
    tMin = -2;
    tMax = Math.max(tMax, 11);
  }
  const warmSeason = d > 60 && d < 240;
  const tSoil = tAir + (mode === 'frost' ? 2.6 : warmSeason ? 1.8 : 0.5) - depth * 0.12 + (rain > 10 ? -1.5 : 0);
  const leafWet = clamp((rain > 0.3 ? 8 + rain * 0.6 : 0) + Math.max(0, humidity - 75) * 0.45 + (tMin < 12 && humidity > 70 ? 3 : 0), 0, 24);
  return {
    day,
    tAir: round(tAir),
    tMin: round(tMin),
    tMax: round(tMax),
    tSoil: round(tAir < -3 ? Math.max(-2, tSoil * 0.3) : tSoil),
    wind: round(wind),
    rain: round(rain),
    snowfall: rain > 0 && tAir < 0.5,
    humidity: round(humidity, 0),
    leafWet: round(leafWet, 0),
    event: mode,
  };
}

/** Сума активних температур >10 °C з 1 січня поточного року до дня `day`. */
export function computeSat(zone: ZoneId, day: number): number {
  let s = 0;
  for (let k = day - doy(day) + 1; k <= day; k++) {
    const t = generateWeather(zone, k, 'normal').tAir;
    if (t > 10) s += t;
  }
  return Math.round(s);
}

/** Погодний ряд за попередні n діб (для агрометеостанції). */
export function weatherHistory(zone: ZoneId, day: number, n = 14): Weather[] {
  const out: Weather[] = [];
  for (let k = day - n + 1; k <= day; k++) out.push(generateWeather(zone, k, 'normal'));
  return out;
}
