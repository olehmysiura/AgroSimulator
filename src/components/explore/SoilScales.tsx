// ============================================================================
// Ґрунт під різним збільшенням: профіль (×1) → моноліт (×3) → лупа (×10) →
// мікроскоп (×40) → електронний мікроскоп (×20 000) → молекулярний рівень (×10⁷).
// Кожна сцена будується зі стану вибраного горизонту (вологість, щільність,
// гумус, pH, температура, склад обмінних катіонів, дихання, кірка, підошва).
// ============================================================================
import { useState, type ReactNode } from 'react';
import { LAYER_DEFS, ZONES } from '../../sim/data';
import { PAN_LIMIT, effRes, respiration } from '../../sim/soil';
import { exchangeComplex, phases, structure, texture } from '../../sim/soilscience';
import type { LayerId, SimState, SoilLayer } from '../../sim/types';
import { clamp, fmt, hashRand } from '../../sim/util';
import { mix } from '../FieldView';

const W = 520;
const H = 340;

interface ScaleDef { id: string; name: string; mag: string; fov: string }
const SCALES: ScaleDef[] = [
  { id: 'profile', name: 'Профіль', mag: '×1', fov: '150 см' },
  { id: 'monolith', name: 'Моноліт', mag: '×3', fov: '12 см' },
  { id: 'lens', name: 'Лупа', mag: '×10', fov: '1,2 см' },
  { id: 'micro', name: 'Мікроскоп', mag: '×40', fov: '3 мм' },
  { id: 'sem', name: 'Електронний мікроскоп', mag: '×20 000', fov: '6 мкм' },
  { id: 'mol', name: 'Молекулярний рівень', mag: '×10⁷', fov: '12 нм' },
];

type P = { s: SimState; l: SoilLayer };

const liveCrop = (s: SimState) => (s.crop && !s.crop.dead && !s.crop.harvested ? s.crop : null);

function baseColor(s: SimState, id: LayerId): string {
  const hz = ZONES[s.zone].horizon.colors;
  return id === 'pan' ? hz[1] : id === 'transition' ? hz[2] : id === 'parent' ? hz[3] : hz[0];
}
/** Вологий ґрунт темніший, сухий — світліший */
function wetColor(s: SimState, l: SoilLayer): string {
  return mix(mix(baseColor(s, l.id), '#d9c9a8', clamp((45 - l.moisture) / 90, 0, 0.3)), '#0b0807', clamp((l.moisture - 45) / 140, 0, 0.42));
}
const vary = (c: string, i: number, k = 0.18) => mix(c, hashRand(i, 'v') > 0.5 ? '#ffffff' : '#000000', hashRand(i, 'vv') * k);

function ScaleBar({ px, label }: { px: number; label: string }) {
  return (
    <g fontFamily="monospace" fontSize={11} pointerEvents="none">
      <rect x={W - px - 24} y={H - 34} width={px + 16} height={26} rx={4} fill="#020617" opacity={0.75} />
      <line x1={W - px - 16} y1={H - 18} x2={W - 16} y2={H - 18} stroke="#f8fafc" strokeWidth={2.5} />
      <line x1={W - px - 16} y1={H - 23} x2={W - px - 16} y2={H - 13} stroke="#f8fafc" strokeWidth={2} />
      <line x1={W - 16} y1={H - 23} x2={W - 16} y2={H - 13} stroke="#f8fafc" strokeWidth={2} />
      <text x={W - 16 - px / 2} y={H - 24} fill="#f8fafc" textAnchor="middle">{label}</text>
    </g>
  );
}

/** Коло окуляра: затемнення навколо поля зору + перехрестя */
function Eyepiece({ r = 168 }: { r?: number }) {
  return (
    <g pointerEvents="none">
      <path d={`M0 0 H${W} V${H} H0 Z M${W / 2} ${H / 2 - r} a${r} ${r} 0 1 0 0.01 0 Z`} fillRule="evenodd" fill="#020617" />
      <circle cx={W / 2} cy={H / 2} r={r} fill="none" stroke="#475569" strokeWidth={3} />
      <g stroke="#ffffff" strokeOpacity={0.18}><line x1={W / 2 - r} y1={H / 2} x2={W / 2 + r} y2={H / 2} /><line x1={W / 2} y1={H / 2 - r} x2={W / 2} y2={H / 2 + r} /></g>
    </g>
  );
}

// --------------------------------------------------------------------------- ×1 профіль
function Profile({ s, l }: P) {
  const segs: [LayerId, number, number, number][] = [['surface', 14, 0, 2], ['seedbed', 26, 2, 8], ['arable', 70, 8, 30], ['pan', 22, 30, 35], ['transition', 76, 35, 80], ['parent', 92, 80, 150]];
  const X = 130, Wd = 250, Y0 = 18;
  const tops: Record<string, number> = {};
  let y = Y0;
  for (const [id, h] of segs) { tops[id] = y; y += h; }
  const yAt = (cm: number) => {
    for (const [id, h, a, b] of segs) if (cm <= b) return tops[id] + ((cm - a) / (b - a)) * h;
    return y;
  };
  const c = liveCrop(s);
  const hz = ZONES[s.zone].horizon;
  const roots = c ? [-90, -45, 0, 45, 90] : [];
  const blocked = c?.rootBlocked && effRes(s.layers[3]) >= PAN_LIMIT;
  const sel = segs.find(([id]) => id === l.id)!;
  return (
    <g>
      <rect width={W} height={H} fill="#0b1220" />
      <rect x={X - 8} y={4} width={Wd + 16} height={Y0 - 2} fill="#16324f" />
      {segs.map(([id, h]) => {
        const ly = s.layers.find((q) => q.id === id)!;
        return (
          <g key={id}>
            <rect x={X} y={tops[id]} width={Wd} height={h} fill={wetColor(s, ly)} />
            {id === 'pan' && effRes(ly) >= PAN_LIMIT && Array.from({ length: 5 }, (_, i) => <line key={i} x1={X + 6} y1={tops[id] + 4 + i * 4} x2={X + Wd - 6} y2={tops[id] + 4 + i * 4} stroke="#00000066" strokeWidth={1.4} />)}
          </g>
        );
      })}
      {s.snow > 0.5 && <rect x={X} y={Y0 - Math.min(10, s.snow * 0.4)} width={Wd} height={Math.min(10, s.snow * 0.4)} fill="#f8fafc" />}
      {s.crust > 0 && <rect x={X} y={Y0} width={Wd} height={3} fill="#9d9080" />}
      {/* гумусові затьоки, ходи черв'яків, карбонати */}
      {s.zone !== 'polissia' && Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${X + 18 + i * 34} ${tops.transition} q 4 ${14 + hashRand(i, 'tg') * 18} 8 0 z`} fill={hz.colors[0]} opacity={0.6} />)}
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${X + 20 + i * 55} ${tops.arable + 6} q 5 40 -3 80 t 3 60`} stroke="#150e09" strokeWidth={2} fill="none" opacity={0.5} />)}
      {Array.from({ length: 24 }, (_, i) => { const dep = 50 + hashRand(i, 'cb') * 100; return dep < hz.carbonatesFrom ? null : <ellipse key={i} cx={X + 8 + hashRand(i, 'cx') * (Wd - 16)} cy={yAt(dep)} rx={3 + hashRand(i, 'cr') * 3} ry={2} fill="#f3eee2" opacity={0.8} />; })}
      {/* коріння */}
      {c && roots.map((dx, i) => {
        const rd = Math.min(c.rootDepth, 150);
        const x0 = X + Wd / 2 + dx * 0.55;
        const yEnd = blocked ? yAt(30) : yAt(rd);
        return blocked
          ? <path key={i} d={`M${x0} ${Y0} L${x0 + dx * 0.1} ${yAt(29)} q ${dx >= 0 ? 10 : -10} 3 ${dx >= 0 ? 34 : -34} 0`} stroke="#f4ecd0" strokeWidth={2} fill="none" />
          : <path key={i} d={`M${x0} ${Y0} Q ${x0 + dx * 0.3} ${(Y0 + yEnd) / 2} ${x0 + dx * 0.15} ${yEnd}`} stroke="#f4ecd0" strokeWidth={1.8} fill="none" />;
      })}
      {/* позначки горизонтів */}
      {segs.map(([id, h, a, b]) => (
        <g key={id} fontSize={10} fontFamily="monospace" fill={id === l.id ? '#6ee7b7' : '#94a3b8'}>
          <text x={X - 12} y={tops[id] + Math.min(h, 14) - 3} textAnchor="end">{a}–{b}</text>
          <line x1={X - 8} y1={tops[id]} x2={X} y2={tops[id]} stroke="#475569" />
        </g>
      ))}
      <rect x={X - 2} y={tops[l.id] - 2} width={Wd + 4} height={sel[1] + 4} fill="none" stroke="#34d399" strokeWidth={2.5} />
      <g fontSize={11} fontFamily="Inter, sans-serif" fill="#e2e8f0">
        <text x={X + Wd + 14} y={tops[l.id] + sel[1] / 2 - 4} fill="#6ee7b7" fontWeight={700}>{LAYER_DEFS.find((d) => d.id === l.id)!.short}</text>
        <text x={X + Wd + 14} y={tops[l.id] + sel[1] / 2 + 10} fill="#cbd5e1">{Math.round(l.moisture)}% НВ · {fmt(effRes(l), 1)} МПа</text>
      </g>
      <text x={X} y={H - 8} fill="#64748b" fontSize={10} fontFamily="monospace">поле зору ≈ 150 см; шкала горизонтів умовна (0–35 см збільшено)</text>
    </g>
  );
}

// --------------------------------------------------------------------------- ×3 моноліт
function Monolith({ s, l }: P) {
  const st = structure(s, l);
  const ph = phases(s, l);
  const c = liveCrop(s);
  const platy = l.id === 'pan' && effRes(l) >= PAN_LIMIT;
  const crust = l.id === 'surface' && s.crust > 0;
  const cs = clamp(86 - st.wsa * 0.78, 24, 78); // розмір відокремлень
  const col = wetColor(s, l);
  const X0 = 60, Y0 = 26, BW = 400, BH = 250;
  const nx = Math.ceil(BW / cs) + 1, ny = Math.ceil(BH / cs) + 1;
  const pt = (i: number, j: number): [number, number] => [X0 + i * cs + (hashRand(i, j, 'jx') - 0.5) * cs * 0.55, Y0 + j * cs + (hashRand(i, j, 'jy') - 0.5) * cs * 0.55];
  const cells: ReactNode[] = [];
  if (platy || crust) {
    const rows = platy ? 15 : 4;
    const rh = BH / rows;
    for (let r = 0; r < rows; r++) {
      let x = X0;
      while (x < X0 + BW) {
        const w = (platy ? 90 : 120) + hashRand(r, x, 'pw') * 90;
        const w2 = Math.min(w, X0 + BW - x);
        cells.push(<rect key={`${r}-${x}`} x={x + 1} y={Y0 + r * rh + 1} width={w2 - 2} height={rh - 2.5} rx={3} fill={vary(crust ? '#9d9080' : col, r * 31 + x)} />);
        x += w;
      }
    }
  } else {
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c2 = pt(i + 1, j + 1), d = pt(i, j + 1);
      const cx = (a[0] + b[0] + c2[0] + d[0]) / 4, cy = (a[1] + b[1] + c2[1] + d[1]) / 4;
      const sh = (p: [number, number]) => `${(cx + (p[0] - cx) * 0.9).toFixed(1)},${(cy + (p[1] - cy) * 0.9).toFixed(1)}`;
      cells.push(<polygon key={`${i}-${j}`} points={[a, b, c2, d].map(sh).join(' ')} fill={vary(col, i * 17 + j)} stroke="#00000030" strokeWidth={0.8} />);
    }
  }
  const rootsHere = c && l.top < c.rootDepth;
  const blockedRoots = rootsHere && l.id === 'pan' && c!.rootBlocked;
  return (
    <g>
      <rect width={W} height={H} fill="#0b1220" />
      <clipPath id="monoClip"><rect x={X0} y={Y0} width={BW} height={BH} rx={6} /></clipPath>
      <g clipPath="url(#monoClip)">
        <rect x={X0} y={Y0} width={BW} height={BH} fill="#0e0907" />
        {cells}
        {l.moisture > 85 && !ph.ice && <rect x={X0} y={Y0} width={BW} height={BH} fill="#38bdf8" opacity={0.12} />}
        {/* розколини */}
        {st.wsa < 45 && !platy && Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${X0 + 50 + i * 100} ${Y0} l 8 60 l -10 70 l 6 80`} stroke="#050302" strokeWidth={3} fill="none" />)}
        {/* корені по тріщинах */}
        {rootsHere && !blockedRoots && [0.2, 0.45, 0.7, 0.86].map((f, i) => <path key={i} d={`M${X0 + BW * f} ${Y0} q ${(i % 2 ? 1 : -1) * 18} 60 ${(i % 2 ? -1 : 1) * 10} 120 t ${(i % 2 ? 1 : -1) * 14} 130`} stroke="#f4ecd0" strokeWidth={2.4 - i * 0.2} fill="none" />)}
        {blockedRoots && [60, 130, 190].map((y, i) => <path key={i} d={`M${X0 + 30 + i * 60} ${Y0 + 8} l 0 ${y * 0.1} q 0 10 14 12 l ${160 - i * 30} 0`} stroke="#f4ecd0" strokeWidth={3.4} fill="none" />)}
        {/* ходи та копроліти черв'яків */}
        {(l.id === 'arable' || l.id === 'transition' || l.id === 'seedbed') && l.humus > 1.2 && l.density < 1.45 && [[120, 90, 15], [300, 170, 12], [390, 70, 10]].map(([x, y, r], i) => <g key={i}><circle cx={X0 + x} cy={Y0 + y} r={r + 4} fill="#3a2a1d" /><circle cx={X0 + x} cy={Y0 + y} r={r} fill="#0e0907" /></g>)}
        {/* рештки */}
        {(l.id === 'surface' || l.id === 'seedbed') && Array.from({ length: Math.round(s.residue / 5) }, (_, i) => <line key={i} x1={X0 + hashRand(i, 'rx') * BW} y1={Y0 + 6 + hashRand(i, 'ry') * 60} x2={X0 + hashRand(i, 'rx') * BW + 34} y2={Y0 + 10 + hashRand(i, 'ry') * 60} stroke="#d8bf72" strokeWidth={3.2} strokeLinecap="round" />)}
        {ph.ice && Array.from({ length: 16 }, (_, i) => <text key={i} x={X0 + hashRand(i, 'ix') * BW} y={Y0 + 20 + hashRand(i, 'iy') * BH} fontSize={18} fill="#ecfeff" opacity={0.8}>✳</text>)}
      </g>
      <rect x={X0} y={Y0} width={BW} height={BH} rx={6} fill="none" stroke="#475569" strokeWidth={2} />
      <text x={X0} y={Y0 + BH + 18} fill="#94a3b8" fontSize={11} fontFamily="monospace">{platy ? 'плитчаста будова: плити блокують корені' : `водостійких агрегатів ${st.wsa}%`}</text>
      <ScaleBar px={60} label="2 см" />
    </g>
  );
}

// --------------------------------------------------------------------------- ×10 лупа
function Lens({ s, l }: P) {
  const ph = phases(s, l);
  const tx = texture(s.zone, l.id);
  const c = liveCrop(s);
  const col = wetColor(s, l);
  const platy = l.id === 'pan' && effRes(l) >= PAN_LIMIT;
  const crowd = clamp((l.density - 0.95) * 1.1, 0.2, 0.75);
  const aggs = platy
    ? [[260, 110, 130, 26], [250, 160, 140, 24], [270, 208, 125, 26], [255, 250, 135, 22]]
    : [[170, 120, 96, 96], [350, 108, 88, 88], [255, 250, 100, 100], [420, 250, 68, 68], [95, 255, 62, 62]];
  const sandy = tx.sand > 50;
  const films = l.moisture > 32;
  const nOrg = Math.round(l.humus * 3);
  const hyphae = l.humus > 2 && l.moisture > 40 && l.moisture < 105 && l.temp > 3;
  return (
    <g>
      <rect width={W} height={H} fill="#d7dee6" />
      {/* пори із водою */}
      {ph.water > 0 && <rect y={H * (1 - clamp(ph.water / Math.max(1, ph.porosity), 0, 1) * 0.6)} width={W} height={H} fill={ph.ice ? '#a5f3fc' : '#7dd3fc'} opacity={0.55} />}
      {aggs.map(([cx, cy, rx, ry], k) => (
        <g key={k}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={mix(col, '#000000', 0.18)} />
          {Array.from({ length: Math.round((rx * ry) / (platy ? 130 : 105) * crowd * 2.2) }, (_, i) => {
            const a = hashRand(k, i, 'ga') * Math.PI * 2, r = Math.sqrt(hashRand(k, i, 'gr'));
            const g = (platy ? 6 : 8) + hashRand(k, i, 'gs') * (platy ? 6 : 10);
            const x = cx + Math.cos(a) * rx * r * 0.92, y = cy + Math.sin(a) * ry * r * 0.92;
            return sandy && i % 3 === 0
              ? <polygon key={i} points={`${x},${y - g} ${x + g},${y - g * 0.2} ${x + g * 0.5},${y + g} ${x - g * 0.8},${y + g * 0.4}`} fill="#e4cf9c" stroke="#00000030" />
              : <circle key={i} cx={x} cy={y} r={g} fill={vary(col, k * 100 + i, 0.22)} stroke={films ? (ph.ice ? '#cffafe' : '#7dd3fc') : '#00000030'} strokeWidth={films ? 1.6 : 0.6} />;
          })}
          {Array.from({ length: Math.round(nOrg / 2) }, (_, i) => {
            const x = cx + (hashRand(k, i, 'ox') - 0.5) * rx, y = cy + (hashRand(k, i, 'oy') - 0.5) * ry;
            return <polygon key={`o${i}`} points={`${x},${y} ${x + 14},${y + 4} ${x + 8},${y + 14}`} fill="#2a1a10" opacity={0.85} />;
          })}
        </g>
      ))}
      {/* міст води в місцях контактів */}
      {films && !ph.ice && Array.from({ length: Math.round(l.moisture * 0.5) }, (_, i) => <circle key={i} cx={30 + hashRand(i, 'bx') * 460} cy={30 + hashRand(i, 'by') * 280} r={3 + hashRand(i, 'br') * 3} fill="#38bdf8" opacity={0.85} />)}
      {ph.ice && Array.from({ length: 14 }, (_, i) => <text key={i} x={hashRand(i, 'ix') * 480} y={40 + hashRand(i, 'iy') * 280} fontSize={22} fill="#ecfeff">✳</text>)}
      {/* гіфи грибів */}
      {hyphae && Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${30 + hashRand(i, 'hx') * 120} ${40 + hashRand(i, 'hy') * 260} q 80 ${(hashRand(i, 'hq') - 0.5) * 120} 160 ${(hashRand(i, 'hz') - 0.5) * 90} t 150 ${(hashRand(i, 'hw') - 0.5) * 90}`} stroke="#f8fafc" strokeWidth={1.4} fill="none" opacity={0.9} />)}
      {/* кінчик кореня з волосками */}
      {c && l.top < c.rootDepth && !(l.id === 'pan' && c.rootBlocked) && (
        <g>
          <path d="M20 40 Q 190 120 300 170" stroke="#f5efd6" strokeWidth={22} strokeLinecap="round" fill="none" />
          {l.moisture > 30 && Array.from({ length: 30 }, (_, i) => { const t = 0.1 + i / 36; const x = 20 + 280 * t, y = 40 + 130 * Math.sin(t * 1.4); return <line key={i} x1={x} y1={y} x2={x + (i % 2 ? 18 : -14)} y2={y + (i % 2 ? -22 : 24)} stroke="#f5efd6" strokeWidth={1.4} />; })}
        </g>
      )}
      <Eyepiece />
      <ScaleBar px={80} label="2 мм" />
    </g>
  );
}

// --------------------------------------------------------------------------- ×40 мікроскоп
function Micro({ s, l }: P) {
  const ph = phases(s, l);
  const tx = texture(s.zone, l.id);
  const sat = Math.min(1, ph.water / Math.max(1, ph.porosity));
  const pack = 0.72 + (l.density - 1.0) * 0.55;
  const platy = l.id === 'pan' && effRes(l) >= PAN_LIMIT;
  const crusted = l.id === 'surface' && s.crust > 0;
  const sandy = tx.sand > 50;
  const col = wetColor(s, l);
  return (
    <g>
      <rect width={W} height={H} fill="#e8edf2" />
      <rect y={H * (1 - sat)} width={W} height={H * sat} fill={ph.ice ? '#a5f3fc' : '#38bdf8'} />
      {Array.from({ length: 96 }, (_, i) => {
        const x = ((i * 61) % 12) * 46 + (Math.floor(i / 12) % 2) * 23 + (hashRand(i, 'mx') - 0.5) * 14;
        const y = Math.floor(i / 12) * 42 + 18 + (hashRand(i, 'my') - 0.5) * 12;
        const r = (sandy ? 16 : 18) * pack * (0.75 + hashRand(i, 'mr') * 0.5);
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={r * (platy || crusted ? 1.5 : 1)} ry={r * (platy || crusted ? 0.55 : 1)} fill={sandy && i % 3 ? '#d9c08a' : col} stroke={l.moisture > 32 ? (ph.ice ? '#cffafe' : '#7dd3fc') : '#00000030'} strokeWidth={l.moisture > 32 ? 2.2 : 0.6} />
            {!sandy && Array.from({ length: 3 }, (_, k) => <circle key={k} cx={x + (hashRand(i, k, 'px') - 0.5) * r} cy={y + (hashRand(i, k, 'py') - 0.5) * r * 0.7} r={1.3} fill="#00000050" />)}
          </g>
        );
      })}
      {ph.ice && Array.from({ length: 14 }, (_, i) => <text key={i} x={(i * 83) % W} y={30 + ((i * 47) % (H - 40))} fontSize={16} fill="#ecfeff">✳</text>)}
      <Eyepiece />
      <ScaleBar px={70} label="0,5 мм" />
    </g>
  );
}

// --------------------------------------------------------------------------- ×20 000 електронний мікроскоп
function Sem({ s, l }: P) {
  const ex = exchangeComplex(s, l);
  const ph = phases(s, l);
  const na = ex.cations.find((c) => c.id === 'Na⁺')!.share;
  const dispersed = na > 3 || l.pH > 8.2; // розпорошений стан — паралельні пластинки
  const clay = texture(s.zone, l.id).clay;
  const plates = Math.round(18 + clay * 1.3);
  const resp = respiration(l);
  const bact = Math.round(clamp(resp / 7, 1, 34) * (ph.air < 10 ? 0.6 : 1));
  const anaerobic = ph.air < 10;
  const org = clamp(l.humus / 5, 0.1, 1);
  return (
    <g>
      <rect width={W} height={H} fill="#1a1a1a" />
      <g filter="url(#gray)">
        {/* глинисті пластинки */}
        {Array.from({ length: plates }, (_, i) => {
          const x = hashRand(i, 'px') * (W - 60) + 30, y = hashRand(i, 'py') * (H - 60) + 30;
          const a = dispersed ? 12 + (hashRand(i, 'pa') - 0.5) * 14 : hashRand(i, 'pa') * 180;
          const len = 70 + hashRand(i, 'pl') * 90;
          const g = 120 + hashRand(i, 'pg') * 90;
          return (
            <g key={i} transform={`rotate(${a} ${x} ${y})`}>
              <rect x={x - len / 2} y={y - 3} width={len} height={6 + hashRand(i, 'pt') * 5} rx={3} fill={`rgb(${g},${g},${g})`} />
              {!dispersed && hashRand(i, 'pd') > 0.5 && <rect x={x - len / 2 + 6} y={y + 4} width={len * 0.8} height={4} rx={2} fill={`rgb(${g - 30},${g - 30},${g - 30})`} />}
            </g>
          );
        })}
        {/* органо-мінеральні оболонки (гумус) */}
        {Array.from({ length: Math.round(org * 14) }, (_, i) => <ellipse key={i} cx={40 + hashRand(i, 'ox') * 440} cy={40 + hashRand(i, 'oy') * 260} rx={26 + hashRand(i, 'or') * 36} ry={14 + hashRand(i, 'orr') * 20} fill="#3a3a3a" opacity={0.78} transform={`rotate(${hashRand(i, 'oa') * 180} ${40 + hashRand(i, 'ox') * 440} ${40 + hashRand(i, 'oy') * 260})`} />)}
        {/* водна плівка */}
        {l.moisture > 35 && !ph.ice && <rect width={W} height={H} fill="#7dd3fc" opacity={0.1} />}
        {ph.ice && Array.from({ length: 24 }, (_, i) => <text key={i} x={hashRand(i, 'ix') * 500} y={20 + hashRand(i, 'iy') * 310} fontSize={18} fill="#ffffff" opacity={0.7}>✳</text>)}
      </g>
      {/* бактерії позначені умовним кольором */}
      {Array.from({ length: bact }, (_, i) => {
        const x = 40 + hashRand(i, 'bx') * 440, y = 40 + hashRand(i, 'by') * 260, a = hashRand(i, 'ba') * 180;
        const rod = hashRand(i, 'bt') > 0.4;
        return (
          <g key={i} transform={`rotate(${a} ${x} ${y})`}>
            {rod ? <rect x={x - 17} y={y - 6} width={34} height={12} rx={6} fill={anaerobic ? '#fb7185' : '#4ade80'} stroke="#052e16" /> : <circle cx={x} cy={y} r={8} fill={anaerobic ? '#fb7185' : '#86efac'} stroke="#052e16" />}
            {rod && <path d={`M${x + 17} ${y} q 12 -8 22 0 t 20 0`} stroke={anaerobic ? '#fb7185' : '#4ade80'} fill="none" strokeWidth={1.2} />}
          </g>
        );
      })}
      {l.humus > 2 && l.moisture > 40 && <path d={`M30 ${H - 70} q 120 -50 240 -10 t 230 -30`} stroke="#fde68a" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.85} />}
      <g fontSize={10.5} fontFamily="Inter, sans-serif">
        <text x={16} y={20} fill="#e5e7eb">{dispersed ? 'Розпорошена структура: пластинки паралельні' : 'Флокульована структура: пластинки склеєні Ca²⁺ і гумусом'}</text>
        <text x={16} y={H - 12} fill="#4ade80">● бактерії{anaerobic ? ' (анаеробні умови!)' : ''}</text>
        <text x={110} y={H - 12} fill="#fde68a">▬ гіфа гриба</text>
        <text x={206} y={H - 12} fill="#9ca3af">▬ мінерали · темні плями — гумус</text>
      </g>
      <ScaleBar px={87} label="1 мкм" />
    </g>
  );
}

// --------------------------------------------------------------------------- ×10⁷ молекулярний рівень
function Molecular({ s, l }: P) {
  const ex = exchangeComplex(s, l);
  const ph = phases(s, l);
  const kaolin = s.zone === 'polissia'; // у підзолистих ґрунтах більше каолініту / гідрослюди
  const ice = ph.ice;
  const total = 14;
  const shares = ex.cations.map((c) => ({ ...c, n: (c.share / 100) * total }));
  const counts = shares.map((c) => Math.floor(c.n));
  let rest = total - counts.reduce((a, b) => a + b, 0);
  [...shares.keys()].sort((a, b) => (shares[b].n % 1) - (shares[a].n % 1)).forEach((i) => { if (rest-- > 0) counts[i]++; });
  const ions: { id: string; color: string; x: number; y: number }[] = [];
  let k = 0;
  shares.forEach((c, i) => { for (let m = 0; m < counts[i]; m++, k++) ions.push({ id: c.id, color: c.color, x: 40 + hashRand(k, 'ix') * 440, y: 96 + (k % 2 ? 30 : 0) + hashRand(k, 'iy') * 14 }); });
  const sheet = (y0: number) => (
    <g>
      {Array.from({ length: 20 }, (_, i) => <circle key={`t${i}`} cx={22 + i * 25} cy={y0} r={8.5} fill="#ef4444" />)}
      {Array.from({ length: 19 }, (_, i) => <circle key={`s${i}`} cx={34.5 + i * 25} cy={y0 + 9} r={3.6} fill="#facc15" />)}
      {Array.from({ length: 20 }, (_, i) => <circle key={`o${i}`} cx={22 + i * 25 + (i % 2 ? 4 : 0)} cy={y0 + 18} r={8.5} fill="#f87171" />)}
      {Array.from({ length: 19 }, (_, i) => <circle key={`a${i}`} cx={34.5 + i * 25} cy={y0 + 18} r={5.6} fill={i % 5 === 3 ? '#a78bfa' : '#60a5fa'} stroke="#0b1220" />)}
      {!kaolin && Array.from({ length: 20 }, (_, i) => <circle key={`b${i}`} cx={22 + i * 25} cy={y0 + 36} r={8.5} fill="#ef4444" />)}
      {Array.from({ length: kaolin ? 20 : 19 }, (_, i) => <circle key={`h${i}`} cx={kaolin ? 22 + i * 25 : 34.5 + i * 25} cy={y0 + (kaolin ? 36 : 45)} r={kaolin ? 5 : 3.6} fill={kaolin ? '#f8fafc' : '#facc15'} />)}
    </g>
  );
  const water = ice ? 0 : clamp(Math.round((l.moisture / 100) * 44), 4, 44);
  const nitrates = clamp(Math.round(l.nitrogen / 2.2), 2, 9);
  const fixP = l.pH < 5.5 ? 5 : l.pH > 7.6 ? 4 : 1;
  const hum = clamp(Math.round(l.humus), 1, 5);
  return (
    <g>
      <rect width={W} height={H} fill="#07101f" />
      <rect y={78} width={W} height={H - 78} fill={ice ? '#164e63' : '#0c2a4a'} opacity={0.55} />
      {sheet(30)}
      {sheet(172)}
      <text x={W - 10} y={20} fill="#fca5a5" fontSize={10} textAnchor="end" fontFamily="Inter, sans-serif">глинистий шар {kaolin ? '1:1 (каолініт / гідрослюда)' : '2:1 (монтморилоніт / гідрослюда)'} — {kaolin ? 'мала' : 'висока'} ємність обміну</text>
      <text x={W - 10} y={168} fill="#cbd5e1" fontSize={10} textAnchor="end" fontFamily="Inter, sans-serif">негативний заряд (ізоморфне заміщення Al³⁺→Mg²⁺, Si⁴⁺→Al³⁺)</text>
      {/* вода: гідратація */}
      {Array.from({ length: water }, (_, i) => {
        const x = 20 + hashRand(i, 'wx') * 480, y = 84 + hashRand(i, 'wy') * 82;
        return ice
          ? null
          : <g key={i} transform={`rotate(${hashRand(i, 'wa') * 360} ${x} ${y})`}><circle cx={x} cy={y} r={3.4} fill="#f43f5e" /><circle cx={x - 3.6} cy={y + 2.4} r={2} fill="#f8fafc" /><circle cx={x + 3.6} cy={y + 2.4} r={2} fill="#f8fafc" /></g>;
      })}
      {ice && Array.from({ length: 36 }, (_, i) => { const x = 28 + (i % 12) * 40, y = 92 + Math.floor(i / 12) * 24; return <g key={i}><circle cx={x} cy={y} r={3.4} fill="#67e8f9" /><line x1={x} y1={y} x2={x + 20} y2={y + 12} stroke="#67e8f9" /><line x1={x} y1={y} x2={x + 20} y2={y - 12} stroke="#67e8f9" /></g>; })}
      {/* обмінні катіони у міжшаровому просторі */}
      {ions.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={c.id === 'K⁺' ? 11 : 9} fill={c.color} stroke="#0b1220" strokeWidth={1.5} />
          <text x={c.x} y={c.y + 3.5} fill="#0b1220" fontSize={8.5} textAnchor="middle" fontWeight={700}>{c.id}</text>
        </g>
      ))}
      {/* розчин: нітрати (не утримуються) та оксид із зв'язаним фосфатом */}
      {Array.from({ length: nitrates }, (_, i) => <g key={i}><circle cx={60 + i * 40} cy={262 + (i % 3) * 14} r={7} fill="#a78bfa" /><text x={60 + i * 40} y={265.5 + (i % 3) * 14} fill="#0b1220" fontSize={7.5} textAnchor="middle" fontWeight={700}>NO₃⁻</text></g>)}
      <g fontSize={10} fontFamily="Inter, sans-serif" fill="#c4b5fd"><text x={60} y={246}>NO₃⁻ у розчині: відштовхується від заряду поверхні — вимивається</text></g>
      <g transform="translate(380 252)">
        <rect width={110} height={40} rx={6} fill="#b45309" opacity={0.85} />
        <text x={55} y={14} textAnchor="middle" fill="#fff7ed" fontSize={9}>оксид Fe / Al</text>
        {Array.from({ length: fixP }, (_, i) => <g key={i}><circle cx={14 + i * 20} cy={28} r={6} fill="#22d3ee" stroke="#083344" /><text x={14 + i * 20} y={31} fill="#083344" fontSize={6.5} textAnchor="middle" fontWeight={700}>P</text></g>)}
      </g>
      <text x={380} y={306} fill="#67e8f9" fontSize={9.5} fontFamily="Inter, sans-serif">{l.pH < 5.5 ? 'кисло: фосфат міцно зв\'язаний (P недоступний)' : l.pH > 7.6 ? 'лужно: Ca-фосфати, P малодоступний' : 'pH ≈ 6–7: P легкодоступний'}</text>
      {/* гумінова молекула */}
      <g transform="translate(14 270)">
        {Array.from({ length: hum }, (_, i) => <polygon key={i} points="0,-9 8,-4.5 8,4.5 0,9 -8,4.5 -8,-4.5" transform={`translate(${14 + i * 17} ${(i % 2) * 9})`} fill="none" stroke="#fbbf24" strokeWidth={2} />)}
        <text x={0} y={40} fill="#fbbf24" fontSize={9} fontFamily="Inter, sans-serif">гумінова кислота: ароматичні кільця + COO⁻</text>
      </g>
      <text x={W / 2} y={H - 4} fill="#64748b" fontSize={9} textAnchor="middle" fontFamily="Inter, sans-serif">O — червоні · Si — жовті · Al/Mg — сині · H₂O — червоний з двома білими</text>
      <ScaleBar px={43} label="1 нм" />
    </g>
  );
}

// --------------------------------------------------------------------------- пояснення
function info(id: string, s: SimState, l: SoilLayer): { see: string; why: string; plant: string; rows: [string, string][] } {
  const ph = phases(s, l);
  const st = structure(s, l);
  const ex = exchangeComplex(s, l);
  const c = liveCrop(s);
  const z = ZONES[s.zone];
  switch (id) {
    case 'profile':
      return {
        see: 'Вертикальний розріз ґрунту з генетичними горизонтами, коренями, ходами черв\'яків, гумусовими затьоками й карбонатами.',
        why: 'Колір, потужність і межі горизонтів визначаються ґрунтоутворенням (гумус, промивання), а підошва — багаторічним обробітком.',
        plant: 'Корені проникають лише крізь горизонти з опором < 3 МПа; підошва зупиняє їх, і вода вглибині стає недосяжною.',
        rows: [['Горизонтів', '6'], ['Карбонати з', z.horizon.carbonatesFrom < 150 ? `${z.horizon.carbonatesFrom} см` : 'відсутні'], ['Опір підошви', `${fmt(effRes(s.layers[3]), 1)} МПа`], ['Глибина коренів', c ? `${Math.round(c.rootDepth)} см` : '—']],
      };
    case 'monolith':
      return {
        see: 'Шматок ґрунту розміром 12 см: відокремлення (агрегати), тріщини, корені, ходи черв\'яків, рештки.',
        why: 'Будову утворюють гумус і Ca²⁺ (склеюють), цикли замерзання/зволоження (кришать) і техніка (ущільнює, злиплює).',
        plant: 'Дрібногрудочкувата структура дає доступ повітрю, воді й кореням; плити та брили змушують корені стелитись по тріщинах.',
        rows: [['Структура', st.kind], ['Водостійкі агрегати', `${st.wsa}%`], ['Щільність', `${fmt(l.density, 2)} г/см³`], ['Кірка', s.crust > 0 && l.id === 'surface' ? `${s.crust} см` : 'немає']],
      };
    case 'lens':
      return {
        see: 'Агрегати 0,25–10 мм із окремих зерен, між ними пори; у порах — повітря, плівки й місточки води, гіфи грибів, органічні уламки, кореневі волоски.',
        why: 'Агрегати склеєні гумусом, Ca²⁺ та грибним міцелієм; вода утримується капілярними силами в контактах між частинками.',
        plant: 'Кореневі волоски проникають у пори 10–30 мкм і поглинають воду з плівок. У сухому ґрунті плівки обриваються — поглинання зупиняється.',
        rows: [['Пористість', `${ph.porosity}%`], ['Гумус', `${fmt(l.humus, 2)}%`], ['Гіфи грибів', l.humus > 2 && l.moisture > 40 ? 'є' : 'мало'], ['Вода', ph.ice ? 'лід' : `${Math.round(l.moisture)}% НВ`]],
      };
    case 'micro':
      return {
        see: 'Окремі мінеральні зерна та мікроагрегати, пори різного розміру, вода по периметру зерен і в дрібних порах, повітря у великих.',
        why: 'Дрібні пори (< 0,2 мкм) тримають воду недоступною, середні (0,2–10 мкм) — доступною, великі (> 30 мкм) — повітря.',
        plant: 'Продуктивна волога — у середніх порах. Ущільнення зменшує саме великі й середні пори: менше повітря та доступної води.',
        rows: [['Пористість загальна', `${ph.porosity}%`], ['Пористість аерації', `${ph.air}%`], ['Вода', `${ph.water}% об'єму`], ['Лід', ph.ice ? 'так' : 'ні']],
      };
    case 'sem':
      return {
        see: 'Глинисті пластинки (< 2 мкм), органо-мінеральні оболонки, бактерії та гіфа гриба. Зображення сіре — так бачить електронний мікроскоп.',
        why: 'Катіони Ca²⁺ й гумус зв\'язують пластинки в стійкі флокули; багато Na⁺ розпорошує їх. Чисельність бактерій залежить від тепла, вологи й кисню.',
        plant: 'Флокульований ґрунт зберігає пори й структуру. Розпорошений запливає кіркою. Бактерії мінералізують гумус і вивільняють азот.',
        rows: [['Мул (< 0,001 мм)', `${texture(s.zone, l.id).clay}%`], ['Na⁺ у комплексі', `${ex.cations.find((x) => x.id === 'Na⁺')!.share}%`], ['Дихання', `${respiration(l)} мг CO₂/кг·добу`], ['Кисень у порах', ph.air < 10 ? 'дефіцит' : 'достатньо']],
      };
    default:
      return {
        see: 'Атоми кристалічної ґратки глинистого мінералу, обмінні катіони в міжшаровому просторі, молекули води, нітрат-іони в розчині, зв\'язаний фосфат, фрагмент гумінової кислоти.',
        why: 'Заміщення Si⁴⁺ та Al³⁺ атомами меншої валентності дає поверхні від\'ємний заряд, що утримує катіони. Аніони (NO₃⁻) не утримуються.',
        plant: 'Корінь обмінює H⁺ на катіони з поверхні (Ca²⁺, K⁺, Mg²⁺) — так рослина живиться. Нітрати вимиваються; у кислому ґрунті фосфат зв\'язується оксидами.',
        rows: [['Ємність обміну', `${fmt(ex.cec)} мг-екв/100 г`], ['Насичення основами', `${ex.v}%`], ['Ca²⁺ / Mg²⁺ / K⁺', `${ex.cations[0].share} / ${ex.cations[1].share} / ${ex.cations[2].share}%`], ['H⁺ + Al³⁺', `${fmt(ex.cations[4].share + ex.cations[5].share, 1)}%`]],
      };
  }
}

// --------------------------------------------------------------------------- компонент
export default function SoilScales({ s, l }: P) {
  const [idx, setIdx] = useState(3);
  const sc = SCALES[idx];
  const t = info(sc.id, s, l);
  const scene = sc.id === 'profile' ? <Profile s={s} l={l} /> : sc.id === 'monolith' ? <Monolith s={s} l={l} /> : sc.id === 'lens' ? <Lens s={s} l={l} /> : sc.id === 'micro' ? <Micro s={s} l={l} /> : sc.id === 'sem' ? <Sem s={s} l={l} /> : <Molecular s={s} l={l} />;
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {SCALES.map((x, i) => (
          <button key={x.id} type="button" onClick={() => setIdx(i)} className={`rounded-md px-2 py-1 text-left text-[10px] leading-tight transition ${i === idx ? 'bg-sky-600/30 text-sky-100 ring-1 ring-sky-500/60' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            <span className="block font-semibold">{x.name}</span>
            <span className="font-mono text-slate-400">{x.mag} · {x.fov}</span>
          </button>
        ))}
      </div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] text-slate-500">−</span>
        <input type="range" min={0} max={SCALES.length - 1} value={idx} onChange={(e) => setIdx(+e.target.value)} className="flex-1" aria-label="Збільшення" />
        <span className="text-[10px] text-slate-500">+</span>
        <span className="w-28 text-right font-mono text-[11px] text-sky-200">{sc.mag} · поле {sc.fov}</span>
      </div>
      <div className="overflow-hidden rounded-md ring-1 ring-slate-700">
        <svg key={sc.id + l.id} viewBox={`0 0 ${W} ${H}`} className="zoom-in block w-full" role="img" aria-label={`Ґрунт, ${sc.name}`}>
          <defs><filter id="gray"><feColorMatrix type="saturate" values="0.04" /></filter></defs>
          {scene}
        </svg>
      </div>
      <div className="mt-2 space-y-1.5 text-[11px] leading-snug">
        <p><b className="text-emerald-300">Що видно: </b><span className="text-slate-300">{t.see}</span></p>
        <p><b className="text-amber-300">Від чого залежить: </b><span className="text-slate-300">{t.why}</span></p>
        <p><b className="text-sky-300">Вплив на рослину: </b><span className="text-slate-300">{t.plant}</span></p>
        <dl className="mt-1">{t.rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2 border-b border-slate-800/70 py-0.5"><dt className="text-slate-400">{k}</dt><dd className="text-right font-mono text-slate-100">{v}</dd></div>)}</dl>
      </div>
    </div>
  );
}
