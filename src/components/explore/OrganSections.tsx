// ============================================================================
// Анатомічні зрізи органів рослини. Стан тканин прив'язаний до симуляції:
// продихи, хлоропласти, кореневі волоски, склеренхіма, виповненість качана тощо.
// ============================================================================
import type { ReactNode } from 'react';
import { PHYS } from '../../sim/data';
import { organogenesis } from '../../sim/anatomy';
import type { Crop, CropId } from '../../sim/types';
import { clamp, hashRand } from '../../sim/util';

export interface SectionProps {
  id: CropId;
  c: Crop; // фактична або умовна рослина заданої фази
  sel: string | null;
  onSel: (id: string | null) => void;
  /** відносна продуктивність фаз [вегет., генер., налив] */
  perf: [number, number, number];
  soilMoist: number; // % НВ у зоні коренів
  soilPh: number;
}

function useHot(sel: string | null, onSel: (id: string | null) => void) {
  return ({ pid, children }: { pid: string; children: ReactNode }) => (
    <g onMouseEnter={() => onSel(pid)} onClick={() => onSel(pid)} className="cursor-pointer" opacity={sel && sel !== pid ? 0.4 : 1} stroke={sel === pid ? '#34d399' : undefined} strokeWidth={sel === pid ? 2.5 : undefined}>
      {children}
    </g>
  );
}

const Frame = ({ children, onLeave, note }: { children: ReactNode; onLeave: () => void; note?: string }) => (
  <svg viewBox="0 0 520 440" className="h-full max-h-[440px] w-full select-none" onMouseLeave={onLeave}>
    <rect width={520} height={440} fill="#0b1220" rx={12} />
    {children}
    {note && <text x={260} y={426} fill="#94a3b8" fontSize={12} textAnchor="middle">{note}</text>}
  </svg>
);

// --------------------------------------------------------------------------- стебло
export function StemSection({ id, c, sel, onSel }: SectionProps) {
  const Hot = useHot(sel, onSel);
  const cx = 260, cy = 205;
  if (id === 'wheat') {
    // товщина механічного кільця: ретардант потовщує, надлишок N та загущення — стоншують
    const sc = clamp(12 * (c.retardant ? 1.45 : 1) * (c.nStatus > 1.2 ? 0.65 : 1) * (c.stand > 115 ? 0.8 : 1), 5, 20);
    return (
      <Frame onLeave={() => onSel(null)} note={`Товщина кільця склеренхіми: ${Math.round(sc * 5)} мкм — ${sc < 9 ? 'соломина слабка, ризик вилягання' : sc > 14 ? 'соломина міцна' : 'норма'}`}>
        <Hot pid="epi"><circle cx={cx} cy={cy} r={170} fill="#9fc46a" /></Hot>
        <Hot pid="scler"><circle cx={cx} cy={cy} r={165} fill="#c7b468" /></Hot>
        <Hot pid="par"><circle cx={cx} cy={cy} r={165 - sc} fill="#dfe8b8" /></Hot>
        <Hot pid="chlor">{Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return <ellipse key={i} cx={cx + Math.cos(a) * 160} cy={cy + Math.sin(a) * 160} rx={12} ry={5} fill="#6ea84a" transform={`rotate(${(a * 180) / Math.PI + 90} ${cx + Math.cos(a) * 160} ${cy + Math.sin(a) * 160})`} />; })}</Hot>
        <Hot pid="bundle">
          {[[140, 22, 9], [112, 14, 13]].map(([r, n, sz]) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + r; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; return <g key={`${r}${i}`}><ellipse cx={x} cy={y} rx={sz} ry={sz * 1.25} fill="#b9a45a" transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} /><circle cx={x - Math.cos(a) * 3} cy={y - Math.sin(a) * 3} r={sz * 0.42} fill="#3f6f8f" stroke="none" /><circle cx={x + Math.cos(a) * 5} cy={y + Math.sin(a) * 5} r={sz * 0.3} fill="#d9a05b" stroke="none" /></g>; }))}
        </Hot>
        <Hot pid="hollow"><circle cx={cx} cy={cy} r={86} fill="#0f172a" /></Hot>
      </Frame>
    );
  }
  if (id === 'corn') {
    const hollow = c.bbch >= 75 && c.vigor < 0.7; // «виїдена» серцевина за стресу в налив
    return (
      <Frame onLeave={() => onSel(null)} note={hollow ? 'Серцевина зруйнована: рослина перекачала цукри стебла в зерно — ризик стеблових гнилей і зламу' : 'Суцільне стебло однодольної рослини з розсіяними пучками'}>
        <Hot pid="epi"><circle cx={cx} cy={cy} r={170} fill="#9fc46a" /></Hot>
        <Hot pid="scler"><circle cx={cx} cy={cy} r={165} fill="#c7b468" /></Hot>
        <Hot pid="par"><circle cx={cx} cy={cy} r={152} fill="#eef0c9" />{hollow && <path d="M200 170 L250 150 L320 190 L300 250 L240 262 L196 226 Z" fill="#4a3a22" opacity={0.85} />}</Hot>
        <Hot pid="bundle">
          {Array.from({ length: 96 }, (_, i) => { const r = 150 * Math.sqrt(0.08 + hashRand(i, 'cr') * 0.92); const a = hashRand(i, 'ca') * Math.PI * 2; const sz = 4 + (r / 150) * 3; return <g key={i}><circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={sz} fill="#8fa35a" /><circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={sz * 0.5} fill="#3f6f8f" stroke="none" /></g>; })}
        </Hot>
      </Frame>
    );
  }
  const pithHole = id === 'rapeseed' && c.bbch > 60;
  return (
    <Frame onLeave={() => onSel(null)} note={id === 'sugarbeet' ? 'Черешок листка: стебло буряка першого року вкорочене (головка коренеплоду)' : 'Стебло дводольної рослини: пучки кільцем, між ксилемою і флоемою — камбій'}>
      <Hot pid="epi"><circle cx={cx} cy={cy} r={170} fill="#9fc46a" />{id === 'sunflower' && Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return <line key={i} x1={cx + Math.cos(a) * 170} y1={cy + Math.sin(a) * 170} x2={cx + Math.cos(a) * 184} y2={cy + Math.sin(a) * 184} stroke="#cfe39a" strokeWidth={1.2} />; })}</Hot>
      <Hot pid="col"><circle cx={cx} cy={cy} r={164} fill="#b9d67a" /></Hot>
      <Hot pid="phloem"><circle cx={cx} cy={cy} r={140} fill="#d9a05b" /></Hot>
      <Hot pid="camb"><circle cx={cx} cy={cy} r={127} fill="#f0e68c" /></Hot>
      <Hot pid="xylem">
        <circle cx={cx} cy={cy} r={122} fill="#5d8aa8" />
        {Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return <line key={i} x1={cx + Math.cos(a) * 92} y1={cy + Math.sin(a) * 92} x2={cx + Math.cos(a) * 140} y2={cy + Math.sin(a) * 140} stroke="#eef0c9" strokeWidth={6} />; })}
        {Array.from({ length: 42 }, (_, i) => { const a = hashRand(i, 'xa') * Math.PI * 2; const r = 96 + hashRand(i, 'xr') * 24; return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={3.2} fill="#1e3a52" stroke="none" />; })}
      </Hot>
      <Hot pid="pith"><circle cx={cx} cy={cy} r={92} fill="#f3f1dc" />{pithHole && <circle cx={cx} cy={cy} r={40} fill="#0f172a" />}</Hot>
    </Frame>
  );
}

// --------------------------------------------------------------------------- корінь
export function RootSection({ id, c, sel, onSel, soilMoist, soilPh }: SectionProps) {
  const Hot = useHot(sel, onSel);
  const cx = 250, cy = 205;
  if (id === 'sugarbeet') {
    const rings = c.bbch < 14 ? 2 : c.bbch < 31 ? 6 : 10;
    const R = 60 + clamp((c.bbch - 10) * 3, 0, 110) * (0.6 + 0.4 * c.vigor);
    return (
      <Frame onLeave={() => onSel(null)} note={`Кілець камбію: ${rings} · діаметр коренеплоду ~${Math.round(R / 14)} см${c.rootBlocked ? ' · «хвостатість» через підошву' : ''}`}>
        <Hot pid="hair"><rect x={cx - R - 16} y={cy - 6} width={16} height={12} fill="#f5efd6" /><rect x={cx + R} y={cy - 6} width={16} height={12} fill="#f5efd6" /></Hot>
        <Hot pid="peri"><circle cx={cx} cy={cy} r={R} fill="#c9b08a" /></Hot>
        <Hot pid="par"><circle cx={cx} cy={cy} r={R - 5} fill="#f8f1dc" /></Hot>
        <Hot pid="rings">{Array.from({ length: rings }, (_, i) => <circle key={i} cx={cx} cy={cy} r={(R - 8) * ((i + 1.5) / (rings + 1))} fill="none" stroke="#d9a05b" strokeWidth={sel === 'rings' ? 3.5 : 2.5} />)}</Hot>
        <Hot pid="core"><path d={`M${cx} ${cy - 16} L${cx + 5} ${cy - 5} L${cx + 16} ${cy} L${cx + 5} ${cy + 5} L${cx} ${cy + 16} L${cx - 5} ${cy + 5} L${cx - 16} ${cy} L${cx - 5} ${cy - 5} Z`} fill="#3f6f8f" /></Hot>
      </Frame>
    );
  }
  const mono = PHYS[id].monocot;
  const hairs = Math.round(clamp((soilMoist - 25) / 45, 0.08, 1) * 46);
  const water = soilMoist > 100;
  const nodActive = c.nodules > 6 && soilPh >= 5.6;
  return (
    <Frame onLeave={() => onSel(null)} note={water ? 'Перезволоження: у корі утворюються повітряні порожнини (аеренхіма), волоски відмирають' : hairs < 12 ? 'Сухий ґрунт: кореневі волоски відмерли — поглинання води та фосфору різко впало' : 'Зона всмоктування: живі кореневі волоски'}>
      <Hot pid="hair">{Array.from({ length: water ? 6 : hairs }, (_, i) => { const a = hashRand(i, 'ha') * Math.PI * 2; const l = 26 + hashRand(i, 'hl') * 34; return <line key={i} x1={cx + Math.cos(a) * 150} y1={cy + Math.sin(a) * 150} x2={cx + Math.cos(a) * (150 + l)} y2={cy + Math.sin(a) * (150 + l)} stroke="#f5efd6" strokeWidth={2} />; })}<circle cx={cx} cy={cy} r={152} fill="#f5efd6" /></Hot>
      <Hot pid="cortex">
        <circle cx={cx} cy={cy} r={146} fill="#eadfb4" />
        {Array.from({ length: 60 }, (_, i) => { const a = hashRand(i, 'ka') * Math.PI * 2; const r = 78 + hashRand(i, 'kr') * 58; return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={water && i % 3 === 0 ? 11 : 5} fill={water && i % 3 === 0 ? '#0f172a' : '#d8cb98'} stroke="none" />; })}
      </Hot>
      <Hot pid="endo"><circle cx={cx} cy={cy} r={70} fill="#c9a45a" /></Hot>
      <Hot pid="peri"><circle cx={cx} cy={cy} r={63} fill="#b9d67a" /></Hot>
      <circle cx={cx} cy={cy} r={57} fill="#e9e2c2" />
      <Hot pid="phloem">{Array.from({ length: mono ? 8 : 4 }, (_, i) => { const a = ((i + 0.5) / (mono ? 8 : 4)) * Math.PI * 2; return <circle key={i} cx={cx + Math.cos(a) * 44} cy={cy + Math.sin(a) * 44} r={mono ? 6 : 10} fill="#d9a05b" />; })}</Hot>
      <Hot pid="xylem">
        {mono
          ? Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return <g key={i}><circle cx={cx + Math.cos(a) * 30} cy={cy + Math.sin(a) * 30} r={9} fill="#3f6f8f" /><circle cx={cx + Math.cos(a) * 47} cy={cy + Math.sin(a) * 47} r={4} fill="#3f6f8f" /></g>; })
          : <path d={`M${cx} ${cy - 52} L${cx + 12} ${cy - 12} L${cx + 52} ${cy} L${cx + 12} ${cy + 12} L${cx} ${cy + 52} L${cx - 12} ${cy + 12} L${cx - 52} ${cy} L${cx - 12} ${cy - 12} Z`} fill="#3f6f8f" />}
      </Hot>
      {id === 'soy' && c.nodules > 0.5 && (
        <Hot pid="nodule">
          <circle cx={430} cy={130} r={52} fill="#c9a77a" />
          <circle cx={430} cy={130} r={38} fill={nodActive ? '#e0607f' : '#e7e3d2'} />
          {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={410 + (i % 5) * 10} cy={110 + Math.floor(i / 5) * 12} r={2.2} fill={nodActive ? '#8a1f3a' : '#a8a591'} stroke="none" />)}
          <text x={430} y={204} fill={nodActive ? '#fda4af' : '#cbd5e1'} fontSize={12} textAnchor="middle" stroke="none">{nodActive ? 'рожева — фіксує N₂' : 'біла — неактивна'}</text>
        </Hot>
      )}
    </Frame>
  );
}

// --------------------------------------------------------------------------- листок
export function LeafSection({ id, c, sel, onSel }: SectionProps) {
  const Hot = useHot(sel, onSel);
  const c4 = PHYS[id].c4;
  const mono = PHYS[id].monocot;
  const open = c.waterSupply > 0.6 && !c.wilting;
  const chl = clamp(c.nStatus, 0.3, 1.25);
  const green = (base: [number, number, number]) => `rgb(${Math.round(base[0] + (1 - Math.min(1, chl)) * 130)}, ${Math.round(base[1] + (1 - Math.min(1, chl)) * 50)}, ${Math.round(base[2] + (1 - Math.min(1, chl)) * 20)})`;
  const dis = c.disease > 4;
  const mite = PHYS[id].seed && id === 'soy' && c.pests > 3;
  const frost = c.leafFrost > 0.2;
  const pDef = (c.factors.phosphorus ?? 1) < 0.9 && c.bbch < 20;
  const cells = (y: number, h: number, n: number, fill: (i: number) => string, rx = 4) => Array.from({ length: n }, (_, i) => <rect key={i} x={30 + (i * 460) / n} y={y} width={460 / n - 2} height={h} rx={rx} fill={fill(i)} />);
  const dead = (i: number, n: number) => (frost && i % 3 === 0) || (dis && i > n * 0.55 && i < n * 0.8);
  return (
    <Frame onLeave={() => onSel(null)} note={`Продихи ${open ? 'відкриті — CO₂ надходить' : 'закриті — економія води, фотосинтез пригнічено'} · хлорофіл ${Math.round(Math.min(1.2, chl) * 100)}% норми`}>
      <Hot pid="cut"><rect x={26} y={60} width={468} height={7} fill="#e6f0b0" /></Hot>
      <Hot pid="uep">{cells(68, 26, mono ? 13 : 16, (i) => (mono && i % 4 === 2 ? '#e8f3c8' : pDef ? '#b98ab8' : '#cfe39a'))}{mono && [2, 6, 10].map((i) => <rect key={i} x={30 + (i * 460) / 13 - 3} y={66} width={460 / 13 + 4} height={34} rx={8} fill={c.wilting ? '#d9e3b8' : '#eef6d6'} opacity={0.9} />)}</Hot>
      {!mono && !c4 ? (
        <>
          <Hot pid="pal">{cells(96, 92, 26, (i) => (dead(i, 26) ? '#6b4a2a' : green([62, 140, 48])), 7)}{Array.from({ length: 26 * 4 }, (_, i) => <circle key={`c${i}`} cx={39 + (Math.floor(i / 4) * 460) / 26} cy={108 + (i % 4) * 21} r={2.4} fill="#1f5f2a" opacity={Math.min(1, chl)} stroke="none" />)}</Hot>
          <Hot pid="spo">{Array.from({ length: 34 }, (_, i) => <circle key={i} cx={44 + ((i * 53) % 436)} cy={206 + ((i * 29) % 74)} r={13} fill={dead(i, 34) ? '#6b4a2a' : green([110, 170, 80])} />)}</Hot>
        </>
      ) : (
        <Hot pid="mes">{Array.from({ length: 64 }, (_, i) => <circle key={i} cx={42 + ((i * 47) % 440)} cy={108 + ((i * 31) % 172)} r={14} fill={dead(i, 64) ? '#6b4a2a' : green([80, 150, 58])} />)}</Hot>
      )}
      {[150, 370].map((x) => (
        <g key={x}>
          {c4 && <Hot pid="kranz"><circle cx={x} cy={192} r={50} fill="#2f7a2c" />{Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <circle key={i} cx={x + Math.cos(a) * 40} cy={192 + Math.sin(a) * 40} r={11} fill="#23661f" stroke="#0b1220" strokeWidth={1} />; })}</Hot>}
          <Hot pid="vb"><circle cx={x} cy={192} r={30} fill="#c9b98a" /><path d={`M${x - 20} 190 A20 20 0 0 1 ${x + 20} 190 Z`} fill="#3f6f8f" /><path d={`M${x - 18} 196 A18 18 0 0 0 ${x + 18} 196 Z`} fill="#d9a05b" /></Hot>
        </g>
      ))}
      <Hot pid="lep">
        {cells(292, 24, 16, (i) => (i === 4 || i === 11 ? '#0b1220' : '#cfe39a'))}
        {[4, 11].map((i) => { const x = 30 + (i * 460) / 16 + 460 / 32; return <g key={i}><ellipse cx={x - (open ? 9 : 4.5)} cy={304} rx={5} ry={12} fill="#5fa343" /><ellipse cx={x + (open ? 9 : 4.5)} cy={304} rx={5} ry={12} fill="#5fa343" /></g>; })}
      </Hot>
      <rect x={26} y={316} width={468} height={6} fill="#e6f0b0" />
      {/* газообмін */}
      {open && [4, 11].map((i) => { const x = 30 + (i * 460) / 16 + 460 / 32; return <g key={i} fontSize={11} fill="#7dd3fc"><text x={x - 34} y={350}>CO₂ ↑</text><text x={x + 8} y={350} fill="#bae6fd">H₂O ↓</text></g>; })}
      {dis && <g><ellipse cx={370} cy={270} rx={26} ry={16} fill="#3a2a16" />{Array.from({ length: 7 }, (_, i) => <circle key={i} cx={354 + i * 6} cy={268 + (i % 2) * 6} r={2.2} fill="#0a0a0a" />)}<text x={404} y={274} fill="#fbbf24" fontSize={11}>пікніди / міцелій у міжклітинниках</text></g>}
      {mite && <g><ellipse cx={120} cy={330} rx={9} ry={6} fill="#c9d24a" /><path d="M112 332 l-8 6 M116 334 l-6 8 M124 334 l6 8 M128 332 l8 6" stroke="#c9d24a" strokeWidth={1.4} /><text x={140} y={340} fill="#fbbf24" fontSize={11}>кліщ висмоктує вміст клітин</text></g>}
      {frost && <text x={30} y={48} fill="#93c5fd" fontSize={12}>Кристали льоду розірвали мембрани — клітини відмерли й побуріли</text>}
      {pDef && !frost && <text x={30} y={48} fill="#d8b4fe" fontSize={12}>Антоціан в епідермісі: фосфор недоступний (холодний ґрунт / pH)</text>}
    </Frame>
  );
}

// --------------------------------------------------------------------------- конус наростання
export function ApexSection({ id, c, sel, onSel }: SectionProps) {
  const Hot = useHot(sel, onSel);
  const o = organogenesis(id, c.bbch);
  const dead = !c.growingPointAlive || c.dead;
  const col = dead ? '#6b5a44' : '#d9e8a0';
  const n = o.primordia;
  const h = o.kind === 'veg' ? 70 : o.kind === 'elong' ? 150 : 210;
  const top = 330 - h;
  const where = !c.emerged ? 'у зародку насінини' : id === 'corn' ? (c.bbch < 16 ? 'під землею, ~2,5 см від поверхні' : `у стеблі над землею, ~${Math.round((c.bbch - 15) * 2.5)} см`) : id === 'wheat' ? (c.bbch < 30 ? 'у вузлі кущіння, 2–3 см під поверхнею' : `у трубці, ${Math.round((c.bbch - 29) * 3)} см над вузлом кущіння`) : 'на верхівці пагона, над поверхнею ґрунту';
  const disc = id === 'sunflower' && (o.kind === 'ridge' || o.kind === 'floral' || o.kind === 'flower');
  return (
    <Frame onLeave={() => onSel(null)} note={`Розташування точки росту: ${where}`}>
      <text x={24} y={40} fill="#fbbf24" fontSize={15} fontWeight={700}>Етап органогенезу {o.stage}</text>
      <text x={24} y={60} fill="#e2e8f0" fontSize={12}>{o.title}</text>
      {/* листкові примордії, що охоплюють конус */}
      <Hot pid="leafprim">
        {[0, 1, 2].map((k) => (
          <g key={k}>
            <path d={`M${200 - k * 34} 372 Q ${178 - k * 40} ${250 - k * 20} ${236 - k * 10} ${top + 30 - k * 24}`} stroke="#7fb85a" strokeWidth={14 - k * 2} fill="none" strokeLinecap="round" />
            <path d={`M${320 + k * 34} 372 Q ${342 + k * 40} ${250 - k * 20} ${284 + k * 10} ${top + 30 - k * 24}`} stroke="#7fb85a" strokeWidth={14 - k * 2} fill="none" strokeLinecap="round" />
          </g>
        ))}
      </Hot>
      <Hot pid="apex">
        {disc ? (
          <>
            <path d="M150 300 Q260 220 370 300 L352 340 L168 340 Z" fill={col} />
            {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={166 + i * 9} cy={296 - Math.sin((i / 21) * Math.PI) * 44} r={o.kind === 'ridge' ? 3 : 5} fill={dead ? '#4a3d2c' : '#b6cf6a'} stroke="none" />)}
          </>
        ) : (
          <>
            <path d={`M226 372 L226 ${top + 34} Q260 ${top - 26} 294 ${top + 34} L294 372 Z`} fill={col} />
            {o.kind !== 'veg' && Array.from({ length: Math.min(n, Math.floor(h / 16)) }, (_, i) => (
              <g key={i} stroke="none">
                <ellipse cx={222} cy={350 - i * 16} rx={o.kind === 'elong' ? 7 : 12} ry={6} fill={dead ? '#4a3d2c' : '#b6cf6a'} />
                <ellipse cx={298} cy={342 - i * 16} rx={o.kind === 'elong' ? 7 : 12} ry={6} fill={dead ? '#4a3d2c' : '#b6cf6a'} />
                {(o.kind === 'ridge' || o.kind === 'floral' || o.kind === 'flower') && <><ellipse cx={212} cy={356 - i * 16} rx={6} ry={3} fill="#8fae4a" /><ellipse cx={308} cy={348 - i * 16} rx={6} ry={3} fill="#8fae4a" /></>}
                {(o.kind === 'floral' || o.kind === 'flower') && <><circle cx={206} cy={348 - i * 16} r={3} fill="#f5e08a" /><circle cx={314} cy={340 - i * 16} r={3} fill="#f5e08a" /></>}
              </g>
            ))}
          </>
        )}
      </Hot>
      <rect x={120} y={372} width={280} height={14} fill="#8a7a4a" rx={3} />
      <text x={260} y={404} fill="#94a3b8" fontSize={11} textAnchor="middle">{dead ? 'ТКАНИНИ БУРІ, ВОДЯНИСТІ — точка росту загинула' : 'меристема жива: тканини щільні, біло-кремові'}</text>
    </Frame>
  );
}

// --------------------------------------------------------------------------- генеративні органи / товарна частина
export function GenSection({ id, c, sel, onSel, perf }: SectionProps) {
  const Hot = useHot(sel, onSel);
  const set = clamp(perf[1] ** (PHYS[id].sens[1] * 2.2), 0.15, 1); // частка зав'язаних зерен
  const fillK = clamp(perf[2] ** (PHYS[id].sens[2] * 2.2), 0.3, 1);
  const ripe = c.bbch >= 85;
  const milk = c.bbch >= 71;
  const kcol = ripe ? '#e0b64a' : milk ? '#f3e7a8' : '#cfe39a';
  if (c.bbch < PHYS[id].phases[1] && id !== 'sugarbeet') {
    return <Frame onLeave={() => onSel(null)}><text x={260} y={200} fill="#94a3b8" fontSize={14} textAnchor="middle">Генеративні органи ще не сформовані.</text><text x={260} y={226} fill="#64748b" fontSize={12} textAnchor="middle">Їх зачатки дивіться на зрізі «Конус наростання».</text></Frame>;
  }
  if (id === 'corn') {
    const rows = 18;
    const filled = Math.round(rows * set);
    return (
      <Frame onLeave={() => onSel(null)} note={`Озерненість качана ${Math.round(set * 100)}% · виповненість зерна ${Math.round(fillK * 100)}%${set < 0.85 ? ' — верхівка не запліднена (стрес у цвітіння)' : ''}`}>
        <Hot pid="husk"><path d="M60 250 Q240 120 470 205 Q240 300 60 250 Z" fill="#b9d67a" opacity={0.5} /></Hot>
        <Hot pid="cob"><path d="M90 235 Q250 190 452 208 Q250 250 90 245 Z" fill="#e8dcc0" /></Hot>
        <Hot pid="kernel">
          {Array.from({ length: rows }, (_, i) => {
            const x = 100 + i * 19.5;
            const hh = (30 - i * 0.9) * (0.55 + 0.45 * fillK);
            const ok = i < filled;
            return <g key={i}><rect x={x} y={222 - i * 0.6 - hh} width={17} height={hh} rx={5} fill={ok ? kcol : '#d8d0b8'} opacity={ok ? 1 : 0.5} /><rect x={x} y={232 - i * 0.2} width={17} height={hh} rx={5} fill={ok ? kcol : '#d8d0b8'} opacity={ok ? 1 : 0.5} /></g>;
          })}
        </Hot>
        {c.bbch < 71 && <Hot pid="silk">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M452 208 q ${20 + i * 4} ${-30 + i * 6} ${46 + i * 2} ${-10 + i * 8}`} stroke="#c98b5a" strokeWidth={1.6} fill="none" />)}</Hot>}
        <text x={24} y={40} fill="#e2e8f0" fontSize={13}>Качан у поздовжньому розрізі: стрижень, зерна, обгортки{c.bbch < 71 ? ', приймочки' : ''}</text>
      </Frame>
    );
  }
  if (id === 'wheat') {
    const sp = 9;
    return (
      <Frame onLeave={() => onSel(null)} note={`Зерен у колосі ${Math.round(set * 100)}% від можливого · виповненість ${Math.round(fillK * 100)}%`}>
        <Hot pid="rachis"><line x1={260} y1={390} x2={260} y2={60} stroke="#b9c46a" strokeWidth={5} /></Hot>
        {Array.from({ length: sp * 2 }, (_, i) => {
          const side = i % 2 ? 1 : -1;
          const y = 360 - Math.floor(i / 2) * 32 - (i % 2) * 16;
          const sterile = i / (sp * 2) > set || (i < 2 && set < 0.9);
          return (
            <Hot key={i} pid={sterile ? 'sterile' : 'spikelet'}>
              <ellipse cx={260 + side * 30} cy={y} rx={30} ry={13} fill={ripe ? '#d9b24c' : '#9bbd5c'} transform={`rotate(${side * -24} ${260 + side * 30} ${y})`} />
              {!sterile && milk && [0, 1].map((k) => <ellipse key={k} cx={260 + side * (22 + k * 18)} cy={y - k * 5} rx={8 * fillK} ry={5 * fillK} fill={kcol} stroke="#8a6a2c" strokeWidth={0.8} />)}
              <line x1={260 + side * 54} y1={y - 12} x2={260 + side * 86} y2={y - 70} stroke={ripe ? '#d9b24c' : '#9bbd5c'} strokeWidth={1.2} />
            </Hot>
          );
        })}
        <text x={24} y={40} fill="#e2e8f0" fontSize={13}>Колос: стрижень, колоски{milk ? ', зернівки' : ', квітки'}</text>
      </Frame>
    );
  }
  if (id === 'sunflower') {
    const empty = (1 - set) * 150;
    return (
      <Frame onLeave={() => onSel(null)} note={`Виповнених сім'янок ${Math.round(set * 100)}%${set < 0.85 ? ' — пустозерний центр кошика (спека, посуха, брак бору, запилювачів)' : ''}`}>
        <Hot pid="receptacle"><path d="M70 220 Q260 330 450 220 Q260 250 70 220 Z" fill="#9fb86a" /><path d="M230 290 L290 290 L275 400 L245 400 Z" fill="#8aa85a" /></Hot>
        <Hot pid="achenes">
          {Array.from({ length: 38 }, (_, i) => {
            const x = 84 + i * 9.4;
            const y = 222 + Math.sin(((x - 70) / 380) * Math.PI) * 28;
            const isEmpty = Math.abs(x - 260) < empty / 2;
            return <ellipse key={i} cx={x} cy={y - 16} rx={4} ry={15 * (isEmpty ? 0.6 : 0.6 + 0.4 * fillK)} fill={isEmpty ? '#8a8272' : c.bbch >= 71 ? '#2e2a26' : '#cdbf8a'} opacity={isEmpty ? 0.5 : 1} />;
          })}
        </Hot>
        {c.bbch < 70 && <Hot pid="ray">{Array.from({ length: 2 }, (_, k) => Array.from({ length: 5 }, (_, i) => <ellipse key={`${k}${i}`} cx={k ? 440 + i * 6 : 80 - i * 6} cy={196 - i * 10} rx={8} ry={26} fill="#f5c518" transform={`rotate(${k ? 40 : -40} ${k ? 440 + i * 6 : 80 - i * 6} ${196 - i * 10})`} />))}</Hot>}
        <text x={24} y={40} fill="#e2e8f0" fontSize={13}>Кошик у розрізі: ложе, сім'янки{c.bbch < 70 ? ', язичкові квітки' : ''}</text>
      </Frame>
    );
  }
  if (id === 'soy' || id === 'rapeseed') {
    const n = id === 'soy' ? 3 : 14;
    const ok = Math.max(1, Math.round(n * set));
    const len = id === 'soy' ? 300 : 400;
    return (
      <Frame onLeave={() => onSel(null)} note={`Насінин у ${id === 'soy' ? 'бобі' : 'стручку'}: ${ok} з ${n} · виповненість ${Math.round(fillK * 100)}%`}>
        <Hot pid="valve"><path d={`M${260 - len / 2} 215 Q260 ${id === 'soy' ? 130 : 180} ${260 + len / 2} 205 Q260 ${id === 'soy' ? 300 : 250} ${260 - len / 2} 215 Z`} fill={ripe ? '#b79a5a' : '#8fbf4f'} /></Hot>
        {id === 'rapeseed' && <Hot pid="septum"><line x1={260 - len / 2 + 12} y1={214} x2={260 + len / 2 - 12} y2={206} stroke="#e9e6d2" strokeWidth={3} /></Hot>}
        <Hot pid="seed">
          {Array.from({ length: n }, (_, i) => {
            const x = 260 - len / 2 + (len / (n + 1)) * (i + 1);
            const r = (id === 'soy' ? 34 : 10) * (i < ok ? (milk ? 0.5 + 0.5 * fillK : 0.4) : 0.25);
            return <circle key={i} cx={x} cy={211 + (id === 'rapeseed' ? (i % 2 ? 9 : -9) : 0)} r={r} fill={i < ok ? (ripe ? (id === 'soy' ? '#e6cf7a' : '#2a221c') : '#b9d67a') : '#6b6558'} />;
          })}
        </Hot>
        <text x={24} y={40} fill="#e2e8f0" fontSize={13}>{id === 'soy' ? 'Біб: стулки, насінини' : 'Стручок: стулки, перегородка, насінини'}</text>
      </Frame>
    );
  }
  return <RootSection id={id} c={c} sel={sel} onSel={onSel} perf={perf} soilMoist={60} soilPh={7} />;
}
