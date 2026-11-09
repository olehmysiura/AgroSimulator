// ============================================================================
// Центральне ядро: Split-View розріз поля (надземна частина + ґрунт 0–150 см)
// ============================================================================
import { useState, type ReactElement } from 'react';
import { CROPS, LAYER_DEFS, ZONES, gddForBbch } from '../sim/data';
import { PAN_LIMIT, effRes, layer, panBlocking, productiveMoisture } from '../sim/soil';
import type { Crop, LayerId, SimState } from '../sim/types';
import { clamp, doy, fmt, hashRand } from '../sim/util';

const W = 1000;
const H = 600;
export const G = 205; // лінія поверхні ґрунту
const PX_CM_ABOVE = 0.78;

/** Глибина (см) → y. Шар 0–35 см збільшено ×5.4 відносно глибших горизонтів (шкала на лінійці точна). */
export const depthY = (cm: number) => (cm <= 35 ? G + cm * 7 : G + 245 + (cm - 35) * (150 / 115));

const PLANT_X = [70, 180, 290, 400, 510, 620, 730];
const PROF_X = 762; // колонка «Профіль» (міні-діаграми вологості та опору)

export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const k = clamp(t, 0, 1);
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

/** Відносна висота рослини: фаза × накопичений відносний ріст (вігор) × ретардант */
export function plantHeightFrac(c: Crop) {
  return heightFrac(c) * (0.5 + 0.5 * clamp(c.vigor ?? 1, 0.2, 1)) * (c.retardant ? 0.86 : 1);
}
export const plantHeightPx = (c: Crop) => Math.max(8, CROPS[c.id].maxHeight * PX_CM_ABOVE * plantHeightFrac(c));

function heightFrac(c: Crop) {
  const b = c.bbch;
  if (b < 10) return 0;
  if (b < 20) return 0.03 + (b - 10) * 0.012;
  if (b < 30) return 0.15 + (b - 20) * 0.012;
  if (b < 40) return 0.3 + (b - 30) * 0.05;
  if (b < 60) return 0.78 + (b - 40) * 0.011;
  return 1;
}

/** Дугоподібна листкова пластинка (кінчик злегка звисає). */
function leafPath(len: number, wid: number) {
  const arch = len * 0.22;
  return `M0 0 Q ${len * 0.5} ${-arch - wid} ${len} ${len * 0.12} Q ${len * 0.5} ${-arch + wid * 0.6} 0 ${wid * 0.3} Z`;
}

interface PlantLook {
  leaf: string;
  frostLeaf: string;
  droop: number;
  dead: boolean;
}

function lookOf(c: Crop): PlantLook {
  let leaf = mix(CROPS[c.id].color, '#d4c85a', (1 - Math.min(1, c.nStatus)) * 1.4);
  // симптоми живлення: надлишок N — темна синювата зелень, дефіцит P — антоціан (фіолетовий), K — крайовий опік
  const f = c.factors ?? {};
  if (c.nStatus > 1.2) leaf = mix(leaf, '#1f5f3a', 0.35);
  if ((f.phosphorus ?? 1) < 0.9 && c.bbch < 20) leaf = mix(leaf, '#7a3f78', clamp((0.92 - f.phosphorus) * 4, 0, 0.55));
  if ((f.potassium ?? 1) < 0.9) leaf = mix(leaf, '#a8843a', clamp((0.92 - f.potassium) * 2.2, 0, 0.35));
  if ((f.micro ?? 1) < 0.9) leaf = mix(leaf, '#d9e2a0', clamp((0.92 - f.micro) * 2, 0, 0.3));
  if (c.wilting) leaf = mix(leaf, '#7c8a3a', 0.45);
  if (c.bbch >= 80) leaf = mix(leaf, '#c9a646', clamp((c.bbch - 78) / 10, 0, 1));
  if (c.dead) leaf = '#7a5a3a';
  return { leaf, frostLeaf: '#232823', droop: c.wilting ? 38 : c.dead ? 60 : 0, dead: c.dead };
}

// --------------------------------------------------------------------------- рослини
export function Plant({ c, x, i }: { c: Crop; x: number; i: number }) {
  const def = CROPS[c.id];
  const L = lookOf(c);
  const hf = plantHeightFrac(c);
  const h = Math.max(8, def.maxHeight * PX_CM_ABOVE * hf);
  const top = G - h;
  const els: ReactElement[] = [];
  const nLeaves = c.bbch < 20 ? Math.max(1, c.bbch - 9) : c.bbch < 40 ? 8 + Math.floor((c.bbch - 30) / 2) : 12;
  const frostN = Math.round(nLeaves * c.leafFrost);
  const leafCol = (k: number) => (k < frostN ? L.frostLeaf : L.leaf);
  const spots = (k: number, len: number) => {
    if (c.disease < 4 || k > Math.max(2, nLeaves * 0.6)) return null;
    const n = Math.min(6, Math.round(c.disease / 9));
    return Array.from({ length: n }, (_, j) => <ellipse key={j} cx={len * (0.25 + j * 0.11)} cy={-len * 0.1 + (j % 2 ? -0.6 : 0.6)} rx={1.4} ry={0.8} fill="#7a4a1c" />);
  };
  const pests = () =>
    c.pests > 2
      ? Array.from({ length: Math.min(9, Math.round(c.pests / 2)) }, (_, j) => (
          <g key={`p${j}`} transform={`translate(${x + (hashRand(i, j, 'px') - 0.5) * 30} ${top + h * (0.15 + hashRand(i, j, 'py') * 0.6)})`}>
            <ellipse rx={2.2} ry={1.5} fill="#1b1b1b" />
            <path d="M-2 -1 L-3.5 -2.5 M2 -1 L3.5 -2.5 M-2 1 L-3.5 2.5 M2 1 L3.5 2.5" stroke="#1b1b1b" strokeWidth={0.5} />
          </g>
        ))
      : null;

  if (c.id === 'corn') {
    els.push(<line key="st" x1={x} y1={G} x2={x} y2={top} stroke={mix(L.leaf, '#2c5f2e', 0.3)} strokeWidth={c.bbch > 30 ? 5 : 3} strokeLinecap="round" />);
    for (let k = 0; k < Math.min(nLeaves, 13); k++) {
      const y = G - (h * (k + 1)) / (Math.min(nLeaves, 13) + 1.5);
      const side = k % 2 ? 1 : -1;
      const len = clamp(16 + h * 0.3, 14, 62);
      const ang = side > 0 ? -25 + L.droop + k * 1.5 : -155 - L.droop - k * 1.5;
      els.push(
        <g key={`l${k}`} transform={`translate(${x} ${y}) rotate(${ang})`}>
          <path d={leafPath(len, 5)} fill={leafCol(k)} />
          {spots(k, len)}
        </g>,
      );
    }
    if (c.bbch >= 55) els.push(<g key="tas" stroke="#d8c46a" strokeWidth={1.4}>{[-14, -7, 0, 7, 14].map((d) => <line key={d} x1={x} y1={top} x2={x + d} y2={top - 16 + Math.abs(d) * 0.4} />)}</g>);
    if (c.bbch >= 63) {
      const cy = G - h * 0.48;
      els.push(<ellipse key="cob" cx={x + 8} cy={cy} rx={6} ry={16} fill={c.bbch >= 79 ? '#e0b64a' : '#a7c46a'} stroke="#6b7d3a" transform={`rotate(14 ${x + 8} ${cy})`} />);
      if (c.bbch < 75) els.push(<path key="silk" d={`M${x + 12} ${cy - 14} q 6 -8 3 -14`} stroke="#c98b5a" fill="none" strokeWidth={1.4} />);
    }
  } else if (c.id === 'wheat') {
    const tillers = c.bbch >= 21 ? (c.stand > 115 ? 5 : 4) : c.bbch >= 13 ? 2 : 1;
    for (let t = 0; t < tillers; t++) {
      const dx = (t - (tillers - 1) / 2) * 7;
      const tx = x + dx * 1.8;
      const ty = top + Math.abs(dx) * 1.2;
      els.push(<line key={`t${t}`} x1={x + dx * 0.3} y1={G} x2={tx} y2={ty} stroke={L.leaf} strokeWidth={1.6} />);
      for (let k = 0; k < Math.min(4, nLeaves); k++) {
        const y = G - ((G - ty) * (k + 1)) / 5;
        const side = (k + t) % 2 ? 1 : -1;
        els.push(
          <g key={`wl${t}${k}`} transform={`translate(${x + dx * (0.3 + k * 0.3)} ${y}) rotate(${side > 0 ? -30 + L.droop : -150 - L.droop})`}>
            <path d={leafPath(24, 2.2)} fill={leafCol(k)} />
            {spots(k, 24)}
          </g>,
        );
      }
      if (c.bbch >= 51) {
        const col = c.bbch >= 75 ? '#d9b24c' : '#9bbd5c';
        els.push(
          <g key={`ear${t}`} transform={`translate(${tx} ${ty})`}>
            <ellipse cx={0} cy={-9} rx={3} ry={10} fill={col} />
            {[-6, -2, 2, 6].map((a) => <line key={a} x1={0} y1={-14 + Math.abs(a)} x2={a * 1.4} y2={-26 + Math.abs(a)} stroke={col} strokeWidth={0.6} />)}
          </g>,
        );
      }
    }
  } else if (c.id === 'sunflower') {
    els.push(<line key="st" x1={x} y1={G} x2={x} y2={top} stroke={mix(L.leaf, '#3a6b2a', 0.3)} strokeWidth={c.bbch > 30 ? 5 : 2.5} />);
    if (c.bbch < 12) {
      els.push(<ellipse key="c1" cx={x - 7} cy={top} rx={7} ry={3.5} fill={leafCol(0)} />, <ellipse key="c2" cx={x + 7} cy={top} rx={7} ry={3.5} fill={leafCol(1)} />);
    }
    for (let k = 0; k < Math.min(nLeaves, 12); k++) {
      const y = G - (h * (k + 1)) / (Math.min(nLeaves, 12) + 1.3);
      const side = k % 2 ? 1 : -1;
      const sz = clamp(8 + h * 0.12, 7, 26);
      els.push(
        <g key={`l${k}`} transform={`translate(${x} ${y}) rotate(${side > 0 ? 10 + L.droop : 170 - L.droop})`}>
          <line x1={0} y1={0} x2={sz * 0.5} y2={0} stroke={L.leaf} strokeWidth={1.2} />
          <ellipse cx={sz * 1.1} cy={0} rx={sz * 0.7} ry={sz * 0.5} fill={leafCol(k)} />
          {spots(k, sz * 1.4)}
        </g>,
      );
    }
    if (c.bbch >= 51 && c.bbch < 61) els.push(<circle key="bud" cx={x} cy={top - 6} r={8} fill="#5f9b3c" stroke="#3d6b27" />);
    if (c.bbch >= 61 && c.bbch < 70) {
      els.push(
        <g key="head" transform={`translate(${x} ${top - 12})`}>
          {Array.from({ length: 16 }, (_, k) => <ellipse key={k} cx={0} cy={-16} rx={3.5} ry={8} fill="#f5c518" transform={`rotate(${k * 22.5})`} />)}
          <circle r={12} fill="#6b4423" />
        </g>,
      );
    }
    if (c.bbch >= 70) els.push(<ellipse key="hd" cx={x + 10} cy={top + 4} rx={8} ry={16} fill="#5a3a1e" stroke="#c9a646" strokeWidth={2} />);
  } else if (c.id === 'soy') {
    els.push(<line key="st" x1={x} y1={G} x2={x} y2={top} stroke={L.leaf} strokeWidth={2} />);
    if (c.bbch < 12) els.push(<ellipse key="c1" cx={x - 5} cy={top} rx={5} ry={3} fill={leafCol(0)} />, <ellipse key="c2" cx={x + 5} cy={top} rx={5} ry={3} fill={leafCol(1)} />);
    for (let k = 0; k < Math.min(nLeaves, 9); k++) {
      const y = G - (h * (k + 1)) / (Math.min(nLeaves, 9) + 1);
      const side = k % 2 ? 1 : -1;
      const px = x + side * 10;
      els.push(
        <g key={`tri${k}`}>
          <line x1={x} y1={y} x2={px} y2={y - 4 + L.droop * 0.2} stroke={L.leaf} strokeWidth={0.9} />
          {[-1, 0, 1].map((j) => <ellipse key={j} cx={px + side * 4 + j * 5} cy={y - 6 + Math.abs(j) * 3 + L.droop * 0.25} rx={4} ry={2.8} fill={leafCol(k)} />)}
        </g>,
      );
      if (c.bbch >= 60 && c.bbch < 70 && k % 2 === 0) els.push(<circle key={`f${k}`} cx={x + 2} cy={y} r={1.8} fill="#a571c9" />);
      if (c.bbch >= 70 && k < 7) els.push(<rect key={`pod${k}`} x={x - side * 2 - 2} y={y - 2} width={4} height={10} rx={2} fill={c.bbch >= 85 ? '#a88a52' : '#7fae4a'} />);
    }
  } else if (c.id === 'rapeseed') {
    const ros = Math.min(nLeaves, 8);
    for (let k = 0; k < ros; k++) {
      const ang = -170 + (k * 160) / Math.max(1, ros - 1);
      els.push(<g key={`r${k}`} transform={`translate(${x} ${G - 2}) rotate(${ang + (ang > -90 ? L.droop : -L.droop) * 0.3})`}><path d={leafPath(clamp(10 + c.bbch * 0.9, 10, 30), 7)} fill={leafCol(k)} />{spots(k, 20)}</g>);
    }
    if (c.bbch >= 30) {
      const sh = def.maxHeight * PX_CM_ABOVE * hf;
      els.push(<line key="st" x1={x} y1={G} x2={x} y2={G - sh} stroke={L.leaf} strokeWidth={2.2} />);
      [-1, 1].forEach((sd) => els.push(<line key={`b${sd}`} x1={x} y1={G - sh * 0.55} x2={x + sd * 18} y2={G - sh * 0.85} stroke={L.leaf} strokeWidth={1.4} />));
      const tops = [[x, G - sh], [x - 18, G - sh * 0.85], [x + 18, G - sh * 0.85]];
      tops.forEach(([tx, ty], k) => {
        if (c.bbch >= 51 && c.bbch < 70)
          els.push(<g key={`fl${k}`}>{Array.from({ length: 7 }, (_, j) => <circle key={j} cx={tx + (hashRand(i, k, j) - 0.5) * 12} cy={ty - j * 2.2} r={2.4} fill={c.bbch >= 60 ? '#f3d321' : '#94b852'} />)}</g>);
        if (c.bbch >= 70) els.push(<g key={`sq${k}`} stroke={c.bbch >= 85 ? '#a88a52' : '#79a642'} strokeWidth={1.4}>{Array.from({ length: 6 }, (_, j) => <line key={j} x1={tx} y1={ty + j * 4} x2={tx + (j % 2 ? 9 : -9)} y2={ty + j * 4 - 6} />)}</g>);
      });
    }
  } else if (c.id === 'sugarbeet') {
    const n = Math.min(nLeaves, 12);
    const len = clamp(8 + h * 0.9, 8, 48);
    for (let k = 0; k < n; k++) {
      const ang = -160 + (k * 140) / Math.max(1, n - 1);
      els.push(
        <g key={`b${k}`} transform={`translate(${x} ${G - 3}) rotate(${ang + (ang > -90 ? L.droop : -L.droop) * 0.5})`}>
          <line x1={0} y1={0} x2={len * 0.4} y2={0} stroke="#b9455f" strokeWidth={1.2} />
          <ellipse cx={len * 0.75} cy={0} rx={len * 0.38} ry={len * 0.18} fill={leafCol(k)} />
          {spots(k, len)}
        </g>,
      );
    }
    if (c.bbch >= 31) els.push(<ellipse key="sh" cx={x} cy={G - 1} rx={clamp(c.bbch * 0.2, 5, 11)} ry={4} fill="#efe6d0" />);
  }
  return (
    <g style={{ transformOrigin: `${x}px ${G}px`, transform: c.lodged ? `rotate(${62 + (i % 3) * 8}deg)` : undefined, animation: L.dead || c.lodged ? undefined : `sway ${3 + (i % 3)}s ease-in-out infinite` }}>
      {els}
      {pests()}
      {c.leafFrost > 0.2 && <g fill="#e8f4ff" opacity={0.75}>{Array.from({ length: 5 }, (_, j) => <circle key={j} cx={x + (hashRand(i, j, 'fr') - 0.5) * 40} cy={G - h * hashRand(i, j, 'fy')} r={1.2} />)}</g>}
    </g>
  );
}

// --------------------------------------------------------------------------- коріння
export function Roots({ c, x, i, blocked }: { c: Crop; x: number; i: number; blocked: boolean }) {
  const yTop = depthY(Math.min(2.5, c.depth));
  const rd = Math.max(c.depth + 1, c.rootDepth);
  const yEnd = depthY(rd);
  const yPan = depthY(30);
  const col = c.dead ? '#5a4632' : '#efe3c2';
  const els: ReactElement[] = [];
  const fibrous = c.id === 'corn' || c.id === 'wheat';

  if (c.id === 'sugarbeet') {
    const bodyD = Math.min(rd, c.bbch >= 31 ? 24 : 6 + c.bbch * 0.3);
    const yb = depthY(bodyD);
    const wTop = c.bbch >= 31 ? clamp(c.bbch * 0.22, 5, 11) : 2.5;
    els.push(<path key="body" d={`M${x - wTop} ${G} Q ${x - wTop} ${(G + yb) / 2} ${x} ${yb} Q ${x + wTop} ${(G + yb) / 2} ${x + wTop} ${G} Z`} fill="#f1e8d2" stroke="#cbb88f" />);
    if (blocked && c.rootBlocked) {
      // «хвостатість» — роздвоєння коренеплоду на підошві
      els.push(<path key="f1" d={`M${x} ${yb} Q ${x - 6} ${yPan - 6} ${x - 22} ${yPan - 1} L ${x - 44} ${yPan}`} stroke="#e9dcc0" strokeWidth={2.2} fill="none" />);
      els.push(<path key="f2" d={`M${x} ${yb} Q ${x + 6} ${yPan - 6} ${x + 22} ${yPan - 1} L ${x + 44} ${yPan}`} stroke="#e9dcc0" strokeWidth={2.2} fill="none" />);
    } else els.push(<line key="tail" x1={x} y1={yb} x2={x} y2={yEnd} stroke={col} strokeWidth={1.4} />);
  } else if (fibrous) {
    const n = c.emerged ? 6 : 2;
    for (let k = 0; k < n; k++) {
      const spread = (k - (n - 1) / 2) * (c.emerged ? 11 : 4);
      const jitter = (hashRand(i, k, 'rj') - 0.5) * 8;
      if (blocked && c.rootBlocked && rd >= 29.5) {
        const dir = spread >= 0 ? 1 : -1;
        els.push(<path key={k} d={`M${x} ${yTop} Q ${x + spread * 0.6} ${(yTop + yPan) / 2} ${x + spread} ${yPan - 2} Q ${x + spread + dir * 3} ${yPan + 1} ${x + spread + dir * 12} ${yPan} L ${x + spread + dir * (44 + jitter)} ${yPan - 1}`} stroke={col} strokeWidth={1.5} fill="none" />);
      } else {
        const ye = yEnd - Math.abs(spread) * 1.5;
        els.push(<path key={k} d={`M${x} ${yTop} Q ${x + spread * 1.4 + jitter} ${(yTop + ye) / 2} ${x + spread * 0.8} ${ye}`} stroke={col} strokeWidth={1.3} fill="none" />);
      }
    }
  } else {
    // стрижнева коренева система
    if (blocked && c.rootBlocked && rd >= 29.5) {
      const dir = i % 2 ? 1 : -1;
      els.push(<path key="tap" d={`M${x} ${yTop} L ${x} ${yPan - 4} Q ${x} ${yPan} ${x + dir * 8} ${yPan} L ${x + dir * 42} ${yPan - 1}`} stroke={col} strokeWidth={2.4} fill="none" />);
    } else els.push(<line key="tap" x1={x} y1={yTop} x2={x + (hashRand(i, 'tp') - 0.5) * 6} y2={yEnd} stroke={col} strokeWidth={2.2} />);
    const nl = c.emerged ? Math.min(6, Math.floor(rd / 10)) : 0;
    for (let k = 0; k < nl; k++) {
      const d = 4 + k * Math.min(rd, blocked && c.rootBlocked ? 29 : rd) / (nl + 1);
      const yy = depthY(d);
      const sd = k % 2 ? 1 : -1;
      els.push(<path key={`lat${k}`} d={`M${x} ${yy} q ${sd * 10} 4 ${sd * (16 + hashRand(i, k) * 10)} 12`} stroke={col} strokeWidth={0.9} fill="none" />);
    }
    if (c.id === 'soy' && c.nodules > 3) {
      for (let k = 0; k < Math.min(8, Math.round(c.nodules / 3)); k++) {
        els.push(<circle key={`n${k}`} cx={x + (hashRand(i, k, 'nx') - 0.5) * 26} cy={depthY(4 + hashRand(i, k, 'ny') * 18)} r={2.6} fill="#e78aa8" stroke="#a84d6c" strokeWidth={0.6} />);
      }
    }
  }
  return <g>{els}</g>;
}

// --------------------------------------------------------------------------- проростання під землею
export function Germinating({ c, x, i, crust }: { c: Crop; x: number; i: number; crust: number }) {
  const y = depthY(c.depth);
  const gE = gddForBbch(c.id, 10);
  const prog = clamp(c.gdd / gE, 0, 1);
  const alive = !c.dead && hashRand(i, 'germ') * 100 < c.germPotential + 4;
  const els: ReactElement[] = [];
  els.push(<ellipse key="seed" cx={x} cy={y} rx={c.id === 'rapeseed' ? 2.2 : 4.5} ry={c.id === 'rapeseed' ? 2.2 : 3} fill={alive ? '#e3c477' : '#4a3a28'} stroke="#7a5f2a" strokeWidth={0.6} />);
  if (!alive || c.bbch < 5) return <g>{els}</g>;
  els.push(<line key="rad" x1={x} y1={y + 2} x2={x} y2={y + 4 + prog * 26} stroke="#f2e8cc" strokeWidth={1.2} />);
  if (c.bbch >= 7) {
    const surfY = depthY(crust > 0 ? crust : 0);
    if (c.corkscrew && crust > 0) {
      // «штопор»: проросток деформується під кіркою
      const yC = surfY + 3;
      const d = `M${x} ${y - 2} L ${x} ${yC + 12} c 13 -1 13 -12 1 -11 c -13 1 -12 12 1 11 c 12 -1 13 -11 3 -11 c -9 0 -11 7 -4 8`;
      els.push(<path key="cork" d={d} stroke="#e4f29a" strokeWidth={2.2} fill="none" strokeLinecap="round" />);
      els.push(<ellipse key="cot" cx={x + 2} cy={yC + 1.5} rx={4} ry={1.6} fill="#f1f5c0" />);
    } else {
      const yT = y - (y - surfY) * prog;
      els.push(<line key="cole" x1={x} y1={y - 2} x2={x} y2={yT} stroke="#d7e8a0" strokeWidth={1.8} />);
    }
  }
  return <g>{els}</g>;
}

// --------------------------------------------------------------------------- техніка
function Machine({ s }: { s: SimState }) {
  const a = s.anim;
  if (!a) return null;
  const imp: Record<string, ReactElement> = {
    plough: <g>{[0, 1, 2].map((k) => <path key={k} d={`M${-70 - k * 22} -6 l 10 22 l 12 0`} stroke="#c0c6cc" strokeWidth={3} fill="none" />)}<line x1={-30} y1={-8} x2={-120} y2={-8} stroke="#7d8790" strokeWidth={4} /></g>,
    chisel: <g><line x1={-30} y1={-8} x2={-110} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2].map((k) => <path key={k} d={`M${-55 - k * 24} -8 l 0 ${depthY(41) - G + 8} l 8 -4`} stroke="#c0c6cc" strokeWidth={3} fill="none" />)}</g>,
    disc: <g><line x1={-30} y1={-10} x2={-120} y2={-10} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2, 3].map((k) => <ellipse key={k} cx={-50 - k * 20} cy={8} rx={4} ry={12} fill="#9aa4ad" stroke="#5d666e" />)}</g>,
    cultivate: <g><line x1={-30} y1={-8} x2={-115} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2, 3].map((k) => <path key={k} d={`M${-45 - k * 20} -8 q 0 20 8 ${depthY(5.5) - G + 6}`} stroke="#c0c6cc" strokeWidth={2.4} fill="none" />)}</g>,
    rotaryHoe: <g><line x1={-30} y1={-8} x2={-110} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2].map((k) => <g key={k} transform={`translate(${-55 - k * 24} 4)`}>{Array.from({ length: 8 }, (_, j) => <line key={j} x1={0} y1={0} x2={0} y2={12} stroke="#c0c6cc" strokeWidth={1.4} transform={`rotate(${j * 45})`} />)}</g>)}</g>,
    roll: <g><line x1={-30} y1={-8} x2={-60} y2={-8} stroke="#7d8790" strokeWidth={4} /><circle cx={-85} cy={-4} r={14} fill="#8b949c" stroke="#525a61" strokeWidth={2} /></g>,
    sow: <g><rect x={-120} y={-34} width={84} height={26} rx={3} fill="#2f7d4f" /><line x1={-30} y1={-8} x2={-120} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2].map((k) => <line key={k} x1={-50 - k * 28} y1={-8} x2={-55 - k * 28} y2={depthY(4) - G} stroke="#c0c6cc" strokeWidth={2.4} />)}</g>,
    clear: <g>{[0, 1, 2, 3].map((k) => <ellipse key={k} cx={-50 - k * 20} cy={8} rx={4} ry={12} fill="#9aa4ad" />)}</g>,
    flatCut: <g><line x1={-30} y1={-8} x2={-115} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1].map((k) => <path key={k} d={`M${-55 - k * 40} -8 l 0 ${depthY(14) - G + 8} l -22 0 l 44 0`} stroke="#c0c6cc" strokeWidth={3} fill="none" />)}</g>,
    stripTill: <g><line x1={-30} y1={-8} x2={-115} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2].map((k) => <g key={k}><path d={`M${-50 - k * 28} -8 l 0 ${depthY(22) - G + 8}`} stroke="#c0c6cc" strokeWidth={3} /><circle cx={-50 - k * 28 - 8} cy={4} r={7} fill="none" stroke="#9aa4ad" strokeWidth={2} /></g>)}</g>,
    stubbleDisc: <g><line x1={-30} y1={-10} x2={-120} y2={-10} stroke="#7d8790" strokeWidth={4} />{[0, 1, 2, 3, 4].map((k) => <ellipse key={k} cx={-45 - k * 17} cy={6} rx={3} ry={10} fill="#b0b8bf" stroke="#5d666e" transform={`rotate(18 ${-45 - k * 17} 6)`} />)}</g>,
    harrow: <g><line x1={-30} y1={-6} x2={-130} y2={-6} stroke="#7d8790" strokeWidth={3} />{Array.from({ length: 12 }, (_, k) => <line key={k} x1={-40 - k * 8} y1={-6} x2={-42 - k * 8} y2={depthY(3.5) - G + 4} stroke="#c0c6cc" strokeWidth={1.6} />)}</g>,
    mulcher: <g><rect x={-120} y={-26} width={80} height={24} rx={4} fill="#d97706" /><line x1={-30} y1={-14} x2={-40} y2={-14} stroke="#7d8790" strokeWidth={4} />{Array.from({ length: 8 }, (_, k) => <line key={k} x1={-115 + k * 10} y1={-2} x2={-112 + k * 10} y2={4} stroke="#d8bf72" strokeWidth={2} />)}</g>,
    interRow: <g><line x1={-30} y1={-8} x2={-115} y2={-8} stroke="#7d8790" strokeWidth={4} />{[0, 1].map((k) => <g key={k}><path d={`M${-55 - k * 40} -8 q 0 14 6 ${depthY(7) - G + 6}`} stroke="#c0c6cc" strokeWidth={2.6} fill="none" /><path d={`M${-70 - k * 40} 6 l 10 -10 l 10 10`} stroke="#c0c6cc" strokeWidth={2} fill="none" /></g>)}</g>,
    spread: (
      <g>
        <path d="M-110 -40 l 60 0 l -12 26 l -36 0 z" fill="#2563eb" />
        <line x1={-30} y1={-10} x2={-50} y2={-10} stroke="#7d8790" strokeWidth={4} />
        <g className="spray-mist">{Array.from({ length: 22 }, (_, k) => <circle key={k} cx={-80 + (hashRand(k, 'sp') - 0.5) * 140} cy={-8 + hashRand(k, 'sy') * 14} r={1.8} fill="#f1f5f9" />)}</g>
      </g>
    ),
    spray: (
      <g>
        <rect x={-95} y={-40} width={55} height={30} rx={8} fill="#e9eef2" />
        <line x1={-150} y1={-22} x2={-40} y2={-22} stroke="#a0a8b0" strokeWidth={3} />
        <g className="spray-mist">
          {Array.from({ length: 9 }, (_, k) => (
            <path key={k} d={a.drift ? `M${-150 + k * 13} -20 q 30 6 ${70 + k * 4} 4` : `M${-150 + k * 13} -20 l -3 22 l 6 0 z`} stroke={a.drift ? '#bfe3ff' : 'none'} fill={a.drift ? 'none' : '#bfe3ff'} strokeWidth={a.drift ? 3 : 0} opacity={0.7} />
          ))}
        </g>
      </g>
    ),
  };
  return (
    <g key={a.key} className="tractor-pass">
      <g transform={`translate(0 ${G - 4})`}>
        {imp[a.kind]}
        <rect x={-30} y={-38} width={60} height={26} rx={4} fill="#c0392b" />
        <rect x={-6} y={-62} width={30} height={26} rx={3} fill="#1f2937" stroke="#c0392b" strokeWidth={3} />
        <rect x={-2} y={-58} width={22} height={14} fill="#93c5fd" opacity={0.6} />
        <circle cx={-16} cy={-8} r={12} fill="#111827" stroke="#4b5563" strokeWidth={3} />
        <circle cx={18} cy={-6} r={8} fill="#111827" stroke="#4b5563" strokeWidth={3} />
      </g>
    </g>
  );
}

// --------------------------------------------------------------------------- головний компонент
export default function FieldView({ state: s }: { state: SimState }) {
  const [sel, setSel] = useState<LayerId | null>(null);
  const w = s.weather;
  const z = ZONES[s.zone];
  const c = s.crop;
  const blocked = panBlocking(s);
  const surf = layer(s, 'surface');

  // ---- небо
  let sky: [string, string] = ['#2f6fc2', '#9fd3f5'];
  let skyLabel = 'День';
  if (s.sprayMode === 'evening') { sky = ['#232554', '#e0785a']; skyLabel = 'Вечірня зміна'; }
  if (w.tMin <= -1.5) { sky = ['#8fa9cc', '#e6f0f8']; skyLabel = 'Приморозок'; }
  if (w.rain >= 3) { sky = ['#36404c', '#748190']; skyLabel = w.rain >= 20 ? 'Злива' : 'Дощ'; }
  else if (s.climate === 'drought' || (w.tMax > 31 && w.humidity < 40)) { sky = ['#d9a85e', '#f5e1ad']; skyLabel = 'Посуха'; }
  const dd = doy(s.day);
  if (s.snow > 3 || w.snowfall) { sky = w.snowfall ? ['#7c8796', '#c7d0da'] : ['#8fb3d9', '#e7eef6']; skyLabel = w.snowfall ? 'Снігопад' : 'Зима · сніговий покрив'; }
  else if (dd < 60 || dd > 330) skyLabel += ' · зима';
  const frozen = surf.temp < -0.5;

  const drops = w.rain >= 0.5 && !w.snowfall ? Math.min(90, Math.round(w.rain * 2 + 10)) : 0;
  const flakes = w.snowfall ? Math.min(80, Math.round(w.rain * 8 + 20)) : 0;
  const stand = c && c.emerged ? c.stand : 100;
  const visible = PLANT_X.map((_, k) => hashRand('st', k, c?.sowDay ?? 0) * 100 < stand + 6);
  const destroyed = c?.dead && c.deathCause.startsWith('Знищено');

  const hz = z.horizon;
  const baseColor: Record<LayerId, string> = {
    surface: mix(hz.colors[0], '#8a7a62', 0.25), seedbed: mix(hz.colors[0], '#6b5a44', 0.12), arable: hz.colors[0],
    pan: hz.colors[1], transition: hz.colors[2], parent: hz.colors[3],
  };
  // вологий ґрунт темніший, сухий — світліший
  const layerFill = (id: LayerId, m: number) => mix(mix(baseColor[id], '#d9c9a8', clamp((45 - m) / 90, 0, 0.3)), '#0b0807', clamp((m - 45) / 140, 0, 0.42));

  const selLayer = sel ? s.layers.find((l) => l.id === sel)! : null;
  const weedsN = Math.min(40, Math.round(s.weeds / 1.5));

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-emerald-300/90">Розріз поля та ґрунту · {z.name}</span>
        <span className="text-slate-400">
          {skyLabel} · {c ? `${CROPS[c.id].name}${c.dead ? ' (загинула)' : c.harvested ? ' (зібрано)' : ` BBCH ${String(c.bbch).padStart(2, '0')}`}` : 'культура не висіяна'}
        </span>
      </div>
      <div className="relative min-h-0 flex-1" style={{ background: `linear-gradient(${sky[0]}, ${sky[0]} 60%, #1e293b)` }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" className="h-full w-full select-none" role="img" aria-label="Розріз поля">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky[0]} />
              <stop offset="1" stopColor={sky[1]} />
            </linearGradient>
            <pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="#000" opacity="0.25" />
              <circle cx="6.5" cy="6" r="0.6" fill="#fff" opacity="0.08" />
            </pattern>
            <pattern id="crumb" width="12" height="10" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1.6" fill="#ffffff" opacity="0.07" />
              <circle cx="9" cy="7" r="1.2" fill="#000" opacity="0.25" />
              <circle cx="8" cy="2" r="0.7" fill="#000" opacity="0.3" />
            </pattern>
            <pattern id="crumbBig" width="18" height="14" patternUnits="userSpaceOnUse">
              <ellipse cx="5" cy="4" rx="3" ry="2.2" fill="#000" opacity="0.18" />
              <ellipse cx="13" cy="10" rx="2.5" ry="1.8" fill="#000" opacity="0.22" />
              <circle cx="11" cy="3" r="0.9" fill="#fff" opacity="0.06" />
            </pattern>
            <pattern id="platy" width="22" height="6" patternUnits="userSpaceOnUse">
              <line x1="1" y1="2" x2="15" y2="2" stroke="#000" strokeWidth="1" opacity="0.35" />
              <line x1="9" y1="5" x2="21" y2="5" stroke="#fff" strokeWidth="0.6" opacity="0.1" />
            </pattern>
            <pattern id="prism" width="26" height="30" patternUnits="userSpaceOnUse">
              <path d="M4 0 L5 14 L3 30 M17 0 L16 16 L18 30" stroke="#000" strokeWidth="0.9" opacity="0.28" fill="none" />
              <circle cx="11" cy="9" r="0.8" fill="#000" opacity="0.25" />
            </pattern>
            <pattern id="loess" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="3" r="0.6" fill="#5b4632" opacity="0.35" />
              <circle cx="7" cy="8" r="0.5" fill="#fff" opacity="0.25" />
            </pattern>
            <pattern id="wet" width="30" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 4 q 7 -3 15 0 t 15 0" stroke="#7cc4ff" strokeWidth="0.8" fill="none" opacity="0.35" />
            </pattern>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2.5" opacity="0.6" />
            </pattern>
          </defs>

          {/* ---------- небо */}
          <rect x={0} y={0} width={W} height={G} fill="url(#sky)" />
          {w.rain < 3 && (s.sprayMode === 'evening' ? <circle cx={860} cy={150} r={26} fill="#f6a45f" opacity={0.85} /> : <circle cx={880} cy={52} r={24} fill={skyLabel.startsWith('Посуха') ? '#fff3b0' : '#ffe58a'} opacity={0.95} />)}
          {w.rain >= 3 && <g fill="#4a5562">{[120, 330, 600, 820].map((cx) => <ellipse key={cx} cx={cx} cy={40} rx={110} ry={28} />)}</g>}
          {drops > 0 && (
            <g stroke="#cfe6ff" strokeWidth={1.2} opacity={0.75}>
              {Array.from({ length: drops }, (_, k) => (
                <line key={k} className="rain-drop" x1={(k * 97) % W} y1={(k * 37) % 60} x2={((k * 97) % W) - 4} y2={((k * 37) % 60) + 14} style={{ animationDelay: `${(k % 10) * 0.07}s` }} />
              ))}
            </g>
          )}
          {flakes > 0 && (
            <g fill="#ffffff" opacity={0.9}>
              {Array.from({ length: flakes }, (_, k) => <circle key={k} className="rain-drop" cx={(k * 89) % W} cy={(k * 41) % 120} r={1.8} style={{ animationDuration: '2.4s', animationDelay: `${(k % 12) * 0.2}s` }} />)}
            </g>
          )}
          {w.wind > 6 && (
            <g stroke="#ffffff" strokeWidth={1.4} opacity={0.6}>
              {Array.from({ length: 8 }, (_, k) => <path key={k} className="wind-streak" d={`M0 ${30 + k * 22} q 40 -8 90 0`} fill="none" style={{ animationDelay: `${k * 0.2}s` }} />)}
            </g>
          )}
          <text x={14} y={22} fill="#ffffffcc" fontSize={13} fontFamily="monospace">
            {fmt(w.tAir)} °C · {fmt(w.wind)} м/с · {fmt(w.rain)} мм
          </text>

          {/* ---------- шари ґрунту */}
          {LAYER_DEFS.map((d) => {
            const l = s.layers.find((x) => x.id === d.id)!;
            const y1 = depthY(d.top);
            const y2 = depthY(d.bottom);
            const red = d.id === 'pan' && effRes(l) >= PAN_LIMIT;
            const tex: Record<LayerId, string> = { surface: 'url(#crumb)', seedbed: 'url(#crumb)', arable: 'url(#crumbBig)', pan: 'url(#platy)', transition: 'url(#prism)', parent: 'url(#loess)' };
            return (
              <g key={d.id} onClick={() => setSel(sel === d.id ? null : d.id)} className="cursor-pointer">
                <rect x={0} y={y1} width={W} height={y2 - y1} fill={layerFill(d.id, l.moisture)} />
                <rect x={0} y={y1} width={W} height={y2 - y1} fill={tex[d.id]} />
                {l.moisture > 97 && <rect x={0} y={y1} width={W} height={y2 - y1} fill="url(#wet)" />}
                {red && <rect x={0} y={y1} width={W} height={y2 - y1} fill="url(#hatch)" className="pan-pulse" />}
                {red && <rect x={0} y={y1} width={W} height={y2 - y1} fill="#dc2626" opacity={0.28} className="pan-pulse" />}
                {sel === d.id && <rect x={1} y={y1 + 1} width={W - 2} height={y2 - y1 - 2} fill="none" stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" />}
                <title>{`${d.name} (${d.short}): вологість ${fmt(l.moisture, 0)}% НВ, щільність ${fmt(l.density, 2)} г/см³, опір ${fmt(effRes(l), 2)} МПа`}</title>
              </g>
            );
          })}
          {/* межі горизонтів (хвилясті природні, рівна — дно орного шару) */}
          <g pointerEvents="none" fill="none">
            <line x1={0} y1={depthY(2)} x2={W} y2={depthY(2)} stroke="#00000040" />
            <line x1={0} y1={depthY(8)} x2={W} y2={depthY(8)} stroke="#00000040" strokeDasharray="4 4" />
            <line x1={0} y1={depthY(30)} x2={W} y2={depthY(30)} stroke="#000000aa" strokeWidth={1.5} />
            <line x1={0} y1={depthY(35)} x2={W} y2={depthY(35)} stroke="#00000070" />
            <path d={`M0 ${depthY(80)} ${Array.from({ length: 21 }, (_, k) => `Q ${k * 50 + 25} ${depthY(80) + (k % 2 ? 7 : -7)} ${k * 50 + 50} ${depthY(80)}`).join(' ')}`} stroke="#00000055" strokeWidth={1.4} />
          </g>
          {/* гумусові затьоки в горизонті B та ходи дощових черв'яків */}
          <g pointerEvents="none">
            {s.zone !== 'polissia' && Array.from({ length: 9 }, (_, k) => {
              const xx = 40 + k * 82 + hashRand('tong', k) * 30;
              const len = 18 + hashRand('tl', k) * 30;
              return <path key={k} d={`M${xx - 9} ${depthY(35)} Q ${xx - 3} ${depthY(35) + len * 0.6} ${xx} ${depthY(35) + len} Q ${xx + 3} ${depthY(35) + len * 0.6} ${xx + 9} ${depthY(35)} Z`} fill={hz.colors[0]} opacity={0.55} />;
            })}
            {s.zone === 'polissia' && <rect x={0} y={depthY(35)} width={W} height={depthY(50) - depthY(35)} fill="#e7dcc6" opacity={0.28} />}
            {Array.from({ length: 7 }, (_, k) => {
              const xx = 60 + k * 105 + hashRand('worm', k) * 40;
              const top = depthY(8 + hashRand('wt', k) * 6);
              const bot = depthY(Math.min(95, 40 + hashRand('wb', k) * 50));
              return <path key={`w${k}`} d={`M${xx} ${top} q 6 ${(bot - top) * 0.3} -3 ${(bot - top) * 0.55} t 4 ${(bot - top) * 0.45}`} stroke="#1a120c" strokeWidth={2.2} fill="none" opacity={0.45} />;
            })}
            {/* карбонати: білоочка, псевдоміцелій, конкреції */}
            {Array.from({ length: 34 }, (_, k) => {
              const dep = 50 + hashRand('cb', k) * 100;
              if (dep < hz.carbonatesFrom) return null;
              const xx = 15 + hashRand('cx', k) * (PROF_X - 30);
              return hashRand('ct', k) > 0.5
                ? <ellipse key={`c${k}`} cx={xx} cy={depthY(dep)} rx={3 + hashRand('cr', k) * 3} ry={2} fill="#f3eee2" opacity={0.75} />
                : <path key={`c${k}`} d={`M${xx} ${depthY(dep)} l 6 3 l 3 -4 l 7 2`} stroke="#f3eee2" strokeWidth={0.9} fill="none" opacity={0.7} />;
            })}
          </g>
          {/* мерзлий ґрунт */}
          {frozen && <rect x={0} y={G} width={W} height={depthY(Math.min(30, Math.max(3, -surf.temp * 4))) - G} fill="#bfe1ff" opacity={0.22} pointerEvents="none" />}

          {/* кірка */}
          {s.crust > 0 && (
            <g pointerEvents="none">
              <rect x={0} y={G} width={W} height={depthY(s.crust) - G} fill="#9d9080" />
              {Array.from({ length: 26 }, (_, k) => <path key={k} d={`M${k * 39 + 12} ${G} l 4 ${depthY(s.crust) - G - 2} l -6 3`} stroke="#4d4236" strokeWidth={1.3} fill="none" />)}
            </g>
          )}
          {/* пересохла поверхня */}
          {s.crust === 0 && surf.moisture < 18 && (
            <g stroke="#2a1c12" strokeWidth={1} pointerEvents="none">
              {Array.from({ length: 18 }, (_, k) => <path key={k} d={`M${k * 57 + 20} ${G} l 3 9 l -4 7`} fill="none" />)}
            </g>
          )}
          {/* стерня / мульча */}
          <g stroke="#d8bf72" strokeWidth={1.6} strokeLinecap="round" pointerEvents="none">
            {Array.from({ length: Math.round(s.residue / 1.6) }, (_, k) => {
              const xx = hashRand('res', k) * W;
              const up = hashRand('ru', k) > 0.6;
              return up ? <line key={k} x1={xx} y1={G} x2={xx + 1} y2={G - 7} /> : <line key={k} x1={xx} y1={G - 1} x2={xx + 9} y2={G - 2} />;
            })}
          </g>
          {/* сніговий покрив */}
          {s.snow > 0.5 && (
            <g pointerEvents="none">
              <path d={`M0 ${G} L0 ${G - Math.min(26, s.snow * 0.9)} ${Array.from({ length: 11 }, (_, k) => `Q ${k * 100 + 50} ${G - Math.min(26, s.snow * 0.9) - 4} ${k * 100 + 100} ${G - Math.min(26, s.snow * 0.9)}`).join(' ')} L ${W} ${G} Z`} fill="#f8fafc" opacity={0.95} />
            </g>
          )}
          {/* іній */}
          {w.tMin <= -1.5 && <rect x={0} y={G - 2} width={W} height={4} fill="#eef7ff" opacity={0.8} />}
          {/* калюжі при застої води */}
          {layer(s, 'arable').moisture > 105 && <g fill="#5b8fb9" opacity={0.7}>{[150, 420, 700].map((xx) => <ellipse key={xx} cx={xx} cy={G - 1} rx={50} ry={3} />)}</g>}

          {/* бур'яни */}
          <g pointerEvents="none">
            {Array.from({ length: weedsN }, (_, k) => {
              const xx = 30 + hashRand('wx', k) * (W - 60);
              const hh = 6 + hashRand('wh', k) * (10 + Math.min(30, s.weeds * 0.5));
              const col = hashRand('wc', k) > 0.5 ? '#6fae3e' : '#88b84a';
              return (
                <g key={k} transform={`translate(${xx} ${G})`}>
                  <path d={`M0 0 q -3 ${-hh * 0.6} -7 ${-hh}`} stroke={col} strokeWidth={1.4} fill="none" />
                  <path d={`M0 0 q 2 ${-hh * 0.7} 6 ${-hh * 0.9}`} stroke={col} strokeWidth={1.4} fill="none" />
                  <ellipse cx={-7} cy={-hh} rx={3} ry={1.6} fill={col} />
                  <ellipse cx={6} cy={-hh * 0.9} rx={3} ry={1.6} fill={col} />
                </g>
              );
            })}
          </g>

          {/* ---------- рослини та коріння */}
          {c && !destroyed && (
            <g pointerEvents="none">
              {PLANT_X.map((x, k) =>
                !c.emerged ? (
                  <Germinating key={k} c={c} x={x} i={k} crust={s.crust} />
                ) : visible[k] ? (
                  <g key={k}>
                    <Roots c={c} x={x} i={k} blocked={blocked} />
                    {c.harvested ? <g stroke="#c9a646" strokeWidth={2.5}><line x1={x - 3} y1={G} x2={x - 3} y2={G - 12} /><line x1={x + 3} y1={G} x2={x + 3} y2={G - 9} /></g> : <Plant c={c} x={x} i={k} />}
                  </g>
                ) : null,
              )}
            </g>
          )}
          {c && destroyed && (
            <g pointerEvents="none" fill="#7a5a3a">
              {PLANT_X.map((x, k) => <ellipse key={k} cx={x + (hashRand('ds', k) - 0.5) * 40} cy={G - 2} rx={9} ry={2.4} transform={`rotate(${(hashRand('dr', k) - 0.5) * 30} ${x} ${G})`} />)}
            </g>
          )}

          <Machine s={s} />

          {/* ---------- колонка «Профіль»: вологість та опір по горизонтах */}
          <g pointerEvents="none" fontFamily="Inter, sans-serif">
            <rect x={PROF_X} y={G} width={W - 66 - PROF_X} height={H - G} fill="#020617" opacity={0.72} />
            <rect x={PROF_X} y={G - 17} width={W - PROF_X} height={17} fill="#020617" opacity={0.85} />
            <text x={PROF_X + 6} y={G - 5} fill="#e2e8f0" fontSize={10} fontWeight={700}>ПРОФІЛЬ</text>
            <text x={PROF_X + 62} y={G - 5} fill="#7dd3fc" fontSize={9.5}>▬ волога</text>
            <text x={PROF_X + 118} y={G - 5} fill="#86efac" fontSize={9.5}>▬ опір</text>
            <text x={PROF_X + 166} y={G - 5} fill="#94a3b8" fontSize={9.5}>t°</text>
            {LAYER_DEFS.map((d) => {
              const l = s.layers.find((x) => x.id === d.id)!;
              const y1 = depthY(d.top);
              const y2 = depthY(d.bottom);
              const h = y2 - y1;
              const bw = W - 66 - PROF_X - 12;
              const res = effRes(l);
              const resCol = res >= PAN_LIMIT ? '#ef4444' : res >= 2.2 ? '#eab308' : '#22c55e';
              const mid = y1 + h / 2;
              const bh = Math.min(6, Math.max(2, h / 4));
              return (
                <g key={d.id}>
                  <line x1={PROF_X} y1={y2} x2={W - 66} y2={y2} stroke="#334155" />
                  <rect x={PROF_X + 6} y={mid - bh - 1} width={bw} height={bh} fill="#1e293b" />
                  <rect x={PROF_X + 6} y={mid - bh - 1} width={bw * clamp(l.moisture / 120, 0, 1)} height={bh} fill={l.moisture > 80 ? '#38bdf8' : l.moisture < 45 ? '#f59e0b' : '#7dd3fc'} />
                  <line x1={PROF_X + 6 + bw * (80 / 120)} y1={mid - bh - 2} x2={PROF_X + 6 + bw * (80 / 120)} y2={mid} stroke="#f8fafc" strokeWidth={0.8} opacity={0.6} />
                  <rect x={PROF_X + 6} y={mid + 1} width={bw} height={bh} fill="#1e293b" />
                  <rect x={PROF_X + 6} y={mid + 1} width={bw * clamp(res / 4.5, 0, 1)} height={bh} fill={resCol} />
                  {h >= 30 && (
                    <>
                      <text x={PROF_X + 6} y={mid - bh - 4} fill="#bae6fd" fontSize={10} fontFamily="monospace">{fmt(l.moisture, 0)}%</text>
                      <text x={PROF_X + 6} y={mid + bh + 12} fill={res >= PAN_LIMIT ? '#fecaca' : '#e2e8f0'} fontSize={10} fontFamily="monospace">{fmt(res, 1)} МПа</text>
                      <text x={W - 72} y={mid + bh + 12} fill="#94a3b8" fontSize={9} textAnchor="end" fontFamily="monospace">{fmt(l.temp, 0)}°</text>
                    </>
                  )}
                </g>
              );
            })}
          </g>

          {/* ---------- лінійка глибин */}
          <g pointerEvents="none" fontFamily="monospace" fontSize={11}>
            <rect x={W - 66} y={G} width={66} height={H - G} fill="#020617" opacity={0.85} />
            {[0, 2, 8, 15, 20, 30, 35, 50, 80, 100, 120, 150].map((d) => (
              <g key={d}>
                <line x1={W - 66} y1={depthY(d)} x2={W - 54} y2={depthY(d)} stroke="#e2e8f0" />
                <text x={W - 50} y={Math.min(H - 3, depthY(d) + 4)} fill="#e2e8f0">{d} см</text>
              </g>
            ))}
            <text x={W - 62} y={H - 16} fill="#64748b" fontSize={8}>0–35 ×5</text>
          </g>
          {/* підписи горизонтів: індекс + назва + ключовий показник */}
          <g pointerEvents="none" fontSize={11} fontFamily="Inter, sans-serif">
            {LAYER_DEFS.map((d, idx) => {
              const l = s.layers.find((x) => x.id === d.id)!;
              const y1 = depthY(d.top);
              const y2 = depthY(d.bottom);
              if (y2 - y1 < 16) return null;
              const red = d.id === 'pan' && effRes(l) >= PAN_LIMIT;
              const code = d.id === 'arable' || d.id === 'seedbed' ? hz.codes[0] : d.id === 'pan' ? hz.codes[1] : d.id === 'transition' ? hz.codes[2] : hz.codes[3];
              const label = `${d.short} · ${d.name}`;
              const yy = d.id === 'arable' ? y1 + 18 : (y1 + y2) / 2 + 4;
              return (
                <g key={d.id}>
                  <rect x={6} y={yy - 12} width={Math.min(PROF_X - 16, label.length * 5.9 + 16)} height={16} rx={4} fill={red ? '#7f1d1d' : '#020617'} opacity={0.72} />
                  <text x={12} y={yy} fill={red ? '#fecaca' : '#f8fafc'} fontWeight={red ? 700 : 500}>{label}</text>
                  {y2 - y1 > 34 && <text x={12} y={yy + 15} fill="#cbd5e1" fontSize={9.5} opacity={0.9}>{idx >= 2 ? code : ''}{d.id === 'pan' ? '' : ''}</text>}
                </g>
              );
            })}
            <g>
              <rect x={6} y={G + 1} width={240} height={12} rx={3} fill="#020617" opacity={0.6} />
              <text x={12} y={G + 10} fill="#f8fafc" fontSize={9}>0–2 см · мульча {Math.round(s.residue)}%{s.crust > 0 ? ` · кірка ${fmt(s.crust)} см` : ''}{frozen ? ' · мерзлий' : ''}</text>
            </g>
          </g>
        </svg>

        {/* картка горизонту */}
        {selLayer && (
          <div className="absolute bottom-3 left-3 w-64 rounded-lg border border-emerald-700/60 bg-slate-950/95 p-2.5 text-[11px] shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-emerald-200">{LAYER_DEFS.find((d) => d.id === sel)!.name}</span>
              <button type="button" onClick={() => setSel(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mb-1 text-slate-400">{LAYER_DEFS.find((d) => d.id === sel)!.short}</div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
              {sel === 'surface' && <><dt className="text-slate-400">Стерня</dt><dd>{s.residue}%</dd><dt className="text-slate-400">Кірка</dt><dd className={s.crust ? 'text-red-300' : ''}>{s.crust ? `${fmt(s.crust)} см` : 'немає'}</dd></>}
              {sel === 'seedbed' && <><dt className="text-slate-400">t° ґрунту</dt><dd>{fmt(selLayer.temp)} °C</dd><dt className="text-slate-400">Якість ложа</dt><dd>{Math.round(s.seedbedQuality * 100)}%</dd><dt className="text-slate-400">Насіння</dt><dd>{c ? `${fmt(c.depth)} см` : '—'}</dd></>}
              <dt className="text-slate-400">Вологість</dt><dd>{fmt(selLayer.moisture, 0)}% НВ</dd>
              <dt className="text-slate-400">Щільність</dt><dd>{fmt(selLayer.density, 2)} г/см³</dd>
              <dt className="text-slate-400">Опір</dt><dd className={effRes(selLayer) >= PAN_LIMIT ? 'text-red-400' : ''}>{fmt(effRes(selLayer), 2)} МПа</dd>
              {(sel === 'arable' || sel === 'seedbed') && <><dt className="text-slate-400">Гумус</dt><dd>{fmt(selLayer.humus)}%</dd></>}
              <dt className="text-slate-400">N доступний</dt><dd>{fmt(selLayer.nitrogen)} мг/кг</dd>
              {(sel === 'transition' || sel === 'parent') && <><dt className="text-slate-400">NO₃ промитий</dt><dd>{fmt(selLayer.nitrate)} мг/кг</dd></>}
              <dt className="text-slate-400">pH</dt><dd>{fmt(selLayer.pH)}</dd>
              {(sel === 'parent' || sel === 'transition') && <><dt className="text-slate-400">Прод. волога</dt><dd>{productiveMoisture(s, selLayer.top, selLayer.bottom)} мм</dd></>}
            </dl>
          </div>
        )}
        {!selLayer && <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-slate-300/70">Клацніть на горизонт, щоб переглянути його параметри</div>}
      </div>
    </div>
  );
}
