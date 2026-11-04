import { useMemo, useState } from 'react'
import { FanChart } from '../charts/FanChart'
import { FLEET, HERO_ID } from '../config/scenario'
import { useWidth } from '../lib/useSize'
import { clampT } from '../lib/snapshot'
import { buildForecast, calibration, explain, FLEX_NEED, probBelow, stressSpans, type FcPoint } from '../sim/forecast'
import { fmtClock } from '../sim/time'
import { useStore } from '../store'

const dur = (s: number) => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() }

export function ForecasterTab() {
  const { tl, t } = useStore()
  const idx = FLEET.findIndex((s) => s.id === HERO_ID)
  const cfg = FLEET[idx]
  const origin = Math.floor(t / 900) * 900
  const fc = useMemo(() => buildForecast(tl, idx, origin), [tl, idx, origin])
  const spans = useMemo(() => stressSpans(fc, FLEX_NEED), [fc])
  const [sel, setSel] = useState<number | null>(null)
  const first = spans[0]
  const defaultSel = first ? first[0] : fc.reduce((a, p, i) => (p.p10 < fc[a].p10 ? i : a), 0)
  const si = Math.min(sel ?? defaultSel, fc.length - 1)
  const p = fc[si]
  const cal = useMemo(() => calibration(), [])

  // plain-language headline from the forecast itself
  const callouts: string[] = []
  spans.slice(0, 2).forEach(([a, b]) => {
    const worst = Math.max(...fc.slice(a, b + 1).map((q) => probBelow(q, FLEX_NEED)))
    const day = fc[a].u >= 86400 ? 'tomorrow ' : ''
    callouts.push(`P10 headroom falls below the ${FLEX_NEED} MW flexible demand ${day}${fmtClock(fc[a].u, false)}${fc[a].u < 86400 ? ` (in ${dur(fc[a].lead)})` : ''}, back above it by ${fmtClock(fc[Math.min(fc.length - 1, b + 1)].u, false)}. Likelihood of a shortfall ${Math.min(99, Math.round(worst * 100))}%.`)
  })

  const point = (q: FcPoint) => `${q.u >= 86400 ? 'tomorrow ' : ''}${fmtClock(q.u, false)}`
  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2>How much spare grid capacity will there be, and how sure are we?</h2>
        <p className="dim">Spare capacity above the {cfg.firmMW} MW firm limit at {cfg.name}&apos;s substation, every 15 minutes for the next 36 hours, as P10, P50 and P90. Dispatch plans on the cautious P10. All forecasts and inputs here are simulated.</p>
      </div>
      <div className="fc-grid">
        <section className="card">
          <h3>36-hour headroom forecast <small>from {fmtClock(origin, false)} · {tl.def.name} · simulated</small></h3>
          <div className="inspect num" aria-live="polite">
            <b>{point(p)}</b><span style={{ color: '#a9b0fe' }}>P10 {p.p10.toFixed(0)} MW</span><span>P50 {p.p50.toFixed(0)}</span><span className="dim">P90 {p.p90.toFixed(0)}</span>
            <span>plan: grid {p.gridFlex.toFixed(0)} · <span style={{ color: '#6fd39a' }}>battery {p.battery.toFixed(0)}</span> · <span style={{ color: '#9ca3af' }}>curtailed {p.curtailed.toFixed(0)}</span> MW</span>
            <span className="faint">{sel === null ? 'tap or click the chart to inspect' : <button className="linkish" onClick={() => setSel(null)}>reset</button>}</span>
          </div>
          <FanChart fc={fc} need={FLEX_NEED} sel={si} onSel={setSel} />
        </section>
        <div className="stack">
          <section className="card">
            <h3>What the forecaster expects</h3>
            {callouts.length === 0 ? <p className="dim" style={{ margin: 0 }}>P10 stays above the flexible demand for the next 36 hours. Flexible jobs run on grid headroom throughout.</p> : (
              <ul className="plain">{callouts.map((c) => <li key={c}>{c}</li>)}</ul>
            )}
            <div className="kv num" style={{ marginTop: 8 }}><span>Plan at the selected time</span><span>{point(p)}</span></div>
            <div className="kv num"><span>Flexible on grid headroom</span><span style={{ color: '#a9b0fe' }}>{p.gridFlex.toFixed(0)} MW</span></div>
            <div className="kv num"><span>Battery covers</span><span style={{ color: '#6fd39a' }}>{p.battery.toFixed(0)} of {cfg.battery.mw} MW</span></div>
            <div className="kv num"><span>Curtailed (training checkpoints)</span><span style={{ color: '#9ca3af' }}>{p.curtailed.toFixed(0)} MW</span></div>
            <div className="kv num"><span>Inference and firm load</span><span style={{ color: 'var(--firm)' }}>{cfg.firmMW} MW, never touched</span></div>
          </section>
          <Explain tl={tl} idx={idx} p={p} />
        </div>
        <Calibration cal={cal} />
        <Inputs />
      </div>
    </div>
  )
}

function Explain({ tl, idx, p }: { tl: ReturnType<typeof useStore.getState>['tl']; idx: number; p: FcPoint }) {
  const e = useMemo(() => explain(tl, idx, p.u, p.p50), [tl, idx, p.u, p.p50])
  const max = Math.max(5, ...e.drivers.map((d) => Math.abs(d.delta)))
  return (
    <section className="card">
      <h3>Explain this forecast <small>top drivers of the P50 at {fmtClock(p.u, false)} · illustrative</small></h3>
      <div className="kv num"><span>Day-average headroom</span><span>{e.base.toFixed(0)} MW</span></div>
      <div className="drivers">
        {e.drivers.map((d) => (
          <div key={d.id} className="driver">
            <div className="dl"><span>{d.label}</span><span className="faint num">{d.value}</span></div>
            <div className="db"><i style={{ [d.delta >= 0 ? 'left' : 'right']: '50%', width: `${(Math.abs(d.delta) / max) * 50}%`, background: d.delta >= 0 ? '#6fd39a' : '#e5765b' }} /><b /></div>
            <span className="num dv" style={{ color: d.delta >= 0 ? '#a6e6c3' : '#f4b3a3' }}>{d.delta >= 0 ? '+' : '−'}{Math.abs(d.delta).toFixed(0)} MW</span>
          </div>
        ))}
      </div>
      <div className="kv num" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>Forecast P50 / cautious P10</span><span><b>{p.p50.toFixed(0)}</b> / <b style={{ color: '#a9b0fe' }}>{p.p10.toFixed(0)}</b> MW</span></div>
      <p className="faint" style={{ margin: '6px 0 0', fontSize: 12 }}>A real model would use attributions from the trained quantile gradient-boosting model (a Temporal Fusion Transformer later). These bars always add up to the forecast shown.</p>
    </section>
  )
}

function Calibration({ cal }: { cal: ReturnType<typeof calibration> }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const size = Math.min(w, 340)
  const m = { l: 34, r: 8, t: 8, b: 30 }
  const iw = size - m.l - m.r, ih = size - m.t - m.b
  const sx = (v: number) => v * iw, sy = (v: number) => (1 - v) * ih
  return (
    <section className="card">
      <h3>Is &quot;90% sure&quot; really 90%? <small>reliability of the quantiles · {cal.n.toLocaleString('en-US')} simulated 15-minute intervals</small></h3>
      <div ref={ref} style={{ display: 'grid', placeItems: 'center' }}>
        <svg width={size} height={size} role="img" aria-label="Reliability diagram: observed frequency against nominal quantile level">
          <g transform={`translate(${m.l},${m.t})`}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={0} x2={iw} y1={sy(v)} y2={sy(v)} stroke="#26324a" /><line x1={sx(v)} x2={sx(v)} y1={0} y2={ih} stroke="#26324a" /><text x={-6} y={sy(v) + 4} textAnchor="end" fontSize={10.5} fill="#9aa8c2" className="num">{Math.round(v * 100)}</text><text x={sx(v)} y={ih + 14} textAnchor="middle" fontSize={10.5} fill="#9aa8c2" className="num">{Math.round(v * 100)}</text></g>)}
            <path d={`M0,${sy(0)} L${sx(1)},${sy(1)}`} stroke="#6b7ea3" strokeDasharray="4 3" fill="none" />
            <path d={`M0,${sy(0.03)} L${sx(0.97)},${sy(1)} L${sx(1)},${sy(0.97)} L${sx(0.03)},${sy(0)} Z`} fill="#a9b0fe" opacity={0.08} />
            <polyline points={cal.points.map((p) => `${sx(p.nominal)},${sy(p.observed)}`).join(' ')} fill="none" stroke="#a9b0fe" strokeWidth={2} />
            {cal.points.map((p) => <circle key={p.nominal} cx={sx(p.nominal)} cy={sy(p.observed)} r={p.nominal === 0.1 ? 5 : 3.5} fill={p.nominal === 0.1 ? '#6fd39a' : '#a9b0fe'} stroke="#0b1220" />)}
            <text x={iw / 2} y={ih + 28} textAnchor="middle" fontSize={11} fill="#9aa8c2">forecast quantile level, %</text>
            <text transform={`translate(-26,${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#9aa8c2">share of actuals at or below, %</text>
          </g>
        </svg>
      </div>
      <p style={{ margin: '6px 0 0' }}>Actual headroom came in at or above the P10 forecast in <b className="num" style={{ color: 'var(--ok)' }}>{(cal.p10Coverage * 100).toFixed(1)}%</b> of intervals, against the Phase 0 target of 90% or better. The band is recalibrated against meter data.</p>
      <p className="faint" style={{ margin: '4px 0 0', fontSize: 12 }}>Simulated backtest, not real AES or MISO data.</p>
    </section>
  )
}

function Inputs() {
  const { tl, t } = useStore()
  const i = clampT(t)
  const rows: { label: string; unit: string; src: ArrayLike<number>; d: number; note: string }[] = [
    { label: 'Temperature', unit: '°F', src: tl.sys.temp, d: 0, note: 'weather feed' },
    { label: 'Wind', unit: 'mph', src: tl.sys.wind, d: 0, note: 'weather feed' },
    { label: 'MISO load forecast', unit: 'MW', src: tl.sys.loadFcst, d: 0, note: 'MISO day-ahead' },
    { label: 'MISO Indiana Hub price', unit: '$/MWh', src: tl.sys.lmp, d: 2, note: 'MISO day-ahead' },
    { label: 'Line rating (DLR) uplift', unit: '%', src: tl.sys.dlr, d: 1, note: 'AES Indiana DLR' },
    { label: 'MISO alert level', unit: '', src: tl.alert, d: 0, note: 'MISO operating alerts' },
  ]
  return (
    <section className="card">
      <h3>Model inputs and their recent values <small>last 6 hours · simulated</small></h3>
      <div className="inputs">
        {rows.map((r) => {
          const from = Math.max(0, i - 6 * 3600)
          const vals: number[] = []
          for (let k = from; k <= i; k += 600) vals.push(r.src[k])
          const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
          const pts = vals.map((v, k) => `${(k / Math.max(1, vals.length - 1)) * 70},${22 - ((v - lo) / span) * 20}`).join(' ')
          return (
            <div key={r.label} className="in-row">
              <div><span>{r.label}</span><span className="faint" style={{ display: 'block', fontSize: 11.5 }}>{r.note}</span></div>
              <svg width={70} height={24} aria-hidden><polyline points={pts} fill="none" stroke="#a9b0fe" strokeWidth={1.5} /></svg>
              <b className="num">{r.src[i].toFixed(r.d)}<small className="dim"> {r.unit}</small></b>
            </div>
          )
        })}
        <div className="in-row"><div><span>Time of day</span><span className="faint" style={{ display: 'block', fontSize: 11.5 }}>simulation clock</span></div><span /><b className="num">{fmtClock(t, false)}</b></div>
      </div>
    </section>
  )
}
