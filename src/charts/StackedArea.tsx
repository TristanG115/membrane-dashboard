import { area, line, scaleLinear } from 'd3'
import { useMemo } from 'react'
import { ALERTS } from '../config/scenario'
import { useWidth } from '../lib/useSize'
import { clampT } from '../lib/snapshot'
import type { Timeline } from '../sim/types'

const STEP = 60
const N = 1440
const LAYERS = [
  { key: 'firm', label: 'Firm', color: '#e5765b', fill: '#b34a31' },
  { key: 'grid', label: 'Flexible on grid headroom', color: '#a9b0fe', fill: '#a9b0fe' },
  { key: 'chg', label: 'Deferred to charge battery', color: '#6fd39a', fill: 'url(#hatch)' },
  { key: 'bat', label: 'Battery discharge', color: '#6fd39a', fill: '#4fb87f' },
  { key: 'cur', label: 'Curtailed', color: '#9ca3af', fill: '#9ca3af' },
] as const

/** Live stress-day chart: firm, flexible, battery and curtailed MW stacked against the grid limit (firm + headroom). */
export function StackedArea({ tl, idx, t, height = 290 }: { tl: Timeline; idx: number; t: number; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const s = tl.sites[idx]
  const m = { l: 40, r: 14, t: 10, b: 38 }
  const iw = w - m.l - m.r, ih = height - m.t - m.b
  const total = s.cfg.firmMW + s.cfg.flexMW
  const data = useMemo(() => {
    const rows = []
    for (let k = 0; k < N; k++) {
      const u = k * STEP
      const firm = s.cfg.firmMW, grid = s.g[u], chg = s.chg[u], bat = s.b[u], cur = s.curtailed[u]
      rows.push({ u, firm, grid, chg, bat, cur, limit: Math.min(total * 1.12, firm + s.p10[u]) })
    }
    return rows
  }, [s, total])
  const x = scaleLinear([0, 86400], [0, iw])
  const y = scaleLinear([0, total * 1.12], [ih, 0])
  const stacks = useMemo(() => {
    let base = data.map(() => 0)
    return LAYERS.map((L) => {
      const lo = base
      const hi = data.map((d, i) => lo[i] + d[L.key])
      base = hi
      return { L, path: area<number>().x((_, i) => x(data[i].u)).y0((_, i) => y(lo[i])).y1((_, i) => y(hi[i]))(Array.from(data, (_, i) => i)) }
    })
  }, [data, iw, ih])
  const limitPath = line<(typeof data)[number]>().x((d) => x(d.u)).y((d) => y(d.limit))(data)
  // stress: where the P10 headroom is below the site's flexible need
  const stress: [number, number][] = []
  let st = -1
  data.forEach((d, i) => { const low = s.p10[d.u] < s.cfg.flexMW; if (low && st < 0) st = d.u; if ((!low || i === data.length - 1) && st >= 0) { stress.push([st, d.u]); st = -1 } })
  // active rung strip
  const rung: { u: number; c: string }[] = []
  for (let k = 0; k < N; k++) { const u = k * STEP; const c = s.state[u]; rung.push({ u, c: ['#a9b0fe', '#e3c55b', '#6fd39a', '#9ca3af', '#e5765b', '#5ed3e6', '#8fa3c8', '#5b6b88'][c] }) }
  const nowX = x(clampT(t))
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Stacked area chart of firm, flexible, battery and curtailed megawatts against the grid limit">
        <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#2f6e4d" /><line x1="0" y1="0" x2="0" y2="6" stroke="#6fd39a" strokeWidth="2" /></pattern></defs>
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(5).map((v) => <g key={v}><line x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="#26324a" /><text x={-8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9aa8c2" className="num">{v}</text></g>)}
          {stacks.map(({ L, path }) => <path key={L.key} d={path ?? ''} fill={L.fill} opacity={L.key === 'firm' ? 0.95 : 0.95} />)}
          {stress.map(([a, b], i) => <rect key={i} x={x(a)} width={Math.max(2, x(b) - x(a))} y={0} height={ih} fill="#e0633a" opacity={0.16} />)}
          <path d={limitPath ?? ''} fill="none" stroke="#e6ecf7" strokeWidth={1.6} strokeDasharray="5 3" />
          <text x={iw - 4} y={y(total) - 6} textAnchor="end" fontSize={11} fill="#e6ecf7">Grid limit = firm + P10 headroom</text>
          <line x1={0} x2={iw} y1={y(s.cfg.firmMW)} y2={y(s.cfg.firmMW)} stroke="#0b1220" strokeWidth={1} opacity={0.5} />
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <text key={h} x={x(h * 3600)} y={ih + 15} textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'} fontSize={11} fill="#9aa8c2" className="num">{String(h).padStart(2, '0')}:00</text>)}
          <g transform={`translate(0,${ih + 22})`}>
            {rung.map((r, i) => <rect key={i} x={x(r.u)} width={iw / N + 0.6} height={5} fill={r.c} />)}
            {ALERTS && tl.alert && Array.from({ length: N }, (_, k) => k).filter((k) => tl.alert[k * STEP] >= 1).map((k) => <rect key={k} x={x(k * STEP)} y={7} width={iw / N + 0.6} height={3} fill={ALERTS[tl.alert[k * STEP]].color} />)}
          </g>
          <line x1={nowX} x2={nowX} y1={-4} y2={ih + 12} stroke="#e6ecf7" strokeWidth={1.5} />
        </g>
      </svg>
      <div className="legend-inline" style={{ paddingLeft: m.l }}>
        {LAYERS.map((L) => <span key={L.key}><i style={{ background: L.fill === 'url(#hatch)' ? 'repeating-linear-gradient(45deg,#2f6e4d,#2f6e4d 2px,#6fd39a 2px,#6fd39a 4px)' : L.fill }} />{L.label}</span>)}
        <span><i style={{ background: 'transparent', border: '1.5px dashed #e6ecf7' }} />Grid limit</span>
        <span><i style={{ background: 'rgba(224,99,58,0.35)' }} />P10 below flexible need</span>
      </div>
    </div>
  )
}
