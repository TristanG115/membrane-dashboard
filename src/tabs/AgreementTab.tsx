import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { area, line, scaleLinear } from 'd3'
import { useMemo, useState } from 'react'
import { CANONICAL, CONTRACT, EVIDENCE, FLEET, HERO_ID } from '../config/scenario'
import { useWidth } from '../lib/useSize'
import { clampT } from '../lib/snapshot'
import { useStore } from '../store'

const HOURS = 8760
/** Number of nines in an availability fraction, e.g. 0.99999 -> 5. */
const nines = (a: number) => (a >= 1 ? 6 : Math.min(6, -Math.log10(1 - a)))
const pct = (a: number, d = 3) => `${(a * 100).toFixed(d)}%`

export function AgreementTab() {
  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2>Why would a hyperscaler give up five nines, and for how long?</h2>
        <p className="dim">It does not give up five nines for the firm load. It trades a small, capped amount of time on capacity it would not otherwise have, for a limited number of years. Everything on this page is simulated and illustrative, except the cited public examples.</p>
      </div>
      <div className="agree-grid">
        <Evidence />
        <KeepPanel />
        <Availability />
        <Contract />
      </div>
    </div>
  )
}

function Evidence() {
  return (
    <section className="card span-all">
      <h3>Hyperscalers and their partners already trade flexibility for capacity <small>how we reached this conclusion · public sources read 4 Nov 2026</small></h3>
      <div className="evid">
        {EVIDENCE.map((e) => (
          <article key={e.id}>
            <div className="who">{e.who}</div>
            <p>{e.what}</p>
            <div className="meta"><span className="num">{e.when}</span> · <a href={e.url} target="_blank" rel="noreferrer">{e.source}</a></div>
            <div className="caveat"><WarningCircle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{e.caveat}</div>
          </article>
        ))}
      </div>
    </section>
  )
}

function KeepPanel() {
  const items: [string, string][] = [
    ['Inference and revenue-critical work', `Sits entirely in the ${CANONICAL.firmMW} MW firm tier. The Membrane never touches it.`],
    ['On-site backup', 'The site keeps its generators and UPS exactly as designed. Nothing about them changes.'],
    ['What can be deferred', `Only AI training that would otherwise have no power at all: the ${CANONICAL.flexMW} MW above the utility study's firm limit. Jobs checkpoint and resume.`],
  ]
  return (
    <section className="card">
      <h3>What they do not give up</h3>
      <div className="keep">{items.map(([a, b]) => <div key={a}><CheckCircle size={18} weight="fill" color="var(--ok)" style={{ flex: 'none' }} /><div><b>{a}</b><span>{b}</span></div></div>)}</div>
    </section>
  )
}

function Availability() {
  const { tl, t } = useStore()
  const idx = FLEET.findIndex((s) => s.id === HERO_ID)
  const s = tl.sites[idx]
  const m = useMemo(() => {
    let interrupted = 0, curtailedSec = 0, curtailedMWs = 0
    for (let u = 0; u < 86400; u++) {
      if (s.gridDraw[u] < s.cfg.firmMW - 0.5) interrupted++
      if (s.curtailed[u] > 0.5) { curtailedSec++; curtailedMWs += s.curtailed[u] }
    }
    return { interrupted, avgCut: curtailedSec ? curtailedMWs / curtailedSec : CANONICAL.stress.curtailedMW, curtailedSec }
  }, [s])
  // so far today: energy-weighted flexible availability up to the sim clock
  const upTo = Math.max(1, clampT(t))
  let cutNow = 0
  for (let u = 0; u < upTo; u++) cutNow += s.curtailed[u]
  const flexToday = 1 - cutNow / (CANONICAL.flexMW * upTo)
  const firmHours = 1 - m.interrupted / 86400
  // annualized: the canonical 85 stress hours a year, at the average cut this simulation shows during curtailment
  const flexHoursA = 1 - CANONICAL.stress.hoursPerYear / HOURS
  const deferredPct = (CANONICAL.stress.hoursPerYear * m.avgCut) / (CANONICAL.requestedMW * HOURS)
  const flexEnergyA = 1 - (CANONICAL.stress.hoursPerYear * m.avgCut) / (CANONICAL.flexMW * HOURS)
  const FIRM_A = 0.99999
  const siteMW = (CANONICAL.firmMW * FIRM_A + CANONICAL.flexMW * flexEnergyA) / CANONICAL.requestedMW
  return (
    <section className="card">
      <h3>Availability by tier <small>recalculated from the running simulation · {tl.def.name}</small></h3>
      <div className="tiers">
        <div className="tier firm"><span className="k">Firm tier · {CANONICAL.firmMW} MW</span><span className="v num">{nines(FIRM_A).toFixed(0)} nines</span><span className="s num">{pct(FIRM_A)} design target, same as the utility. Simulated day: {m.interrupted === 0 ? '0 s interrupted' : `${m.interrupted} s interrupted`} ({pct(firmHours, 4)}).</span></div>
        <div className="tier flex"><span className="k">Flexible tier · {CANONICAL.flexMW} MW</span><span className="v num">about {pct(flexHoursA, 0)}</span><span className="s num">{nines(flexHoursA).toFixed(1)} nines of hours: curtailed about {CANONICAL.stress.hoursPerYear} h/yr, average cut {m.avgCut.toFixed(0)} MW. Today so far: {pct(flexToday, 1)} of flexible energy served.</span></div>
        <div className="tier site"><span className="k">Whole site · {CANONICAL.requestedMW} MW</span><span className="v num">{pct(flexHoursA, 1)} of hours at full {CANONICAL.requestedMW} MW</span><span className="s num">MW-weighted availability {pct(siteMW, 2)} · about {pct(deferredPct, 2)} of annual energy deferred.</span></div>
      </div>
      <div className="vs">
        <div><span className="dim">Without The Membrane</span><b className="num">0 MW</b><span className="dim">of that {CANONICAL.flexMW} MW until upgrades finish</span></div>
        <div className="arrow" aria-hidden>vs</div>
        <div><span className="dim">With The Membrane</span><b className="num" style={{ color: 'var(--flex)' }}>{CANONICAL.flexMW} MW at about {pct(flexHoursA, 0)}</b><span className="dim">starting now, inside limits the utility already studied</span></div>
      </div>
      <p className="faint" style={{ margin: '8px 0 0', fontSize: 12 }}>Stress hours per year: {CANONICAL.stress.hoursPerYear} ({CANONICAL.source}).</p>
    </section>
  )
}

function Contract() {
  const [term, setTerm] = useState(CONTRACT.termYears)
  const [cap, setCap] = useState(CONTRACT.curtailCapHours)
  const [notice, setNotice] = useState(CONTRACT.noticeHours)
  const [btm, setBtm] = useState(true)
  const [firm, setFirm] = useState<number[]>(CONTRACT.firmMW)
  const years = firm.length
  const rows = useMemo(() => firm.map((f, k) => {
    const grade = Math.min(CANONICAL.requestedMW, f + (btm ? CONTRACT.btmFirmEquivMW[k] : 0))
    const gap = CANONICAL.requestedMW - grade
    const inInterim = k < term
    const hours = inInterim ? CANONICAL.stress.hoursPerYear * (gap / CANONICAL.flexMW) : 0
    return { year: k + 1, grade, gap, flexible: inInterim ? gap : 0, uncovered: inInterim ? 0 : gap, hours, avail: 1 - hours / HOURS }
  }), [firm, btm, term])
  const fullYear = rows.find((r) => r.grade >= CANONICAL.requestedMW)?.year ?? null
  const overCap = rows.filter((r) => r.hours > cap)
  const gapAfter = rows.filter((r) => r.year > term && r.gap > 0)
  const [ref, w] = useWidth<HTMLDivElement>()
  const h = 262, m = { l: 44, r: 58, t: 26, b: 28 }
  const iw = w - m.l - m.r, ih = h - m.t - m.b
  const x = scaleLinear([0.5, years + 0.5], [0, iw])
  const y = scaleLinear([0, CANONICAL.requestedMW], [ih, 0])
  const yh = scaleLinear([0, Math.max(120, cap * 1.2)], [ih, 0])
  const bw = (iw / years) * 0.78
  return (
    <section className="card span-all">
      <h3>Contract builder and timeline <small>default: {CONTRACT.termYears}-year interim term while upgrades and behind-the-meter capacity are built, then full five nines</small></h3>
      <div className="contract">
        <div className="controls">
          <label className="slider"><span className="row" style={{ justifyContent: 'space-between' }}><span>Interim term</span><b className="num">{term} years</b></span><input type="range" min={1} max={CONTRACT.maxTermYears} value={term} onChange={(e) => setTerm(Number(e.target.value))} aria-label="Interim term in years" /><span className="faint" style={{ fontSize: 11.5 }}>SPP CHILLS allows up to {CONTRACT.maxTermYears} years.</span></label>
          <label className="slider"><span className="row" style={{ justifyContent: 'space-between' }}><span>Cap on curtailment hours per year</span><b className="num">{cap} h</b></span><input type="range" min={20} max={200} step={5} value={cap} onChange={(e) => setCap(Number(e.target.value))} aria-label="Curtailment cap in hours per year" /><span className="faint" style={{ fontSize: 11.5 }}>Written into the contract. SPP&apos;s tariff has no such cap.</span></label>
          <label className="slider"><span className="row" style={{ justifyContent: 'space-between' }}><span>Advance-notice guarantee</span></span>
            <select value={notice} onChange={(e) => setNotice(Number(e.target.value))} aria-label="Advance notice" className="sel">
              <option value={12}>12 hours</option><option value={24}>24 hours (day-ahead forecast)</option><option value={36}>36 hours (full forecast horizon)</option>
            </select>
          </label>
          <label className="sw-row toggle-row"><button type="button" className="toggle" role="switch" aria-checked={btm} aria-label="Behind-the-meter build-out" onClick={() => setBtm(!btm)} /><span>Behind-the-meter build-out (solar plus more storage)</span></label>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Utility firm MW by year, as upgrades finish</div>
          <div className="steps">{firm.map((v, k) => (
            <label key={k}><span className="faint">Y{k + 1}</span><input className="numin" type="number" min={CANONICAL.firmMW} max={CANONICAL.requestedMW} step={5} value={v} aria-label={`Firm MW in year ${k + 1}`} onChange={(e) => { const n = Math.max(CANONICAL.firmMW, Math.min(CANONICAL.requestedMW, Number(e.target.value) || CANONICAL.firmMW)); setFirm(firm.map((x, j) => (j === k ? n : x))) }} /></label>
          ))}</div>
        </div>
        <div>
          <div ref={ref}>
            <svg width={w} height={h} role="img" aria-label="Firm share of the 140 megawatts climbing year by year until full five nines">
              <g transform={`translate(${m.l},${m.t})`}>
                {y.ticks(4).map((v) => <g key={v}><line x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="#26324a" /><text x={-8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#9aa8c2" className="num">{v}</text></g>)}
                {rows.map((r) => {
                  const cx = x(r.year) - bw / 2
                  return (
                    <g key={r.year}>
                      <rect x={cx} y={y(r.grade)} width={bw} height={ih - y(r.grade)} fill="#b34a31" />
                      <rect x={cx} y={y(r.grade + r.flexible)} width={bw} height={y(r.grade) - y(r.grade + r.flexible)} fill="#a9b0fe" />
                      {r.uncovered > 0 && <rect x={cx} y={y(r.grade + r.uncovered)} width={bw} height={y(r.grade) - y(r.grade + r.uncovered)} fill="none" stroke="#e0633a" strokeDasharray="3 2" />}
                      <text x={x(r.year)} y={ih + 16} textAnchor="middle" fontSize={11} fill="#9aa8c2" className="num">Y{r.year}</text>
                      <text x={x(r.year)} y={y(r.grade) + 14} textAnchor="middle" fontSize={11} fill="#fff" className="num">{Math.round((r.grade / CANONICAL.requestedMW) * 100)}%</text>
                    </g>
                  )
                })}
                <line x1={x(term + 0.5)} x2={x(term + 0.5)} y1={0} y2={ih} stroke="#e6ecf7" strokeDasharray="4 3" />
                <text x={x(term + 0.5)} y={-8} textAnchor="middle" fontSize={11.5} fill="#e6ecf7">interim term ends</text>
                <path d={line<(typeof rows)[number]>().x((r) => x(r.year)).y((r) => yh(r.hours))(rows) ?? ''} fill="none" stroke="#e3c55b" strokeWidth={2} />
                {rows.map((r) => <circle key={r.year} cx={x(r.year)} cy={yh(r.hours)} r={3} fill="#e3c55b" />)}
                <line x1={0} x2={iw} y1={yh(cap)} y2={yh(cap)} stroke="#e3c55b" strokeDasharray="5 3" opacity={0.7} />
                <text x={iw + 6} y={yh(cap) + 4} fontSize={11} fill="#e3c55b" className="num">cap {cap} h</text>
                {yh.ticks(3).map((v) => <text key={v} x={iw + 6} y={yh(v) + 4} fontSize={10.5} fill="#a99a5a" className="num">{v} h</text>)}
                <path d={area<(typeof rows)[number]>().x((r) => x(r.year)).y0(ih).y1((r) => yh(r.hours))(rows) ?? ''} fill="#e3c55b" opacity={0.08} />
              </g>
            </svg>
          </div>
          <div className="legend-inline" style={{ paddingLeft: m.l }}>
            <span><i style={{ background: '#b34a31' }} />Firm-grade MW (five nines)</span><span><i style={{ background: '#a9b0fe' }} />Flexible MW (about 99%)</span>
            <span><i style={{ background: '#e3c55b' }} />Expected curtailment hours per year</span><span><i style={{ background: 'transparent', border: '1.5px dashed #e0633a' }} />Gap left after the term</span>
          </div>
          <Gantt years={years} utilityDone={firm.findIndex((f) => f >= CANONICAL.requestedMW) + 1 || years} term={term} btm={btm} fullYear={fullYear} w={w} m={m} />
          <ul className="checks">
            <li className={fullYear ? 'ok' : 'warn'}>{fullYear ? `Full ${CANONICAL.requestedMW} MW is firm-grade from year ${fullYear}.` : `The schedule never reaches ${CANONICAL.requestedMW} MW firm-grade. Raise a year or add behind-the-meter capacity.`}</li>
            <li className={gapAfter.length === 0 ? 'ok' : 'warn'}>{gapAfter.length === 0 ? `No curtailable capacity remains after the ${term}-year term.` : `${gapAfter[0].gap} MW is still not firm in year ${gapAfter[0].year}, after the term ends. Extend the term, up to ${CONTRACT.maxTermYears} years, or add behind-the-meter capacity.`}</li>
            <li className={overCap.length === 0 ? 'ok' : 'warn'}>{overCap.length === 0 ? `Expected curtailment stays under the ${cap}-hour cap every year (year 1: ${Math.round(rows[0].hours)} h).` : `Year ${overCap[0].year} expects ${Math.round(overCap[0].hours)} h, over the ${cap}-hour cap. Raise the cap or step firm MW up sooner.`}</li>
            <li className="ok">Day-ahead notice: the forecaster publishes P10/P50/P90 headroom {notice} hours ahead (it forecasts out to 36 hours).</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Gantt({ years, utilityDone, term, btm, fullYear, w, m }: { years: number; utilityDone: number; term: number; btm: boolean; fullYear: number | null; w: number; m: { l: number; r: number } }) {
  const iw = w - m.l - m.r
  const x = scaleLinear([0.5, years + 0.5], [0, iw])
  const lanes: { label: string; from: number; to: number; color: string; text: string }[] = [
    { label: 'Utility upgrades', from: 1, to: utilityDone, color: '#6f8ce6', text: 'firm MW steps up as upgrades finish' },
    ...(btm ? [{ label: 'Behind-the-meter build', from: 2, to: 5, color: '#58aab4', text: 'solar plus storage' }] : []),
    { label: 'Interim flexible service', from: 1, to: term, color: '#a9b0fe', text: `years 1-${term}, capped hours` },
    ...(fullYear ? [{ label: 'Full five nines, 140 MW', from: fullYear, to: years, color: '#e5765b', text: `from year ${fullYear}` }] : []),
  ]
  return (
    <svg width={w} height={lanes.length * 26 + 8} style={{ display: 'block', marginTop: 6 }} role="img" aria-label="Timeline of utility upgrades, behind-the-meter build, interim service and full firm service">
      <g transform={`translate(${m.l},4)`}>
        {lanes.map((l, i) => (
          <g key={l.label} transform={`translate(0,${i * 26})`}>
            <rect x={x(l.from - 0.5)} y={2} width={Math.max(6, x(l.to + 0.5) - x(l.from - 0.5))} height={20} rx={4} fill={l.color} opacity={0.92} />
            <text x={x(l.from - 0.5) + 8} y={16} fontSize={11.5} fill="#0b1220" fontWeight={600}>{l.label} <tspan fontWeight={400}>· {l.text}</tspan></text>
          </g>
        ))}
      </g>
    </svg>
  )
}
