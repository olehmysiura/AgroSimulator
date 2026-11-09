// ============================================================================
// Поздовжній розріз насінини / зернівки: від сухого насіння через проростання
// до формування, наливу та повної стиглості нового зерна.
// ============================================================================
import type { ReactNode } from 'react';
import { PHYS } from '../../sim/data';
import { SEED_PARTS, type SeedState } from '../../sim/anatomy';
import type { CropId } from '../../sim/types';

interface Props {
  id: CropId;
  st: SeedState;
  sel: string | null;
  onSel: (id: string | null) => void;
  /** виповненість зернини 0..1 (щуплість через стрес у налив) */
  fill: number;
}

const ENDO_FILL: Record<string, string | undefined> = { watery: '#d8ebf2', milk: '#fdfdf6', dough: '#f3e6b8' };

export default function SeedSection({ id, st, sel, onSel, fill }: Props) {
  const type = PHYS[id].seed.type;
  const parts = Object.fromEntries(SEED_PARTS[type].map((p) => [p.id, p]));
  const col = (pid: string) => parts[pid]?.color ?? '#888';
  const Hot = ({ pid, children }: { pid: string; children: ReactNode }) => (
    <g onMouseEnter={() => onSel(pid)} onClick={() => onSel(pid)} className="cursor-pointer" opacity={sel && sel !== pid ? 0.42 : 1} stroke={sel === pid ? '#34d399' : undefined} strokeWidth={sel === pid ? 2.5 : undefined}>
      {children}
    </g>
  );
  const forming = ['flower', 'watery', 'milk', 'dough', 'hard', 'ripe'].includes(st.phase);
  const germ = ['imbibe', 'radicle', 'shoot', 'emerge', 'spent'].includes(st.phase);
  // масштаб: набубнявіння (+12%), розмір зернини, що формується, щуплість
  const k = forming ? (0.3 + 0.7 * st.size) * (st.phase === 'flower' ? 1 : 0.82 + 0.18 * fill) : 1 + 0.12 * st.swell;
  const endo = ENDO_FILL[st.phase];
  const used = germ ? 1 - st.reserve / 100 : 0; // частка витраченого запасу
  const spent = st.phase === 'spent' && st.reserve < 5;
  const embryoK = forming ? (st.phase === 'flower' ? 0.15 : st.phase === 'watery' ? 0.45 : st.phase === 'milk' ? 0.8 : 1) : 1;
  const R = st.radicle * 105;
  const S = st.shoot * 120;
  const green = st.phase === 'emerge' || st.phase === 'spent';

  let body: ReactNode = null;
  let rad: [number, number, number, number] = [0, 0, 0, 1]; // точка виходу корінця: x, y, dx, dy
  let sh: [number, number, number, number] = [0, 0, 0, -1];

  if (type === 'caryopsis') {
    rad = [112, 232, -0.25, 1];
    sh = [124, 176, -0.35, -1];
    body = (
      <>
        <Hot pid="brush">{Array.from({ length: 11 }, (_, i) => <line key={i} x1={428} y1={170} x2={452 + (i % 3) * 5} y2={140 + i * 6} stroke={col('brush')} strokeWidth={1.4} />)}</Hot>
        <Hot pid="pericarp"><ellipse cx={260} cy={170} rx={172} ry={94} fill={col('pericarp')} /></Hot>
        <Hot pid="testa"><ellipse cx={260} cy={170} rx={165} ry={87} fill={col('testa')} /></Hot>
        <Hot pid="aleurone"><ellipse cx={260} cy={170} rx={160} ry={82} fill={col('aleurone')} /></Hot>
        <Hot pid="endosperm">
          <ellipse cx={260} cy={170} rx={151} ry={73} fill={endo ?? col('endosperm')} />
          {used > 0 && <ellipse cx={260} cy={170} rx={151} ry={73} fill="#b9a36a" opacity={0.6} clipPath="url(#usedClip)" />}
          {!endo && !spent && Array.from({ length: 46 }, (_, i) => <circle key={i} cx={190 + ((i * 53) % 205)} cy={118 + ((i * 37) % 104)} r={2.6} fill="#fff" opacity={0.55} stroke="none" />)}
        </Hot>
        <g transform={`translate(142 206) scale(${embryoK}) translate(-142 -206)`}>
          <Hot pid="scutellum"><ellipse cx={156} cy={202} rx={26} ry={44} fill={col('scutellum')} transform="rotate(-28 156 202)" /></Hot>
          <Hot pid="coleoptile"><ellipse cx={132} cy={190} rx={10} ry={19} fill={col('coleoptile')} transform="rotate(-28 132 190)" /></Hot>
          <Hot pid="radicle"><ellipse cx={121} cy={224} rx={9} ry={15} fill={col('radicle')} transform="rotate(-28 121 224)" /></Hot>
        </g>
        <path d="M150 256 Q 260 275 380 250" stroke="#00000040" strokeWidth={2} fill="none" strokeDasharray="5 4" />
      </>
    );
  } else if (type === 'cornKernel') {
    rad = [260, 318, 0, 1];
    sh = [300, 212, 1, -0.5];
    const shape = 'M260 38 C362 38 392 110 382 190 C374 250 322 300 286 318 L234 318 C198 300 146 250 138 190 C128 110 158 38 260 38 Z';
    const dent = st.phase === 'dough' || st.phase === 'hard' || st.phase === 'ripe' || !forming;
    body = (
      <>
        <Hot pid="pericarp"><path d={shape} fill={col('pericarp')} /></Hot>
        <Hot pid="aleurone"><path d={shape} fill={col('aleurone')} transform="translate(260 180) scale(0.955) translate(-260 -180)" /></Hot>
        <Hot pid="horny"><path d={shape} fill={endo ?? col('horny')} transform="translate(260 180) scale(0.915) translate(-260 -180)" /></Hot>
        <Hot pid="floury">
          <path d="M260 62 C318 62 334 110 322 150 C312 180 300 200 286 250 L234 250 C220 200 208 180 198 150 C186 110 202 62 260 62 Z" fill={endo ? '#ffffff' : col('floury')} opacity={endo ? 0.7 : 1} />
          {used > 0 && <rect x={190} y={250 - 190 * used} width={140} height={190 * used} fill="#b9a36a" opacity={0.55} clipPath="url(#cornClip)" />}
        </Hot>
        {dent && <path d="M222 42 Q260 66 298 42" fill="#0f172a" stroke={col('pericarp')} strokeWidth={5} />}
        {st.phase === 'dough' && <line x1={160} y1={150 + ((st.dry - 70) / 25) * 110} x2={360} y2={150 + ((st.dry - 70) / 25) * 110} stroke="#fff" strokeWidth={2} strokeDasharray="6 4" />}
        <g transform={`translate(260 250) scale(${embryoK}) translate(-260 -250)`}>
          <Hot pid="scutellum"><ellipse cx={260} cy={228} rx={44} ry={66} fill={col('scutellum')} /></Hot>
          <Hot pid="coleoptile"><ellipse cx={260} cy={198} rx={12} ry={22} fill={col('coleoptile')} /><path d="M254 204 q6 -20 12 0" stroke="#7fae4a" strokeWidth={1.5} fill="none" /></Hot>
          <Hot pid="radicle"><ellipse cx={260} cy={266} rx={10} ry={20} fill={col('radicle')} /></Hot>
        </g>
        <Hot pid="tip">
          <ellipse cx={260} cy={320} rx={30} ry={11} fill="#8a6a3a" />
          {(st.phase === 'hard' || st.phase === 'ripe' || !forming) && <ellipse cx={260} cy={308} rx={24} ry={4} fill="#0a0a0a" />}
        </Hot>
      </>
    );
  } else if (type === 'achene') {
    rad = [260, 322, 0, 1];
    sh = [260, 322, 0.3, 1];
    const shape = 'M260 322 C232 316 198 296 188 246 C170 166 190 66 228 30 C246 16 274 16 292 30 C330 66 350 166 332 246 C322 296 288 316 260 322 Z';
    const sc = (f: number) => `translate(260 170) scale(${f}) translate(-260 -170)`;
    body = (
      <>
        <Hot pid="pericarp">
          <path d={shape} fill={col('pericarp')} />
          {[-40, -20, 0, 20, 40].map((d) => <path key={d} d={`M${260 + d} 40 Q ${260 + d * 1.5} 170 ${260 + d * 0.4} 312`} stroke="#bdb5a8" strokeWidth={3} fill="none" opacity={0.5} />)}
        </Hot>
        <Hot pid="panzer"><path d={shape} fill={col('panzer')} transform={sc(0.93)} /></Hot>
        <path d={shape} fill="#6e6258" transform={sc(0.9)} />
        <path d={shape} fill="#0f172a" transform={sc(0.84)} />
        <Hot pid="testa"><path d={shape} fill={col('testa')} transform={sc(0.8 * (forming ? 0.4 + 0.6 * fill * st.size : 1))} /></Hot>
        <Hot pid="cotyledons">
          <path d={shape} fill={endo ?? col('cotyledons')} transform={sc(0.77 * (forming ? 0.4 + 0.6 * fill * st.size : 1))} />
          <line x1={260} y1={62} x2={260} y2={262} stroke="#b9a970" strokeWidth={2} />
          {used > 0 && <rect x={200} y={60} width={120} height={210 * used} fill="#b9a36a" opacity={0.5} />}
        </Hot>
        <Hot pid="axis">
          <path d="M260 262 L250 282 Q260 304 270 282 Z" fill={col('axis')} transform={`translate(260 280) scale(${embryoK}) translate(-260 -280)`} />
        </Hot>
      </>
    );
  } else if (type === 'dicot') {
    const round = id === 'rapeseed';
    rad = round ? [176, 262, -0.5, 1] : [128, 246, -0.4, 1];
    sh = round ? [176, 262, -0.9, 0.2] : [128, 246, -1, 0];
    body = round ? (
      <>
        <Hot pid="testa"><circle cx={260} cy={170} r={128} fill="#3a2a22" /><circle cx={260} cy={170} r={121} fill={col('testa')} /></Hot>
        <Hot pid="cotyledons">
          <circle cx={260} cy={170} r={113} fill={endo ?? col('cotyledons')} />
          <path d="M260 60 A110 110 0 0 1 366 196 A84 84 0 0 0 260 92 Z" fill="#e2d087" />
          <path d="M196 248 A104 104 0 0 0 360 214 A80 80 0 0 1 214 226 Z" fill="#e2d087" />
          {used > 0 && <circle cx={260} cy={170} r={113 * Math.sqrt(used)} fill="#b9a36a" opacity={0.45} />}
        </Hot>
        <Hot pid="axis"><path d="M196 250 Q150 190 190 110 Q205 150 222 236 Z" fill={col('axis')} transform={`translate(196 200) scale(${embryoK}) translate(-196 -200)`} /></Hot>
        <Hot pid="plumule"><ellipse cx={206} cy={112} rx={9} ry={13} fill={col('plumule')} /></Hot>
        <Hot pid="hilum"><ellipse cx={152} cy={238} rx={6} ry={12} fill={col('hilum')} transform="rotate(35 152 238)" /></Hot>
      </>
    ) : (
      <>
        <Hot pid="testa"><ellipse cx={260} cy={170} rx={160} ry={112} fill={col('testa')} /></Hot>
        <Hot pid="cotyledons">
          <ellipse cx={266} cy={170} rx={146} ry={99} fill={endo ?? col('cotyledons')} />
          <path d="M150 120 Q260 150 400 150" stroke="#cdbb78" strokeWidth={1.5} fill="none" />
          {used > 0 && <ellipse cx={266} cy={170} rx={146 * Math.sqrt(used)} ry={99 * Math.sqrt(used)} fill="#b9a36a" opacity={0.45} />}
        </Hot>
        <g transform={`translate(140 190) scale(${embryoK}) translate(-140 -190)`}>
          <Hot pid="axis"><path d="M128 250 Q112 190 138 122 Q156 132 150 186 Q146 226 138 252 Z" fill={col('axis')} /></Hot>
          <Hot pid="plumule"><path d="M142 124 q14 -22 30 -8 q-12 2 -20 18 Z M146 130 q24 -6 34 12 q-14 -6 -30 0 Z" fill={col('plumule')} /></Hot>
        </g>
        <Hot pid="hilum"><ellipse cx={103} cy={176} rx={7} ry={30} fill={col('hilum')} /><circle cx={106} cy={216} r={3} fill="#111" /></Hot>
      </>
    );
  } else {
    rad = [182, 196, -1, 0.3];
    sh = [182, 196, -0.8, -0.6];
    body = (
      <>
        <Hot pid="pericarp"><path d="M260 44 L318 70 L378 66 L392 128 L432 170 L396 222 L392 282 L326 282 L268 316 L210 286 L142 290 L134 226 L92 180 L130 124 L132 66 L202 72 Z" fill={col('pericarp')} /><path d="M260 44 L318 70 L378 66 L392 128 L432 170 L396 222 L392 282 L326 282 L268 316 L210 286 L142 290 L134 226 L92 180 L130 124 L132 66 L202 72 Z" fill="url(#cork)" /></Hot>
        <ellipse cx={262} cy={186} rx={98} ry={74} fill="#0f172a" />
        <Hot pid="lid"><path d="M176 122 Q262 78 348 122 L340 136 Q262 100 184 136 Z" fill={col('lid')} /></Hot>
        <Hot pid="testa"><ellipse cx={262} cy={188} rx={86} ry={62} fill={col('testa')} /></Hot>
        <Hot pid="embryo"><ellipse cx={262} cy={188} rx={78} ry={54} fill={col('embryo')} transform={`translate(262 188) scale(${0.5 + 0.5 * embryoK}) translate(-262 -188)`} /></Hot>
        <Hot pid="perisperm">
          <ellipse cx={270} cy={188} rx={52} ry={32} fill={endo ?? col('perisperm')} />
          {used > 0 && <ellipse cx={270} cy={188} rx={52 * Math.sqrt(used)} ry={32 * Math.sqrt(used)} fill="#b9a36a" opacity={0.5} />}
        </Hot>
        <path d="M184 196 q10 -14 22 -4" stroke="#8fa85a" strokeWidth={3} fill="none" />
      </>
    );
  }

  return (
    <svg viewBox="0 0 520 440" className="h-full max-h-[440px] w-full select-none" onMouseLeave={() => onSel(null)}>
      <defs>
        <clipPath id="usedClip"><rect x={100} y={90} width={310 * used + 40} height={170} /></clipPath>
        <clipPath id="cornClip"><path d="M260 62 C318 62 334 110 322 150 C312 180 300 200 286 250 L234 250 C220 200 208 180 198 150 C186 110 202 62 260 62 Z" /></clipPath>
        <pattern id="cork" width="14" height="12" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#000" opacity="0.2" /><circle cx="11" cy="9" r="1.4" fill="#fff" opacity="0.12" /></pattern>
      </defs>
      <rect width={520} height={440} fill="#0b1220" rx={12} />
      {/* ґрунтовий розчин навколо під час проростання */}
      {germ && <rect width={520} height={440} fill="#3b2a1e" rx={12} opacity={0.75} />}
      {germ && Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 97) % 520} cy={(i * 61) % 440} r={5 + (i % 4) * 2} fill="#000" opacity={0.18} />)}
      {st.phase === 'imbibe' && Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${60 + i * 44} ${40 + (i % 3) * 20} q4 8 0 12 q-4 -4 0 -12`} fill="#7cc4ff" opacity={0.8} />)}

      {spent ? (
        <g opacity={0.5} transform="translate(260 190) scale(0.7) translate(-260 -170)">{body}</g>
      ) : (
        <g transform={`translate(260 170) scale(${k}) translate(-260 -170)`}>{body}</g>
      )}

      {/* органи проростка за межами насінини */}
      {R > 0 && (
        <g fill="none" strokeLinecap="round">
          <path d={`M${rad[0]} ${rad[1]} q ${rad[2] * R * 0.5 - 8} ${rad[3] * R * 0.5} ${rad[2] * R} ${rad[3] * R}`} stroke="#f4ecd0" strokeWidth={7} />
          {st.radicle > 0.6 && Array.from({ length: 12 }, (_, i) => {
            const t = 0.3 + (i / 12) * 0.6;
            const x = rad[0] + rad[2] * R * t;
            const y = rad[1] + rad[3] * R * t;
            return <line key={i} x1={x} y1={y} x2={x + (i % 2 ? 14 : -14)} y2={y + 3} stroke="#f4ecd0" strokeWidth={0.9} />;
          })}
          {st.radicle >= 1 && PHYS[id].monocot && <><path d={`M${rad[0] + 14} ${rad[1] - 4} q 30 ${R * 0.4} 46 ${R * 0.8}`} stroke="#f4ecd0" strokeWidth={4} /><path d={`M${rad[0] - 8} ${rad[1] - 2} q -40 ${R * 0.3} -66 ${R * 0.7}`} stroke="#f4ecd0" strokeWidth={4} /></>}
        </g>
      )}
      {S > 0 && (
        <g fill="none" strokeLinecap="round">
          {PHYS[id].monocot ? (
            <>
              <path d={`M${sh[0]} ${sh[1]} q ${sh[2] * S * 0.6} ${sh[3] * S * 0.3} ${sh[2] * 30 - 4} ${-S}`} stroke={green ? '#cfe39a' : '#eef3b8'} strokeWidth={9} />
              {green && <path d={`M${sh[0] + sh[2] * 30 - 4} ${sh[1] - S} q -4 -30 12 -52`} stroke="#5fa343" strokeWidth={6} />}
            </>
          ) : (
            <>
              <path d={`M${sh[0]} ${sh[1]} q ${-S * 0.5} ${-S * 0.2} ${-S * 0.45} ${-S * 0.9} q 4 ${-S * 0.28} ${S * 0.22} ${-S * 0.2}`} stroke={green ? '#cfe39a' : '#f1f0c8'} strokeWidth={8} />
              <text x={sh[0] - S * 0.45 - 6} y={sh[1] - S * 1.12} fill="#cbd5e1" fontSize={11} textAnchor="middle" stroke="none">гачок гіпокотиля</text>
            </>
          )}
        </g>
      )}
      {st.phase === 'flower' && (
        <g stroke="#f3e9a6" strokeWidth={2} fill="none">
          <path d="M250 110 q-30 -50 -70 -60 M270 110 q30 -50 70 -60" />
          {Array.from({ length: 12 }, (_, i) => <line key={i} x1={190 + i * 12} y1={62 + Math.abs(i - 5.5) * 6} x2={186 + i * 12} y2={50 + Math.abs(i - 5.5) * 6} />)}
          <text x={260} y={36} fill="#cbd5e1" fontSize={12} textAnchor="middle" stroke="none">приймочка маточки · зав'язь після запліднення</text>
        </g>
      )}
      {spent && <text x={260} y={330} fill="#94a3b8" fontSize={13} textAnchor="middle">оболонка порожня — запас повністю використано</text>}

      {/* шкали стану */}
      <g fontSize={11} fontFamily="monospace">
        <text x={16} y={392} fill="#94a3b8">{forming ? 'Суха речовина' : 'Запас поживних речовин'}</text>
        <rect x={16} y={398} width={230} height={9} rx={4} fill="#1e293b" />
        <rect x={16} y={398} width={230 * ((forming ? st.dry * (0.6 + 0.4 * fill) : st.reserve) / 100)} height={9} rx={4} fill="#eab308" />
        <text x={250} y={407} fill="#e2e8f0">{Math.round(forming ? st.dry * (0.6 + 0.4 * fill) : st.reserve)}%</text>
        <text x={290} y={392} fill="#94a3b8">Вологість</text>
        <rect x={290} y={398} width={180} height={9} rx={4} fill="#1e293b" />
        <rect x={290} y={398} width={180 * (st.moisture / 100)} height={9} rx={4} fill="#38bdf8" />
        <text x={474} y={407} fill="#e2e8f0">{st.moisture}%</text>
        {forming && fill < 0.93 && st.phase !== 'flower' && <text x={16} y={428} fill="#fca5a5">щуплість: виповненість {Math.round(fill * 100)}% через стрес у період наливу</text>}
      </g>
    </svg>
  );
}
