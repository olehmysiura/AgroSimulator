interface Series { data: number[]; color: string; name: string; bars?: boolean }
interface Ref { v: number; label: string; color: string }

/** Компактний лінійний / стовпчиковий графік часового ряду. */
export default function MiniChart({ series, refs = [], from, to, min, max, height = 120 }: { series: Series[]; refs?: Ref[]; from: string; to: string; min?: number; max?: number; height?: number }) {
  const W = 420, H = height, L = 30, B = 14;
  const all = series.flatMap((s) => s.data).concat(refs.map((r) => r.v));
  let lo = min ?? Math.min(...all);
  let hi = max ?? Math.max(...all);
  if (hi - lo < 1e-6) hi = lo + 1;
  if (min === undefined) lo -= (hi - lo) * 0.05;
  if (max === undefined) hi += (hi - lo) * 0.08;
  const n = Math.max(2, series[0].data.length);
  const x = (i: number) => L + (i / (n - 1)) * (W - L - 6);
  const y = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - B - 6);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <rect x={L} y={6} width={W - L - 6} height={H - B - 6} fill="#020617" />
        {[lo, (lo + hi) / 2, hi].map((v) => <text key={v} x={L - 3} y={y(v) + 3} fill="#64748b" fontSize={9} textAnchor="end" fontFamily="monospace">{Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)}</text>)}
        {refs.filter((r) => r.v >= lo && r.v <= hi).map((r) => (
          <g key={r.label}><line x1={L} y1={y(r.v)} x2={W - 6} y2={y(r.v)} stroke={r.color} strokeWidth={0.8} strokeDasharray="4 3" /><text x={W - 8} y={y(r.v) - 2} fill={r.color} fontSize={8} textAnchor="end">{r.label}</text></g>
        ))}
        {series.map((s) =>
          s.bars
            ? s.data.map((v, i) => (v > 0 ? <rect key={i} x={x(i) - 0.8} y={y(v)} width={Math.max(1, (W - L) / n - 0.5)} height={H - B - y(v)} fill={s.color} /> : null))
            : <polyline key={s.name} points={s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} />,
        )}
        <text x={L} y={H - 3} fill="#64748b" fontSize={9}>{from}</text>
        <text x={W - 6} y={H - 3} fill="#64748b" fontSize={9} textAnchor="end">{to}</text>
      </svg>
      {series.length > 1 && <div className="flex gap-3 text-[10px] text-slate-400">{series.map((s) => <span key={s.name}><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: s.color }} />{s.name}</span>)}</div>}
    </div>
  );
}
