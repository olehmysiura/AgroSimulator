export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round = (v: number, d = 1) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

/** Детермінований псевдовипадковий генератор: однаковий день + зона = однакова погода. */
export function hashRand(...parts: (number | string)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Календар. `day` — абсолютний номер дня, відлічений від 1 січня START_YEAR (=1).
// Сезон симуляції починається з довільної дати (state.startDay) і триває 2 роки,
// щоб озимі (посів восени → збирання наступного літа) повністю вкладались у шкалу.
// ---------------------------------------------------------------------------
export const START_YEAR = 2026;
export const SEASON_LEN = 730;

/** День року 1..365 */
export const doy = (day: number) => ((((day - 1) % 365) + 365) % 365) + 1;
export const yearOf = (day: number) => START_YEAR + Math.floor((day - 1) / 365);

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function monthDay(day: number): [number, number] {
  let d = doy(day);
  for (let m = 0; m < 12; m++) {
    if (d <= MONTH_DAYS[m]) return [m, d];
    d -= MONTH_DAYS[m];
  }
  return [11, 31];
}

export function formatDay(day: number, withYear = false): string {
  const [m, d] = monthDay(day);
  return `${d} ${MONTHS[m]}${withYear ? ` ${yearOf(day)}` : ''}`;
}

/** Абсолютний день для дати поточного (стартового) року */
export function dayOf(month: number, date: number): number {
  let d = date;
  for (let m = 0; m < month - 1; m++) d += MONTH_DAYS[m];
  return d;
}

export const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
