// ============================================================================
// Метеостанція: детермінований кліматичний генератор + режими-збурення
// ============================================================================
import { ZONES } from './data';
import type { ClimateMode, Weather, ZoneId } from './types';
import { clamp, hashRand, round } from './util';

export function climTemp(zone: ZoneId, day: number): number {
  const z = ZONES[zone];
  return z.tMean - z.tAmp * Math.cos((2 * Math.PI * (day - 18)) / 365);
}

/** Генерує погоду дня. `mode` — режим кліматичного перемикача. */
export function generateWeather(zone: ZoneId, day: number, mode: ClimateMode, depth = 5): Weather {
  const z = ZONES[zone];
  const r1 = hashRand(zone, day, 't');
  const r2 = hashRand(zone, day, 'r');
  const r3 = hashRand(zone, day, 'a');
  const r4 = hashRand(zone, day, 'w');
  let tAir = climTemp(zone, day) + (r1 - 0.5) * 7;
  let rain = r2 < z.rainProb ? -Math.log(1 - r3 * 0.98) * z.rainMean : 0;
  let wind = clamp(z.windMean + (r4 - 0.5) * 3.2, 0.4, 8);
  let humidity = clamp(z.humidity + (rain > 0 ? 14 : -4) + (r1 - 0.5) * 14 - Math.max(0, tAir - 22) * 1.2, 22, 98);
  let amp = rain > 0 ? 6 : 11;

  switch (mode) {
    case 'storm':
      rain = 38 + r3 * 8;
      humidity = 96;
      wind = Math.max(wind, 6.5);
      tAir = Math.max(tAir - 3, tAir * 0.85);
      amp = 5;
      break;
    case 'drought':
      rain = 0;
      tAir = Math.max(tAir + 5.5, 27 + r1 * 5);
      humidity = 24 + r1 * 8;
      wind = Math.max(wind, 4.5);
      amp = 14;
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
  // температура ґрунту на глибині посіву: згладжена, з урахуванням глибини
  const tSoil = tAir + (mode === 'frost' ? 2.6 : day > 60 && day < 240 ? 1.8 : 0.5) - depth * 0.12 + (rain > 10 ? -1.5 : 0);
  return {
    tAir: round(tAir),
    tMin: round(tMin),
    tMax: round(tMax),
    tSoil: round(tSoil),
    wind: round(wind),
    rain: round(rain),
    humidity: round(humidity, 0),
    event: mode,
  };
}

/** Сума активних температур >10 °C з 1 січня до дня `day` (для кліматичної норми). */
export function computeSat(zone: ZoneId, day: number): number {
  let s = 0;
  for (let d = 1; d <= day; d++) {
    const t = generateWeather(zone, d, 'normal').tAir;
    if (t > 10) s += t;
  }
  return Math.round(s);
}
