import { area, line, scaleLinear } from 'd3'
import { useWidth } from '../lib/useSize'
import { stressSpans, type FcPoint } from '../sim/forecast'
import { fmtClock } from '../sim/time'

const H36 = 36 * 3600

/** 36-hour P10/P50/P90 headroom fan against the flexible demand, with stress shaded and the P10-based dispatch plan underneath. */
export function FanChart({ fc, need, sel, onSel, height = 330 }: { fc: FcPoint[]; need: number; sel: number | null; onSel: (i: number | null) => void; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const narrow = w < 520
  const m = { l: narrow ? 34 : 44, r: 12, t: 12, b: 26 }
  const stripH = 40
  const ih = height - m.t - m.b - stripH - 10
  const iw = w - m.l - m.r
  const x = scaleLinear([0, H36], [0, iw])
  const y = scaleLinear([0, 100], [ih, 0])
  const pt = (k: 'p10' | 'p50' | 'p90') => line<FcPoint>().x((p) => x(p.lead)).y((p) => y(p[k]))(fc) ?? ''
  const band = area<FcPoint>().x((p) => x(p.lead)).y0((p) => y(p.p10)).y1((p) => y(p.p90))(fc) ?? ''
  const spans = stressSpans(fc, need)
  const t0 = fc[0].u
  const midnight = Math.ceil(t0 / 86400) * 86400 - t0 // seconds until the next midnight (the "tomorrow" divider)
  const step = (fc[1]?.lead ?? 900)
  const cell = Math.max(1, x(step) - 0.5)
  const stripY = ih + 10
  const at = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.min(fc.length - 1, Math.max(0, Math.round(x.invert(e.clientX - r.left) / step)))
  }
  const ticks = Array.from({ length: narrow ? 4 : 7 }, (_, k) => k * (narrow ? 12 : 6) * 3600)
  const s = sel === null ? null : fc[sel]
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Headroom forecast fan chart, P10 P50 P90, 36 hours ahead, against the 50 megawatt flexible demand">
        <g transform={`translate(${m.l},${m.t})`}>
          {y.ticks(5).map((v) => <g key={v}><line x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="#26324a" /><text x={-8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9aa8c2" className="num">{v}</text></g>)}
          {!narrow && <text transform={`translate(-34,${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#9aa8c2">headroom above firm, MW</text>}
          {spans.map(([a, b], i) => <rect key={i} x={x(fc[a].lead)} width={Math.max(3, x(fc[b].lead) - x(fc[a].lead) + cell)} y={0} height={ih} fill="#e0633a" opacity={0.16} />)}
          <path d={band} fill="#a9b0fe" opacity={0.24} />
          <path d={pt('p90')} fill="none" stroke="#a9b0fe" strokeWidth={1} opacity={0.5} />
          <path d={pt('p50')} fill="none" stroke="#e6ecf7" strokeWidth={1.4} />
          <path d={pt('p10')} fill="none" stroke="#a9b0fe" strokeWidth={2.4} />
          <line x1={0} x2={iw} y1={y(need)} y2={y(need)} stroke="#e3c55b" strokeWidth={1.6} strokeDasharray="6 4" />
          <text x={iw - 4} y={y(need) - 6} textAnchor="end" fontSize={11.5} fill="#f0d77e" className="num">flexible demand {need} MW</text>
          {midnight > 0 && midnight < H36 && <g><line x1={x(midnight)} x2={x(midnight)} y1={0} y2={ih + stripH + 10} stroke="#6b7ea3" strokeDasharray="2 3" /><text x={x(midnight) + 5} y={11} fontSize={11} fill="#9aa8c2">tomorrow</text></g>}
          {ticks.map((l) => <text key={l} x={x(l)} y={ih + stripH + 24} textAnchor={l === 0 ? 'start' : l === H36 ? 'end' : 'middle'} fontSize={11} fill="#9aa8c2" className="num">{l === 0 && !narrow ? 'now ' : ''}{fmtClock(t0 + l, false)}</text>)}
          <g transform={`translate(0,${stripY})`}>
            {fc.slice(0, -1).map((p, i) => {
              const hh = (v: number) => (v / need) * stripH
              return (
                <g key={i} transform={`translate(${x(p.lead)},0)`}>
                  <rect width={cell} y={stripH - hh(p.gridFlex)} height={hh(p.gridFlex)} fill="#a9b0fe" />
                  <rect width={cell} y={stripH - hh(p.gridFlex + p.battery)} height={hh(p.battery)} fill="#6fd39a" />
                  <rect width={cell} y={0} height={hh(p.curtailed)} fill="#9ca3af" />
                </g>
              )
            })}
            <rect x={0} y={0} width={iw} height={stripH} fill="none" stroke="#26324a" />
          </g>
          {s && <g><line x1={x(s.lead)} x2={x(s.lead)} y1={-4} y2={ih + stripH + 10} stroke="#f0d77e" strokeWidth={1.5} strokeDasharray="3 3" /><circle cx={x(s.lead)} cy={y(s.p10)} r={4} fill="#0b1220" stroke="#a9b0fe" strokeWidth={2} /></g>}
          <rect x={0} y={-4} width={iw} height={ih + stripH + 20} fill="transparent" style={{ touchAction: 'pan-y', cursor: 'crosshair' }}
            onPointerDown={(e) => onSel(at(e))} onPointerMove={(e) => { if (e.pointerType === 'mouse' && e.buttons === 0) return; onSel(at(e)) }} />
        </g>
      </svg>
      <div className="legend-inline" style={{ paddingLeft: m.l }}>
        <span><i style={{ background: '#a9b0fe', height: 3, marginTop: 4 }} />P10 (dispatch uses this)</span>
        <span><i style={{ background: '#e6ecf7', height: 2, marginTop: 4 }} />P50</span>
        <span><i style={{ background: 'rgba(169,176,254,0.3)' }} />P10 to P90 band</span>
        <span><i style={{ background: 'rgba(224,99,58,0.4)' }} />P10 below flexible demand</span>
        <span><i style={{ background: '#6fd39a' }} />Plan: battery</span>
        <span><i style={{ background: '#9ca3af' }} />Plan: curtailed</span>
      </div>
    </div>
  )
}
