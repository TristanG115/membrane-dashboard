import { describe, expect, it } from 'vitest'
import { CANONICAL, ECON, ECON_DEFAULTS } from '../config/scenario'
import { breakEvenMonths, defaultInputs, heaTest, irr, marketRevenueM, netUpfront, npv, payback, runModel, sumFlow } from './model'

describe('upfront costs match the deck constants', () => {
  it('$48M gross - $14.4M ITC = $33.6M battery, + $2.4M integration = $36.0M', () => {
    const n = netUpfront(defaultInputs())
    expect(n.gross).toBeCloseTo(48, 6)
    expect(n.itc).toBeCloseTo(14.4, 6)
    expect(n.battery).toBeCloseTo(33.6, 6)
    expect(n.integration).toBeCloseTo(2.4, 6)
    expect(n.total).toBeCloseTo(36.0, 6)
  })
  it('battery cost is consistent with the canonical 40 MW / 160 MWh battery', () => {
    expect(CANONICAL.battery.mw).toBe(40)
    expect(CANONICAL.battery.mwh).toBe(160)
    expect(ECON_DEFAULTS.batteryGrossM / CANONICAL.battery.mwh).toBeCloseTo(0.3, 6) // $300/kWh
  })
  it('license is $360k/yr and event cost $50-70k', () => {
    expect(ECON_DEFAULTS.licenseK).toBe(360)
    expect(ECON_DEFAULTS.eventCostK).toBeGreaterThanOrEqual(50)
    expect(ECON_DEFAULTS.eventCostK).toBeLessThanOrEqual(70)
  })
  it('curtailment events follow the 85 stress hours per year in 4-hour events', () => {
    expect(ECON_DEFAULTS.eventsPerYr).toBe(Math.round(CANONICAL.stress.hoursPerYear / 4))
  })
  it('every assumption cites a source or is labelled a team assumption', () => {
    for (const a of ECON) { expect(a.source.length).toBeGreaterThan(3); if (a.kind === 'cited') expect(a.url).toBeTruthy() }
  })
})

describe('developer-owned model', () => {
  const r = runModel(defaultInputs(), 'developer')
  it('data center pays $36.0M at month 0', () => { expect(r.parties.dataCenter.upfront).toBeCloseTo(-36.0, 6) })
  it('Membrane receives the integration fee and license', () => {
    expect(r.parties.membrane.upfront).toBeCloseTo(2.4, 6)
    expect(sumFlow(r.flows.find((f) => f.id === 'license')!)).toBeCloseTo(0.36 * 5, 6)
  })
  it('AES U.S. Renewables & Power has no cash flows', () => { expect(r.parties.aesUSRP.total).toBe(0) })
  it('energizing months early pays back the $36M quickly', () => {
    expect(r.parties.dataCenter.npv).toBeGreaterThan(0)
    expect(r.parties.dataCenter.paybackMonths).toBeLessThan(12)
  })
  it('ratepayers receive the dividend share of AES Indiana margin', () => {
    const w = sumFlow(r.flows.find((f) => f.id === 'wires')!), d = sumFlow(r.flows.find((f) => f.id === 'dividend')!)
    expect(d / (w + d)).toBeCloseTo(0.25, 6)
  })
})

describe('AES-owned model', () => {
  const r = runModel(defaultInputs(), 'aes-owned')
  it('AES USRP funds the battery net of the ITC and the data center only the integration', () => {
    expect(r.parties.aesUSRP.upfront).toBeCloseTo(-33.6, 6)
    expect(r.parties.dataCenter.upfront).toBeCloseTo(-2.4, 6)
  })
  it('AES project IRR on the battery contract is a believable utility-scale return at the default payment', () => {
    const v = r.parties.aesUSRP.irr!
    expect(v).toBeGreaterThan(0.08)
    expect(v).toBeLessThan(0.14)
  })
  it('a higher payment raises AES IRR and lowers the data center NPV', () => {
    const hi = runModel({ ...defaultInputs(), tollPerKWMonth: 16 }, 'aes-owned')
    expect(hi.parties.aesUSRP.irr!).toBeGreaterThan(r.parties.aesUSRP.irr!)
    expect(hi.parties.dataCenter.npv).toBeLessThan(r.parties.dataCenter.npv)
  })
  it('market revenue is shared between AES and the data center and never created or lost', () => {
    const on = { ...defaultInputs(), arbOn: 1, capOn: 1, ancOn: 1 }
    const m = runModel(on, 'aes-owned')
    const total = sumFlow(m.flows.find((f) => f.id === 'miso')!) + sumFlow(m.flows.find((f) => f.id === 'miso-dc')!)
    expect(total).toBeCloseTo(marketRevenueM(on).total * 15, 6)
  })
})

describe('guardrails and maths helpers', () => {
  it('HEA 1007 test passes for developer-owned and AES-owned and fails for utility rate base', () => {
    const i = defaultInputs()
    expect(heaTest(i, 'developer').pass).toBe(true)
    expect(heaTest(i, 'aes-owned').pass).toBe(true)
    expect(heaTest(i, 'utility').pass).toBe(false)
  })
  it('irr solves npv = 0', () => {
    const cf = [-100, 30, 30, 30, 30, 30].flatMap((v, k) => (k === 0 ? [v] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, v]))
    const r = irr(cf)!
    expect(Math.abs(npv(cf, r))).toBeLessThan(1e-6)
    expect(r).toBeGreaterThan(0.15)
  })
  it('payback finds the month cumulative cash recovers', () => { expect(payback([-10, 4, 4, 4])).toBe(3) })
  it('break-even months early is small and falls as revenue per MW-month rises', () => {
    const lo = breakEvenMonths(defaultInputs(), 'developer')!
    const hi = breakEvenMonths({ ...defaultInputs(), revPerMWMonthK: 200 }, 'developer')!
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThan(lo)
  })
})
