// Headroom forecaster (simulated). Produces P10/P50/P90 spare capacity above the firm limit for every 15-minute interval out
// to 36 hours, for one site's substation. The "truth" is the scenario's headroom curve; the forecast is that truth blurred and
// perturbed by a seeded error that grows with lead time, with a band that widens the same way. Dispatch always plans on P10.
import { CANONICAL } from '../config/scenario'
import { smoothNoise, stream } from './rng'
import type { SiteSeries, Timeline } from './types'

export const STEP_S = 900
export const HORIZON_H = 36
export const N_STEPS = (HORIZON_H * 3600) / STEP_S // 144
const Z90 = 1.2816

export interface FcPoint {
  u: number // seconds since midnight of the forecast day; can exceed 86400 for the next day
  lead: number // seconds ahead of the forecast origin
  p10: number; p50: number; p90: number; sigma: number
  /** the plan that follows from P10: flexible MW on grid headroom, battery MW, curtailed MW */
  gridFlex: number; battery: number; curtailed: number
}

const DAY = 86400
/** Headroom the grid will actually have at second u (the second day repeats the scenario's shape). */
export const truthAt = (s: SiteSeries, u: number) => s.hdr[Math.min(DAY - 1, Math.max(0, Math.floor(u % DAY)))]

export function sigmaAt(leadH: number, grad: number): number {
  return 1.2 + 0.55 * Math.pow(Math.max(0, leadH), 0.85) + 0.22 * grad * (0.5 + leadH / HORIZON_H)
}

export function buildForecast(tl: Timeline, idx: number, t0: number): FcPoint[] {
  const s = tl.sites[idx]
  const seed = tl.def.seed
  const out: FcPoint[] = []
  for (let k = 0; k <= N_STEPS; k++) {
    const lead = k * STEP_S
    const u = t0 + lead
    const leadH = lead / 3600
    // the further out, the more the forecast blurs sharp events (it cannot see a step as crisply)
    const taps = Math.round((300 + 1500 * Math.min(1, leadH / 12)) / 150) // half-window in 150 s taps, symmetric around the interval
    let acc = 0
    for (let d = -taps; d <= taps; d++) acc += truthAt(s, u + d * 150)
    const blurred = acc / (2 * taps + 1)
    const grad = Math.abs(truthAt(s, u + 1800) - truthAt(s, u - 1800))
    const sigma = sigmaAt(leadH, grad)
    const p50 = Math.min(100, Math.max(0, blurred + 0.35 * sigma * smoothNoise(seed, 'fc-bias-' + s.cfg.id, u, 5400)))
    const p10 = Math.max(0, p50 - Z90 * sigma)
    const p90 = Math.min(100, p50 + Z90 * sigma)
    const flex = s.cfg.flexMW
    const gridFlex = Math.min(flex, p10)
    const battery = Math.min(s.cfg.battery.mw, flex - gridFlex)
    out.push({ u, lead, p10, p50, p90, sigma, gridFlex, battery, curtailed: Math.max(0, flex - gridFlex - battery) })
  }
  return out
}

const erf = (x: number) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))

/** Probability that actual headroom comes in below `need` MW at this interval, from the forecast band. */
export const probBelow = (p: FcPoint, need: number) => normCdf((need - p.p50) / Math.max(0.5, p.sigma))

/** Spans (indices) where the cautious P10 is below the flexible demand. */
export function stressSpans(fc: FcPoint[], need: number): [number, number][] {
  const out: [number, number][] = []
  let a = -1
  fc.forEach((p, i) => {
    const low = p.p10 < need
    if (low && a < 0) a = i
    if ((!low || i === fc.length - 1) && a >= 0) { out.push([a, low ? i : i - 1]); a = -1 }
  })
  return out
}

// ---------------------------------------------------------------- calibration backtest (simulated)
export interface CalibrationPoint { nominal: number; observed: number }
export interface Calibration { points: CalibrationPoint[]; n: number; p10Coverage: number }
/**
 * Reliability of the quantiles over 30 simulated days of 15-minute intervals: for each nominal level q, the share of actual
 * headroom values that landed at or below the forecast quantile. A calibrated model sits on the diagonal. The simulated model is
 * very slightly conservative at the low end, which is the safe direction.
 */
export function calibration(seed = 7): Calibration {
  const days = 30, per = 96
  const n = days * per
  const levels = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  const rnd = stream(seed, 'calibration')
  const us: number[] = []
  for (let i = 0; i < n; i++) us.push(rnd())
  const points = levels.map((q) => {
    const shift = -0.008 * (0.5 - q) // tiny conservative lean at the low end
    const hit = us.filter((u) => u < q + shift).length
    return { nominal: q, observed: hit / n }
  })
  const p10 = points[0].observed
  return { points, n, p10Coverage: 1 - p10 }
}

// ---------------------------------------------------------------- explain this forecast
export interface Driver { id: string; label: string; value: string; delta: number }
/**
 * Illustrative additive attribution of the P50 at one interval: how far each input moves headroom from its day-average level.
 * Time of day takes whatever the other drivers do not explain, so the bars always add up to the forecast.
 */
export function explain(tl: Timeline, idx: number, u: number, p50: number): { base: number; drivers: Driver[] } {
  const s = tl.sites[idx]
  let base = 0, load = 0, temp = 0, dlr = 0
  for (let k = 0; k < DAY; k += 900) { base += s.hdr[k]; load += tl.sys.loadFcst[k]; temp += tl.sys.temp[k]; dlr += tl.sys.dlr[k] }
  const m = DAY / 900
  base /= m; load /= m; temp /= m; dlr /= m
  const i = Math.floor(u % DAY)
  const L = tl.sys.loadFcst[i], T = tl.sys.temp[i], D = tl.sys.dlr[i]
  const dLoad = -0.05 * (L - load)
  const dTemp = -0.55 * (T - temp)
  const dDlr = 0.9 * (D - dlr)
  const rest = p50 - base - dLoad - dTemp - dDlr
  return {
    base,
    drivers: [
      { id: 'load', label: 'MISO load forecast', value: `${Math.round(L).toLocaleString('en-US')} MW`, delta: dLoad },
      { id: 'temp', label: 'Temperature', value: `${Math.round(T)}°F`, delta: dTemp },
      { id: 'dlr', label: 'Line rating (DLR) uplift', value: `+${D.toFixed(1)}%`, delta: dDlr },
      { id: 'tod', label: 'Time of day and substation pattern', value: `${String(Math.floor((i % DAY) / 3600)).padStart(2, '0')}:${String(Math.floor((i % 3600) / 60)).padStart(2, '0')}`, delta: rest },
    ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  }
}
export const FLEX_NEED = CANONICAL.flexMW
