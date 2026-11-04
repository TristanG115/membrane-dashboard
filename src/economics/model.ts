// Pure economics model for the 140 MW case. No React, no randomness: the same inputs always give the same numbers.
// Monthly cash flows ($M) per stream; every party's view is a sum over those streams. Every default comes from
// ECON in config/scenario.ts. Simplifications (stated in the UI): pre-tax, no depreciation shield, no residual value,
// ITC received at month 0.
import { CANONICAL, ECON_DEFAULTS } from '../config/scenario'

export type Ownership = 'developer' | 'aes-owned' | 'utility'
export type Party = 'aesIndiana' | 'aesUSRP' | 'dataCenter' | 'ratepayers' | 'membrane'
export const PARTIES: Party[] = ['aesIndiana', 'aesUSRP', 'dataCenter', 'ratepayers', 'membrane']
export const PARTY_LABEL: Record<Party, string> = {
  aesIndiana: 'AES Indiana', aesUSRP: 'AES U.S. Renewables & Power', dataCenter: 'Data center', ratepayers: 'Ratepayers', membrane: 'The Membrane',
}
export type Inputs = Record<string, number>
export const defaultInputs = (): Inputs => ({ ...ECON_DEFAULTS, arbOn: 0, capOn: 0, ancOn: 0 })

export interface Flow {
  id: string
  label: string
  /** Sankey node the money leaves and the node it reaches. */
  src: string
  dst: string
  payer: Party | null
  payee: Party | null
  m: Float64Array // $M by month, index 0..N (month 0 = upfront)
  oneTime?: boolean
}

export interface PartyResult { npv: number; irr: number | null; paybackMonths: number | null; total: number; upfront: number; cf: Float64Array }
export interface HeaResult { coverage: number; threshold: number; pass: boolean; dcPaid: number; allocable: number; ratepayerFunded: number }
export interface ModelResult { ownership: Ownership; months: number; flows: Flow[]; parties: Record<Party, PartyResult>; hea: HeaResult; netUpfront: { gross: number; itc: number; battery: number; integration: number; total: number } }

export const BATTERY_KW = CANONICAL.battery.mw * 1000

export function marketRevenueM(i: Inputs) {
  const arb = i.arbOn ? (i.arbKWYr * BATTERY_KW) / 1e6 : 0
  const cap = i.capOn ? (CANONICAL.battery.mw * (i.accredPct / 100) * i.praPerMWDay * 365) / 1e6 : 0
  const anc = i.ancOn ? (i.ancKWYr * BATTERY_KW) / 1e6 : 0
  return { arb, cap, anc, total: arb + cap + anc }
}

export function netUpfront(i: Inputs) {
  const gross = i.batteryGrossM
  const itc = gross * (i.itcRate / 100) * (i.itcRealization / 100)
  const battery = gross - itc
  return { gross, itc, battery, integration: i.integrationM, total: battery + i.integrationM }
}

export function heaTest(i: Inputs, own: Ownership): HeaResult {
  const n = netUpfront(i)
  const dcUp = i.upgradeM * (i.dcUpgradeSharePct / 100)
  const allocable = n.battery + n.integration + i.upgradeM
  const dcPaid = own === 'utility' ? dcUp : n.battery + n.integration + dcUp // AES-owned: the battery is recovered through the data center's contract payments
  const coverage = allocable > 0 ? dcPaid / allocable : 1
  return { coverage, threshold: i.heaThresholdPct / 100, pass: coverage >= i.heaThresholdPct / 100, dcPaid, allocable, ratepayerFunded: allocable - dcPaid }
}

export function npv(cf: ArrayLike<number>, annualRate: number): number {
  const rm = Math.pow(1 + annualRate, 1 / 12) - 1
  let v = 0
  for (let m = 0; m < cf.length; m++) v += cf[m] / Math.pow(1 + rm, m)
  return v
}
/** Annual IRR by bisection; null when the cash flows never change sign. Capped at 100,000%. */
export function irr(cf: ArrayLike<number>): number | null {
  let neg = false, pos = false
  for (let m = 0; m < cf.length; m++) { if (cf[m] < -1e-9) neg = true; if (cf[m] > 1e-9) pos = true }
  if (!neg || !pos) return null
  let lo = -0.95, hi = 1000
  if (npv(cf, hi) > 0) return hi
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (npv(cf, mid) > 0) lo = mid; else hi = mid }
  return (lo + hi) / 2
}
/** First month where cumulative cash turns non-negative after having been negative. 0 = never needed upfront capital. */
export function payback(cf: ArrayLike<number>): number | null {
  let cum = 0, wasNeg = false
  for (let m = 0; m < cf.length; m++) {
    cum += cf[m]
    if (cum < -1e-9) wasNeg = true
    else if (wasNeg) return m
  }
  return wasNeg ? null : 0
}

function span(months: number, from: number, to: number, perMonth: number) {
  const a = new Float64Array(months + 1)
  for (let m = Math.max(1, from); m <= Math.min(months, to); m++) a[m] = perMonth
  return a
}
const once = (months: number, v: number) => { const a = new Float64Array(months + 1); a[0] = v; return a }

export function runModel(i: Inputs, own: Exclude<Ownership, 'utility'>): ModelResult {
  const N = Math.round(i.horizonYears * 12)
  const interim = Math.round(i.interimYears * 12)
  const early = Math.round(i.monthsEarly)
  const owner: Party = own === 'developer' ? 'dataCenter' : 'aesUSRP'
  const nu = netUpfront(i)
  const mk = marketRevenueM(i)
  const flows: Flow[] = []
  const add = (f: Flow) => flows.push(f)

  add({ id: 'capex', label: 'Battery purchase and build', src: 'suppliers', dst: 'suppliers', payer: owner, payee: null, m: once(N, i.batteryGrossM), oneTime: true })
  add({ id: 'itc', label: 'Section 48E ITC', src: 'treasury', dst: owner, payer: null, payee: owner, m: once(N, nu.itc), oneTime: true })
  add({ id: 'integration', label: 'Membrane integration fee', src: 'dc-contracts', dst: 'membrane', payer: 'dataCenter', payee: 'membrane', m: once(N, i.integrationM), oneTime: true })
  add({ id: 'license', label: 'Membrane software license', src: 'dc-contracts', dst: 'membrane', payer: 'dataCenter', payee: 'membrane', m: span(N, 1, interim, i.licenseK / 1000 / 12) })
  add({ id: 'deferred', label: 'Deferred compute (curtailed training)', src: 'jobs', dst: 'jobs', payer: 'dataCenter', payee: null, m: span(N, 1, interim, (i.eventsPerYr * i.eventCostK) / 1000 / 12) })
  add({ id: 'om', label: 'Battery O&M', src: 'om', dst: 'om', payer: owner, payee: null, m: span(N, 1, N, (i.batteryGrossM * (i.omPct / 100)) / 12) })
  if (own === 'aes-owned') add({ id: 'toll', label: 'Storage-as-a-service payment', src: 'dc-contracts', dst: 'aesUSRP', payer: 'dataCenter', payee: 'aesUSRP', m: span(N, 1, N, (i.tollPerKWMonth * BATTERY_KW) / 1e6) })
  // market revenue outside stress hours, split between owner and (in the AES-owned model) the data center
  const share = own === 'aes-owned' ? i.aesSharePct / 100 : 1
  add({ id: 'miso', label: 'MISO market revenue (potential)', src: 'miso', dst: owner, payer: null, payee: owner, m: span(N, 1, N, (mk.total * share) / 12) })
  if (own === 'aes-owned') add({ id: 'miso-dc', label: 'MISO market revenue shared to data center', src: 'miso', dst: 'dataCenter', payer: null, payee: 'dataCenter', m: span(N, 1, N, (mk.total * (1 - share)) / 12) })
  // value of energizing early
  add({ id: 'early', label: 'Operating margin from energizing early', src: 'tenants', dst: 'dataCenter', payer: null, payee: 'dataCenter', m: span(N, 1, early, (i.itMW * i.revPerMWMonthK * (i.marginPct / 100)) / 1000) })
  add({ id: 'avoided', label: 'Avoided on-site gas or diesel', src: 'gas', dst: 'dataCenter', payer: null, payee: 'dataCenter', m: span(N, 1, early, i.avoidedGenM / 12) })
  const wiresMonthly = (i.itMW * (i.loadFactorPct / 100) * 730 * i.wiresPerMWh) / 1e6
  add({ id: 'wires', label: 'Wires and energy margin to AES Indiana', src: 'dc-bills', dst: 'aesIndiana', payer: null, payee: 'aesIndiana', m: span(N, 1, early, wiresMonthly * (1 - i.dividendPct / 100)) })
  add({ id: 'dividend', label: 'Utilization dividend to ratepayers', src: 'dc-bills', dst: 'ratepayers', payer: null, payee: 'ratepayers', m: span(N, 1, early, wiresMonthly * (i.dividendPct / 100)) })

  const parties = {} as Record<Party, PartyResult>
  for (const p of PARTIES) {
    const cf = new Float64Array(N + 1)
    for (const f of flows) for (let m = 0; m <= N; m++) { if (f.payee === p) cf[m] += f.m[m]; if (f.payer === p) cf[m] -= f.m[m] }
    let total = 0
    for (let m = 0; m <= N; m++) total += cf[m]
    parties[p] = { cf, total, upfront: cf[0], npv: npv(cf, i.discountPct / 100), irr: irr(cf), paybackMonths: payback(cf) }
  }
  return { ownership: own, months: N, flows, parties, hea: heaTest(i, own), netUpfront: nu }
}

/** Sum of a flow between month a and b inclusive. */
export const sumFlow = (f: Flow, a = 0, b = f.m.length - 1) => { let s = 0; for (let m = a; m <= Math.min(b, f.m.length - 1); m++) s += f.m[m]; return s }

/** Data-center NPV for each number of months energized early, for the break-even chart. */
export function dcNpvByMonths(i: Inputs, own: Exclude<Ownership, 'utility'>, maxMonths = 48): { months: number; npv: number }[] {
  const out = []
  for (let k = 0; k <= maxMonths; k++) out.push({ months: k, npv: runModel({ ...i, monthsEarly: k }, own).parties.dataCenter.npv })
  return out
}
/** Fewest months early at which the data center's NPV is non-negative (linear interpolation between whole months). */
export function breakEvenMonths(i: Inputs, own: Exclude<Ownership, 'utility'>, maxMonths = 120): number | null {
  let prev = runModel({ ...i, monthsEarly: 0 }, own).parties.dataCenter.npv
  if (prev >= 0) return 0
  for (let k = 1; k <= maxMonths; k++) {
    const v = runModel({ ...i, monthsEarly: k }, own).parties.dataCenter.npv
    if (v >= 0) return k - 1 + -prev / (v - prev)
    prev = v
  }
  return null
}
