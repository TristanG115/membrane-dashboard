import { describe, expect, it } from 'vitest'
import { FLEET, HERO_ID } from '../config/scenario'
import { getTimeline } from './registry'
import { buildForecast, calibration, explain, FLEX_NEED, N_STEPS, stressSpans, truthAt } from './forecast'
import { parseTime } from './time'

const tl = getTimeline('stress-day')
const idx = FLEET.findIndex((s) => s.id === HERO_ID)
const t0 = parseTime('12:00')

describe('headroom forecaster', () => {
  const fc = buildForecast(tl, idx, t0)
  it('covers 36 hours at 15-minute steps', () => {
    expect(fc).toHaveLength(N_STEPS + 1)
    expect(fc[1].lead - fc[0].lead).toBe(900)
    expect(fc.at(-1)!.lead).toBe(36 * 3600)
  })
  it('keeps the quantiles ordered and inside 0-100 MW', () => {
    for (const p of fc) { expect(p.p10).toBeLessThanOrEqual(p.p50 + 1e-9); expect(p.p50).toBeLessThanOrEqual(p.p90 + 1e-9); expect(p.p10).toBeGreaterThanOrEqual(0); expect(p.p90).toBeLessThanOrEqual(100) }
  })
  it('widens the band with lead time', () => { expect(fc[120].sigma).toBeGreaterThan(fc[4].sigma * 2) })
  it('tracks the actual headroom closely over the first six hours', () => {
    for (const p of fc.slice(0, 24)) expect(Math.abs(p.p50 - truthAt(tl.sites[idx], p.u))).toBeLessThan(p.sigma * 3 + 4)
  })
  it('is deterministic', () => { expect(buildForecast(tl, idx, t0)).toEqual(fc) })
  it('plans on the cautious P10: grid + battery + curtailed = flexible demand, never above P10 on the grid', () => {
    for (const p of fc) {
      expect(p.gridFlex).toBeLessThanOrEqual(p.p10 + 1e-9)
      expect(p.gridFlex + p.battery + p.curtailed).toBeCloseTo(FLEX_NEED, 6)
    }
  })
  it('sees the 16:00-20:00 stress window ahead of time', () => {
    const spans = stressSpans(fc, FLEX_NEED)
    expect(spans.length).toBeGreaterThan(0)
    const first = fc[spans[0][0]]
    expect(first.u).toBeGreaterThanOrEqual(parseTime('15:00'))
    expect(first.u).toBeLessThanOrEqual(parseTime('17:00'))
  })
  it('attribution adds up to the P50 it explains', () => {
    const p = fc[16]
    const e = explain(tl, idx, p.u, p.p50)
    expect(e.base + e.drivers.reduce((a, d) => a + d.delta, 0)).toBeCloseTo(p.p50, 6)
  })
})

describe('calibration backtest', () => {
  it('"90% sure" holds in at least 90% of intervals (Phase 0 target)', () => {
    const c = calibration()
    expect(c.n).toBe(30 * 96)
    expect(c.p10Coverage).toBeGreaterThanOrEqual(0.9)
  })
  it('observed frequencies track the nominal levels', () => {
    for (const p of calibration().points) expect(Math.abs(p.observed - p.nominal)).toBeLessThan(0.03)
  })
})
