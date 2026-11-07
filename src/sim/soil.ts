// ============================================================================
// Фізика ґрунту: водний баланс 6 горизонтів, опір пенетрації, азот
// ============================================================================
import { ZONES } from './data';
import type { LayerId, SimState, SoilLayer } from './types';
import { clamp, round } from './util';

export const PAN_LIMIT = 3.0; // МПа — поріг блокування коренів та інфільтрації
export const WP = 30; // % НВ — умовна вологість в'янення для розрахунку продуктивної вологи

export const layer = (s: { layers: SoilLayer[] }, id: LayerId) => s.layers.find((l) => l.id === id)!;
export const thick = (l: SoilLayer) => l.bottom - l.top;

/** Ефективний опір з поправкою на вологість (сухий ґрунт — твердіший). */
export function effRes(l: SoilLayer): number {
  const f = clamp(1 + 0.4 * (0.75 - l.moisture / 100), 0.9, 1.2);
  return round(l.resistance * f, 2);
}

export const panBlocking = (s: { layers: SoilLayer[] }) => effRes(layer(s, 'pan')) >= PAN_LIMIT;

export const availFrac = (m: number) => clamp((m - WP) / 70, 0, 1);

/** Запас продуктивної вологи (мм) у шарі top..bottom. */
export function productiveMoisture(s: SimState, top = 0, bottom = 100): number {
  const z = ZONES[s.zone];
  let mm = 0;
  for (const l of s.layers) {
    const ov = Math.max(0, Math.min(bottom, l.bottom) - Math.max(top, l.top));
    if (ov > 0) mm += ov * z.prodPerCm * availFrac(l.moisture);
  }
  return Math.round(mm);
}

/** Профіль опору для пенетрометра: точка кожні 2.5 см. */
export function penetrometerProfile(s: SimState): { depth: number; mpa: number }[] {
  const out: { depth: number; mpa: number }[] = [];
  for (let d = 0; d <= 150; d += 2.5) {
    const l = s.layers.find((x) => d >= x.top && d < x.bottom) ?? s.layers[5];
    let v = effRes(l);
    if (l.id === 'surface' && s.crust > 0) v = round(1.6 + s.crust * 0.55, 2);
    // плавні переходи між горизонтами
    const next = s.layers[s.layers.indexOf(l) + 1];
    if (next && l.bottom - d <= 2.5 && l.id !== 'surface') v = round((v + effRes(next)) / 2, 2);
    const jitter = Math.sin(d * 1.7 + s.day) * 0.05;
    out.push({ depth: d, mpa: round(Math.max(0.05, v + jitter), 2) });
  }
  return out;
}

/** Перетворення мм води у % НВ для шару. */
const mmToPct = (s: SimState, l: SoilLayer, mm: number) => (mm / (thick(l) * ZONES[s.zone].fcPerCm)) * 100;
const pctToMm = (s: SimState, l: SoilLayer, pct: number) => (pct / 100) * thick(l) * ZONES[s.zone].fcPerCm;

/**
 * Інфільтрація опадів: «каскад відер». Кірка зменшує вбирання (стік),
 * підошва ≥3 МПа пропускає лише ~4 мм/добу — вода застоюється в горизонті A.
 * Повертає мм стоку.
 */
export function infiltrate(s: SimState, rainMm: number): { runoff: number; perched: boolean } {
  let water = rainMm;
  let runoff = 0;
  if (s.crust > 0) {
    runoff += water * 0.45;
    water *= 0.55;
  }
  let perched = false;
  for (let i = 0; i < s.layers.length && water > 0.01; i++) {
    const l = s.layers[i];
    if (l.id === 'pan' && panBlocking(s)) {
      // підошва: обмежена фільтрація, решта затримується над нею
      const pass = Math.min(water, 4);
      const back = water - pass;
      const a = layer(s, 'arable');
      const room = pctToMm(s, a, 125 - a.moisture);
      const keep = Math.min(back, Math.max(0, room));
      a.moisture += mmToPct(s, a, keep);
      runoff += back - keep;
      if (back > 1) perched = true;
      water = pass;
    }
    const room = pctToMm(s, l, 100 - l.moisture);
    const take = Math.min(water, Math.max(0, room));
    l.moisture += mmToPct(s, l, take);
    water -= take;
  }
  runoff += water; // ґлибоке промивання за межі профілю
  return { runoff, perched };
}

/** Повільний дренаж надлишку (>100% НВ) та промивання нітратів. */
export function drain(s: SimState) {
  for (let i = 0; i < s.layers.length - 1; i++) {
    const l = s.layers[i];
    const below = s.layers[i + 1];
    if (l.moisture <= 100) continue;
    if (below.id === 'pan' && panBlocking(s)) {
      l.moisture -= Math.min(l.moisture - 100, mmToPct(s, l, 3));
      continue;
    }
    const excessMm = pctToMm(s, l, l.moisture - 100) * 0.6;
    l.moisture -= mmToPct(s, l, excessMm);
    below.moisture += mmToPct(s, below, excessMm);
    // нітрати вимиваються з гравітаційною водою
    const leach = Math.min(l.nitrogen * 0.12, excessMm * 0.15);
    l.nitrogen -= leach;
    below.nitrate += leach * (thick(l) / thick(below));
  }
}

/** Випаровування з поверхні ґрунту (мульча зменшує). */
export function evaporate(s: SimState, et0: number, canopy: number) {
  const surf = layer(s, 'surface');
  // 2-га стадія випаровування: пересохлий поверхневий шар сам стає мульчею
  const dryness = clamp((surf.moisture - 10) / 60, 0.15, 1);
  const ev = et0 * (1 - canopy) * (1 - s.residue / 140) * dryness;
  const sb = layer(s, 'seedbed');
  const shares: [LayerId, number][] = sb.moisture > 45 ? [['surface', 0.45], ['seedbed', 0.35], ['arable', 0.2]] : [['surface', 0.6], ['seedbed', 0.4]];
  for (const [id, sh] of shares) {
    const l = layer(s, id);
    l.moisture = Math.max(id === 'surface' ? 6 : 14, l.moisture - mmToPct(s, l, ev * sh));
  }
  // капілярне підтягування з A в посівне ложе
  const a = layer(s, 'arable');
  if (a.moisture > sb.moisture + 8) {
    const mm = 0.4;
    a.moisture -= mmToPct(s, a, mm);
    sb.moisture += mmToPct(s, sb, mm);
  }
}

/** Транспірація: вода забирається з шарів у межах кореневої зони. Повертає водозабезпечення 0..1. */
export function transpire(s: SimState, et0: number, canopy: number, rootDepth: number): number {
  let wSum = 0;
  let aSum = 0;
  const zone: { l: SoilLayer; ov: number }[] = [];
  for (const l of s.layers) {
    const ov = Math.max(0, Math.min(rootDepth, l.bottom) - l.top);
    if (ov <= 0) continue;
    // глибші шари мають меншу щільність коренів
    const w = ov * (l.top < 30 ? 1 : l.top < 80 ? 0.75 : 0.5);
    zone.push({ l, ov: w });
    wSum += w;
    aSum += w * availFrac(l.moisture);
  }
  if (wSum === 0) return 1;
  const supply = aSum / wSum;
  const demand = et0 * canopy * clamp(supply * 1.6, 0, 1);
  for (const { l, ov } of zone) {
    const share = (ov * availFrac(l.moisture)) / Math.max(0.0001, aSum);
    l.moisture = Math.max(10, l.moisture - mmToPct(s, l, demand * share));
  }
  return supply;
}

/** Мінералізація гумусу та промивання. */
export function nitrogenCycle(s: SimState, tSoil: number) {
  const a = layer(s, 'arable');
  const sb = layer(s, 'seedbed');
  if (tSoil > 5 && a.moisture > 40 && a.moisture < 105) {
    const min = 0.018 * a.humus * clamp((tSoil - 5) / 20, 0, 1);
    a.nitrogen += min;
    sb.nitrogen += min * 0.8;
  }
  // нітрати з B повільно стікають у C
  const b = layer(s, 'transition');
  const c = layer(s, 'parent');
  if (b.moisture > 95) {
    const m = b.nitrate * 0.02;
    b.nitrate -= m;
    c.nitrate += m * 0.6;
  }
}

export function updateSoilTemps(s: SimState, tAir: number) {
  const lag = [0.55, 0.35, 0.18, 0.08, 0.04, 0.015];
  const deepMean = 9.5;
  s.layers.forEach((l, i) => {
    const target = i >= 4 ? (tAir + deepMean * 2) / 3 : tAir;
    l.temp = round(l.temp + (target - l.temp) * lag[i], 1);
  });
}
