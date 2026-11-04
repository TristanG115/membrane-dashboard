import { line, scaleLinear } from 'd3'
import { useWidth } from '../lib/useSize'
import { fmtM } from '../lib/money'

export interface BreakEvenSeries { id: string; label: string; color: string; dash?: string; points: { months: number; npv: number }[]; breakEven: number | null }

/** Data-center NPV against months energized earlier than firm-only service. Where a line crosses zero is the break-even. */
export function BreakEven({ series, months, height = 250 }: { series: BreakEvenSeries[]; months: number; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const m = { l: 58, r: 16, t: 14, b: 36 }
  const iw = w - m.l - m.r, ih = height - m.t - m.b
  const maxM = series[0]?.points.at(-1)?.months ?? 48
  const all = series.flatMap((s) => s.points.map((p) => p.npv))
  const lo = Math.min(...all, -40), hi = Math.max(...all, 10)
  const x = scaleLinear([0, maxM], [0, iw])
  const y = scaleLinear([lo, hi], [ih, 0]).nice()
  const ln = line<{ months: number; npv: number }>().x((d) => x(d.months)).y((d) => y(d.npv))
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Data center NPV against months energized early">
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(w < 500 ? 3 : 5).map((v) => <g key={v}><line x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#6b7ea3' : '#26324a'} /><text x={-8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9aa8c2" className="num">{fmtM(v, 0)}</text></g>)}
          {x.ticks(w < 500 ? 4 : 6).map((v) => <text key={v} x={x(v)} y={ih + 16} textAnchor="middle" fontSize={11} fill="#9aa8c2" className="num">{v}</text>)}
          <text x={iw / 2} y={ih + 32} textAnchor="middle" fontSize={11.5} fill="#9aa8c2">months energized earlier than firm-only service</text>
          <line x1={x(months)} x2={x(months)} y1={0} y2={ih} stroke="#e6ecf7" strokeDasharray="2 3" />
          <text x={x(months) + 5} y={10} fontSize={11.5} fill="#e6ecf7" className="num">now {months} mo</text>
          {series.map((s) => <path key={s.id} d={ln(s.points) ?? ''} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />)}
          {series.map((s, k) => s.breakEven !== null && <g key={s.id + 'be'}><circle cx={x(s.breakEven)} cy={y(0)} r={5} fill="#0b1220" stroke={s.color} strokeWidth={2} /><text x={x(s.breakEven) + 9} y={y(0) + (k === 0 ? -9 : 17)} fontSize={12} fill={s.color} className="num">{s.breakEven.toFixed(1)} months</text></g>)}
        </g>
      </svg>
      <div className="legend-inline" style={{ paddingLeft: m.l }}>{series.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  )
}
