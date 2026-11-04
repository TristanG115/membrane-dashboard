import { ArrowCounterClockwise, Lock } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { BreakEven } from '../charts/BreakEven'
import { Sankey, type SankeyLink, type SankeyNodeDef } from '../charts/Sankey'
import { CANONICAL, ECON, type Assumption } from '../config/scenario'
import { breakEvenMonths, dcNpvByMonths, heaTest, marketRevenueM, PARTIES, PARTY_LABEL, runModel, sumFlow, type Ownership, type Party } from '../economics/model'
import { fmtM, fmtMonths, fmtPct } from '../lib/money'
import { useStore } from '../store'

const OWN: { id: Ownership; title: string; line: string }[] = [
  { id: 'developer', title: 'Developer-owned', line: 'The data center funds the battery and The Membrane. AES Indiana earns wires revenue. This is our current deck.' },
  { id: 'aes-owned', title: 'AES-owned, sold as a service', line: 'AES U.S. Renewables & Power builds, owns and runs the battery behind the meter and recovers its cost through a long-term payment from the data center.' },
  { id: 'utility', title: 'Utility-owned in rate base', line: 'Greyed out on purpose. Ratepayers would carry the battery, which is the cost-shift HEA 1007 is written to stop.' },
]
const NODES: SankeyNodeDef[] = [
  { id: 'dc-contracts', name: 'Data center · contracts', color: '#5b6b88' },
  { id: 'dc-bills', name: 'Data center · utility bills', color: '#5b6b88' },
  { id: 'miso', name: 'MISO markets', color: '#5b6b88' },
  { id: 'treasury', name: 'U.S. Treasury (§48E)', color: '#5b6b88' },
  { id: 'aesIndiana', name: 'AES Indiana', color: '#6f8ce6' },
  { id: 'aesUSRP', name: 'AES U.S. Renewables & Power', color: '#58aab4' },
  { id: 'dataCenter', name: 'Data center', color: '#d4defc' },
  { id: 'ratepayers', name: 'Ratepayers', color: '#b58de0' },
  { id: 'membrane', name: 'The Membrane', color: '#4f6fd6' },
]
const LINK_STYLE: Record<string, { label: string; color: string }> = {
  toll: { label: 'Storage-as-a-service payment', color: '#58aab4' },
  itc: { label: '§48E ITC (one time)', color: '#e3c55b' },
  miso: { label: 'MISO market revenue (potential)', color: '#6fd39a' },
  'miso-dc': { label: 'MISO market revenue (potential)', color: '#6fd39a' },
  wires: { label: 'Wires and energy sales', color: '#8aa2e6' },
  license: { label: 'Membrane license and integration', color: '#4f6fd6' },
  integration: { label: 'Membrane license and integration', color: '#4f6fd6' },
  dividend: { label: 'Utilization dividend', color: '#b58de0' },
}
const STREAM_NAME: Record<string, string> = {
  capex: 'Battery purchase and build', itc: '§48E ITC', integration: 'Membrane integration fee', license: 'Membrane software license', deferred: 'Deferred compute (curtailed training)',
  om: 'Battery O&M', toll: 'Contract payment from the offtaker', miso: 'MISO market revenue to the battery owner', 'miso-dc': 'MISO market revenue shared to the data center', early: 'Operating margin from energizing early',
  avoided: 'Avoided on-site gas or diesel', wires: 'Wires and energy sales to AES Indiana', dividend: 'Utilization dividend to ratepayers',
}

export function EconomicsTab() {
  const { econ, setEcon, resetEcon, ownership, setOwnership } = useStore()
  const [view, setView] = useState<'y1' | 'total'>('y1')
  const res = useMemo(() => runModel(econ, ownership as Exclude<Ownership, 'utility'>), [econ, ownership])
  const dev = useMemo(() => ({ pts: dcNpvByMonths(econ, 'developer', 48), be: breakEvenMonths(econ, 'developer') }), [econ])
  const aes = useMemo(() => ({ pts: dcNpvByMonths(econ, 'aes-owned', 48), be: breakEvenMonths(econ, 'aes-owned') }), [econ])
  const mk = marketRevenueM(econ)
  const heas = { developer: heaTest(econ, 'developer'), 'aes-owned': heaTest(econ, 'aes-owned'), utility: heaTest(econ, 'utility') }
  const hea = heas[ownership]
  const nu = res.netUpfront
  const usrp = res.parties.aesUSRP

  const links: SankeyLink[] = res.flows
    .filter((f) => LINK_STYLE[f.id])
    .map((f) => ({ source: f.src, target: f.dst, value: sumFlow(f, 0, 12), label: LINK_STYLE[f.id].label, color: LINK_STYLE[f.id].color }))
    .filter((l) => l.value > 0.005)

  const cell = (p: Party, id: string) => {
    const f = res.flows.find((x) => x.id === id)!
    const v = (view === 'y1' ? sumFlow(f, 0, 12) : sumFlow(f)) * (f.payee === p ? 1 : f.payer === p ? -1 : 0)
    return v
  }
  const rows = res.flows.map((f) => f.id)
  const totals = (p: Party) => rows.reduce((a, id) => a + cell(p, id), 0)
  const dividendTotal = sumFlow(res.flows.find((f) => f.id === 'dividend')!)

  return (
    <div className="page">
      <div className="econ-head">
        <div>
          <h2>What is the return, and how does AES make money?</h2>
          <p className="dim">Pick who owns the battery. Every number below recomputes, from the 140 MW case ({CANONICAL.firmMW} MW firm, {CANONICAL.flexMW} MW flexible, {CANONICAL.battery.mw} MW / {CANONICAL.battery.mwh} MWh battery). All figures are simulated and illustrative: team assumptions are labelled, and sources are linked.</p>
        </div>
        <button className="ghost" onClick={resetEcon} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap' }}><ArrowCounterClockwise size={14} /> Reset assumptions</button>
      </div>

      <div className="own-cards" role="radiogroup" aria-label="Ownership model">
        {OWN.map((o) => {
          const off = o.id === 'utility'
          const on = ownership === o.id
          return (
            <button key={o.id} role="radio" aria-checked={on} aria-disabled={off} disabled={off} className={`own ${on ? 'on' : ''} ${off ? 'off' : ''}`} onClick={() => { if (o.id !== 'utility') setOwnership(o.id) }}>
              <b>{off && <Lock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />}{o.title}</b>
              <span>{o.line}</span>
              {off && <span className="own-note">Rate base would fund {fmtM(heas.utility.ratepayerFunded)} of {fmtM(heas.utility.allocable)}: only {fmtPct(heas.utility.coverage, 0)} data-center cost coverage against an 80% test.</span>}
            </button>
          )
        })}
      </div>

      <div className="econ-cols">
        <div className="stack">
        <section className="card">
          <h3>Return by party <small>{ownership === 'aes-owned' ? 'AES-owned, sold as a service' : 'Developer-owned'} · {econ.horizonYears}-year horizon · {econ.discountPct}% discount rate</small></h3>
          {ownership === 'aes-owned' && (
            <div className="hero-irr">
              <div><span className="num big">{fmtPct(usrp.irr)}</span><span className="dim"> AES project IRR on the battery contract</span></div>
              <div className="dim">AES U.S. Renewables & Power pays {fmtM(nu.battery)} net of the ITC ({fmtM(nu.gross)} gross) and receives {fmtM((econ.tollPerKWMonth * 40000 * 12) / 1e6, 2)} a year from the data center at ${econ.tollPerKWMonth.toFixed(2)}/kW-month. Pre-tax, unlevered, no residual value.</div>
            </div>
          )}
          <table className="tbl">
            <thead><tr><th>Party</th><th className="r">Upfront</th><th className="r">NPV</th><th className="r">IRR</th><th>Payback</th></tr></thead>
            <tbody>
              {PARTIES.map((p) => {
                const r = res.parties[p]
                const idle = Math.abs(r.total) < 1e-6
                return (
                  <tr key={p} className={idle ? 'idle' : ''}>
                    <td style={{ fontWeight: 500 }}>{PARTY_LABEL[p]}</td>
                    {idle ? <td colSpan={4} className="dim">Not part of this ownership model</td> : (
                      <>
                        <td className="r num">{fmtM(r.upfront)}</td>
                        <td className="r num" style={{ color: r.npv < 0 ? 'var(--firm)' : 'var(--text)' }}>{fmtM(r.npv)}</td>
                        <td className="r num">{r.irr === null ? <span className="dim">n/a</span> : fmtPct(r.irr)}</td>
                        <td className="num">{fmtMonths(r.paybackMonths)}</td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="faint" style={{ margin: '8px 0 0', fontSize: 12 }}>IRR is n/a where a party never puts capital in. Net upfront for the deal: {fmtM(nu.gross)} gross battery {'−'} {fmtM(nu.itc)} ITC = {fmtM(nu.battery)}, plus {fmtM(nu.integration)} Membrane integration = {fmtM(nu.total)}.</p>
        </section>

        <section className="card">
          <h3>Cash flows beyond rate revenue <small>year 1 including one-time items, $M · {ownership === 'aes-owned' ? 'AES-owned' : 'developer-owned'}</small></h3>
          <Sankey nodes={NODES} links={links} height={330} />
        </section>

        <section className="card">
          <h3>How many months early does this need to be worth it? <small>data center NPV · break-even</small></h3>
          <BreakEven months={econ.monthsEarly} series={[
            { id: 'dev', label: 'Developer-owned', color: '#e3c55b', points: dev.pts, breakEven: dev.be },
            { id: 'aes', label: 'AES-owned, sold as a service', color: '#58aab4', dash: '5 3', points: aes.pts, breakEven: aes.be },
          ]} />
          <p className="dim" style={{ margin: '6px 0 0' }}>{(ownership === 'developer' ? dev.be : aes.be) === null ? 'No break-even inside 10 years at these inputs.' : <>At these inputs the data center breaks even if the site is energized about <b className="num" style={{ color: 'var(--text)' }}>{(ownership === 'developer' ? dev.be : aes.be)!.toFixed(1)} months</b> sooner than firm-only service. Anything longer is upside.</>}</p>
        </section>

        </div>
        <div className="stack">
        <section className="card">
          <h3>Return levers</h3>
          <Slider a={byId('monthsEarly')} value={econ.monthsEarly} onChange={(v) => setEcon({ monthsEarly: v })} />
          <Slider a={byId('revPerMWMonthK')} value={econ.revPerMWMonthK} onChange={(v) => setEcon({ revPerMWMonthK: v })} />
          <Slider a={byId('discountPct')} value={econ.discountPct} onChange={(v) => setEcon({ discountPct: v })} />
          <Slider a={byId('tollPerKWMonth')} value={econ.tollPerKWMonth} onChange={(v) => setEcon({ tollPerKWMonth: v })} disabled={ownership !== 'aes-owned'} />
          <h3 style={{ marginTop: 14 }}>Battery value outside stress hours <small>potential, subject to MISO/IURC rules</small></h3>
          {([['arbOn', 'Energy arbitrage', mk.arb || (econ.arbKWYr * 40000) / 1e6], ['capOn', 'Capacity accreditation', (40 * (econ.accredPct / 100) * econ.praPerMWDay * 365) / 1e6], ['ancOn', 'Ancillary services', (econ.ancKWYr * 40000) / 1e6]] as const).map(([k, label, v]) => (
            <label key={k} className="sw-row toggle-row">
              <button type="button" className="toggle" role="switch" aria-checked={!!econ[k]} onClick={() => setEcon({ [k]: econ[k] ? 0 : 1 })} aria-label={label} />
              <span>{label}</span><span className="num dim" style={{ marginLeft: 'auto' }}>{fmtM(v, 2)}/yr</span>
            </label>
          ))}
          <p className="faint" style={{ margin: '6px 0 0', fontSize: 12 }}>Off by default. Selling in these markets must never reduce the battery&apos;s stress-day duty.</p>
        </section>

        <section className="card">
          <h3>Where the money goes <small>why this is not only a rates story</small></h3>
          <ul className="plain">
            <li><b>Offtaker payments.</b> {ownership === 'aes-owned' ? 'The data center pays AES for storage as a service, so it swaps upfront capex for a monthly payment.' : 'In this model the data center funds the battery itself, so there is no contract payment.'}</li>
            <li><b>Tax credit.</b> The {fmtM(nu.itc)} §48E credit goes to the owner: {ownership === 'aes-owned' ? 'AES U.S. Renewables & Power' : 'the data center'}.</li>
            <li><b>Markets.</b> MISO revenue outside stress hours is a toggle above and is labelled potential.</li>
            <li><b>Wires and energy.</b> AES Indiana earns margin on load that connects sooner.</li>
            <li><b>Ratepayers.</b> {fmtM(dividendTotal)} of utilization dividend over the early-service period.</li>
          </ul>
        </section>

        <section className="card">
          <h3>Guardrails <small>HEA 1007 80% cost-coverage test</small></h3>
          <div className={`verdict ${hea.pass ? 'pass' : 'fail'}`}>{hea.pass ? 'Passes' : 'Fails'} · {fmtPct(hea.coverage, 0)} covered by the data center</div>
          <div className="covbar" aria-label={`Data center covers ${Math.round(hea.coverage * 100)} percent of allocable cost`}>
            <i style={{ width: `${Math.min(100, hea.coverage * 100)}%`, background: hea.pass ? 'var(--ok)' : 'var(--firm)' }} />
            <span style={{ left: `${hea.threshold * 100}%` }} title="80% threshold" />
          </div>
          <div className="kv num"><span>Allocable project cost</span><span>{fmtM(hea.allocable)}</span></div>
          <div className="kv num"><span>Paid by the data center</span><span>{fmtM(hea.dcPaid)}</span></div>
          <div className="kv num"><span>Left to ratepayers</span><span>{fmtM(hea.ratepayerFunded)}</span></div>
          <div className="kv num"><span>Utilization dividend to ratepayers</span><span style={{ color: '#b58de0' }}>{fmtM(dividendTotal)}</span></div>
          <p className="faint" style={{ margin: '8px 0 0', fontSize: 12 }}>For comparison, utility-owned rate base scores {fmtPct(heas.utility.coverage, 0)} and fails. {'†'}{' '}
            <a href={ECON.find((a) => a.id === 'heaThresholdPct')!.url} target="_blank" rel="noreferrer">Source on the 80% test</a>.</p>
        </section>

        </div>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Annual cash by party and stream <small>{'−'} = party pays · $M</small></h3>
            <div className="seg" role="group" aria-label="Period"><button aria-pressed={view === 'y1'} onClick={() => setView('y1')}>Year 1</button><button aria-pressed={view === 'total'} onClick={() => setView('total')}>{econ.horizonYears}-year total</button></div>
          </div>
          <div className="scroll-x">
            <table className="tbl cash">
              <thead><tr><th>Stream</th>{PARTIES.map((p) => <th key={p} className="r">{PARTY_LABEL[p]}</th>)}</tr></thead>
              <tbody>
                {rows.map((id) => (
                  <tr key={id}><td>{STREAM_NAME[id]}</td>{PARTIES.map((p) => { const v = cell(p, id); return <td key={p} className="r num" style={{ color: Math.abs(v) < 0.005 ? 'var(--text-faint)' : v < 0 ? 'var(--firm)' : 'var(--text)' }}>{Math.abs(v) < 0.005 ? '–' : fmtM(v, 2)}</td> })}</tr>
                ))}
                <tr className="total"><td>Net</td>{PARTIES.map((p) => <td key={p} className="r num">{fmtM(totals(p), 2)}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Assumptions <small>every input is editable · defaults shown · each cites a source or is a team assumption</small></h3>
          </div>
          <div className="scroll-x">
            <table className="tbl assump">
              <thead><tr><th>Input</th><th style={{ width: 130 }}>Value</th><th style={{ width: 90 }}>Default</th><th style={{ width: 120 }}>Basis</th><th>Source</th></tr></thead>
              <tbody>
                {ECON.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    <td><input className="numin" type="number" inputMode="decimal" value={econ[a.id]} min={a.min} max={a.max} step={a.step} aria-label={a.label} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setEcon({ [a.id]: v }) }} /> <span className="dim">{a.unit}</span></td>
                    <td className="num dim">{a.value}</td>
                    <td><span className={`tag ${a.kind}`}>{a.kind === 'deck' ? 'Deck' : a.kind === 'cited' ? 'Cited' : 'Team assumption'}</span></td>
                    <td className="dim">{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.source}</a> : a.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ margin: '8px 0 0', fontSize: 12 }}>Simplifications: pre-tax, no depreciation shield, no residual value, ITC received at month 0. Sources were read on 4 Nov 2026; trade-press summaries are named as such. Nothing here is AES or MISO operational data.</p>
        </section>
      </div>
    </div>
  )
}

const byId = (id: string): Assumption => ECON.find((a) => a.id === id)!

function Slider({ a, value, onChange, disabled }: { a: Assumption; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={`slider ${disabled ? 'off' : ''}`}>
      <span className="row" style={{ justifyContent: 'space-between' }}><span>{a.label}</span><b className="num">{a.unit.startsWith('$') ? `$${value}${a.unit.slice(1)}` : a.unit === '%' ? `${value}%` : `${value} ${a.unit}`}</b></span>
      <input type="range" min={a.min} max={a.max} step={a.step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={a.label} />
    </label>
  )
}
