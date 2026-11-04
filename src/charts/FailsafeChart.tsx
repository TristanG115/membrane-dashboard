import { line, scaleLinear } from 'd3'
import { useWidth } from '../lib/useSize'
import type { Timeline } from '../sim/types'
import { fmtClock } from '../sim/time'

/** Second-by-second view of a link loss, with an illustrative uncontrolled large-load trip for comparison. */
export function FailsafeChart({ tl, idx, t0, t, height = 250 }: { tl: Timeline; idx: number; t0: number; t: number; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const s = tl.sites[idx]
  const m = { l: 40, r: 16, t: 12, b: 28 }
  const iw = w - m.l - m.r, ih = height - m.t - m.b
  const a = t0 - 45, z = t0 + 150
  const total = s.cfg.firmMW + s.cfg.flexMW
  const x = scaleLinear([a, z], [0, iw])
  const y = scaleLinear([0, total * 1.1], [ih, 0])
  const secs = Array.from({ length: z - a + 1 }, (_, k) => a + k)
  const pre = s.gridDraw[Math.max(0, t0 - 1)]
  const ctl = line<number>().x((u) => x(u)).y((u) => y(s.gridDraw[u]))(secs)
  const bat = line<number>().x((u) => x(u)).y((u) => y(s.b[u]))(secs)
  const run = line<number>().x((u) => x(u)).y((u) => y(s.flexRun[u] + s.cfg.firmMW))(secs)
  // an uncontrolled trip: the whole site's draw falls to zero in under a second
  const trip = `M${x(a)},${y(pre)} H${x(t0)} V${y(0)} H${x(z)}`
  const nowIn = t >= a && t <= z
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Grid draw during a Membrane link loss compared with an uncontrolled large-load trip">
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(5).map((v) => <g key={v}><line x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="#26324a" /><text x={-8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9aa8c2" className="num">{v}</text></g>)}
          <rect x={x(t0)} width={Math.max(0, x(t0 + 3) - x(t0))} y={0} height={ih} fill="#5ed3e6" opacity={0.15} />
          <line x1={x(t0)} x2={x(t0)} y1={0} y2={ih} stroke="#5ed3e6" strokeDasharray="3 3" />
          <text x={x(t0) + 5} y={11} fontSize={11} fill="#5ed3e6">Link lost {fmtClock(t0)}</text>
          <line x1={0} x2={iw} y1={y(s.cfg.firmMW)} y2={y(s.cfg.firmMW)} stroke="#e5765b" strokeDasharray="5 3" opacity={0.8} />
          <text x={iw - 2} y={y(s.cfg.firmMW) + 14} textAnchor="end" fontSize={11} fill="#e5765b">Firm limit {s.cfg.firmMW} MW</text>
          <path d={trip} fill="none" stroke="#d9365e" strokeWidth={2} strokeDasharray="6 4" />
          <text x={x(t0 + 6)} y={y(62)} fontSize={11} fill="#ef7f9b">Uncontrolled large-load trip (illustrative): all {Math.round(pre)} MW gone in under 1 s</text>
          <path d={run ?? ''} fill="none" stroke="#a9b0fe" strokeWidth={1.4} opacity={0.7} />
          <path d={bat ?? ''} fill="none" stroke="#6fd39a" strokeWidth={1.8} />
          <path d={ctl ?? ''} fill="none" stroke="#e6ecf7" strokeWidth={2.6} />
          {[-30, 0, 30, 60, 90, 120].map((d) => <text key={d} x={x(t0 + d)} y={ih + 16} textAnchor="middle" fontSize={11} fill="#9aa8c2" className="num">{d === 0 ? 'link lost' : `${d > 0 ? '+' : ''}${d} s`}</text>)}
          {nowIn && <line x1={x(t)} x2={x(t)} y1={0} y2={ih} stroke="#a9b0fe" strokeWidth={1.5} />}
        </g>
      </svg>
      <div className="legend-inline" style={{ paddingLeft: m.l }}>
        <span><i style={{ background: '#e6ecf7' }} />Grid sees (utility meter)</span>
        <span><i style={{ background: '#6fd39a' }} />Battery bridging</span>
        <span><i style={{ background: '#a9b0fe' }} />Site load (firm + flexible running)</span>
        <span><i style={{ background: 'transparent', border: '1.5px dashed #d9365e' }} />Uncontrolled trip</span>
      </div>
    </div>
  )
}
