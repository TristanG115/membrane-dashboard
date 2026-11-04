import { describe, expect, it } from 'vitest'
import { buildTimeline } from './engine'
import { parseTime } from './time'
import stress from '../scenarios/stress-day.json'
import escalation from '../scenarios/maxgen-escalation.json'
import telemetry from '../scenarios/telemetry-loss.json'
import worst from '../scenarios/worst-case.json'
import type { ScenarioDef } from './types'

const T = (s: string) => parseTime(s)
const defs = [stress, escalation, telemetry, worst] as unknown as ScenarioDef[]

describe('determinism', () => {
  it('same scenario gives identical timelines', () => {
    const a = buildTimeline(defs[0]), b = buildTimeline(defs[0])
    expect(Array.from(a.sites[0].gridDraw.slice(20000, 20100))).toEqual(Array.from(b.sites[0].gridDraw.slice(20000, 20100)))
    expect(a.sys.lmp[50000]).toBe(b.sys.lmp[50000])
  })
})

describe('invariants (all scenarios)', () => {
  for (const def of defs) {
    it(`${def.id}: firm is never curtailed and the utility channel never drops below firm`, () => {
      const tl = buildTimeline(def)
      for (const s of tl.sites) {
        if (s.cfg.mode !== 'active') continue
        for (let t = 0; t < 86400; t += 7) {
          expect(s.gridDraw[t]).toBeGreaterThanOrEqual(s.cfg.firmMW - 0.001)
          expect(s.gridDraw[t]).toBeLessThanOrEqual(s.cfg.firmMW + s.cfg.flexMW + 0.001)
          expect(s.soc[t]).toBeGreaterThanOrEqual(0)
          expect(s.soc[t]).toBeLessThanOrEqual(1)
        }
      }
    })
    it(`${def.id}: grid draw ramp never exceeds the site ramp cap`, () => {
      const tl = buildTimeline(def)
      for (const s of tl.sites) for (let t = 1; t < 86400; t++) {
        const d = s.gridDraw[t - 1] - s.gridDraw[t]
        // allow the cap plus charging cut-off (charge stops instantly, up to bat.mw*0.5)
        expect(d).toBeLessThanOrEqual(s.cfg.rampDownMWs + s.cfg.battery.mw * 0.5 + 0.01)
      }
    })
  }
})

describe('canonical stress day (140 MW site)', () => {
  const tl = buildTimeline(defs[0])
  const hero = tl.sites[0]
  it('uses 90 / 50 / 40 MW-160 MWh', () => {
    expect(hero.cfg.firmMW + hero.cfg.flexMW).toBe(140)
    expect(hero.cfg.battery).toEqual({ mw: 40, mwh: 160 })
  })
  it('battery pre-charges to 100% before 16:00', () => {
    expect(hero.soc[T('15:55')]).toBeGreaterThan(0.99)
  })
  it('16:30: battery covers ~40 MW, nothing curtailed', () => {
    expect(hero.b[T('16:30')]).toBeGreaterThan(38)
    expect(hero.curtailed[T('16:30')]).toBeLessThan(1.5)
  })
  it('18:00: battery 40 MW, ~10 MW curtailed, firm untouched', () => {
    expect(hero.b[T('18:00')]).toBeGreaterThan(38)
    expect(hero.curtailed[T('18:00')]).toBeGreaterThan(8.5)
    expect(hero.curtailed[T('18:00')]).toBeLessThan(11.5)
    expect(hero.gridDraw[T('18:00')]).toBeCloseTo(90, 0)
  })
  it('jobs resume after 20:00 all-clear', () => {
    expect(hero.curtailed[T('21:30')]).toBeLessThan(1)
  })
})

describe('Max Gen escalation', () => {
  const tl = buildTimeline(defs[1])
  it('every active site reaches firm and the fleet event is recorded', () => {
    expect(tl.fleetEvents.length).toBe(1)
    const ev = tl.fleetEvents[0]
    const active = ev.sites.filter((s) => s.steppedMW > 0)
    expect(active.length).toBeGreaterThanOrEqual(5)
    const total = active.reduce((a, s) => a + s.steppedMW, 0)
    console.log('fleet stepped MW', total.toFixed(0), 'max time-to-firm s', Math.max(...active.map((s) => s.tFirmS ?? 999)), 'max confirmed s', Math.max(...active.map((s) => s.confirmedS ?? 999)))
    for (const s of active) expect(s.tFirmS).not.toBeNull()
  })
  it('link-lost site is at firm through the outage, utility channel keeps reporting', () => {
    const s = tl.sites.find((x) => x.cfg.id === 'eagle-creek')!
    const t = T('18:45')
    expect(s.linkUp[t]).toBe(0)
    expect(s.gridDraw[t]).toBeCloseTo(s.cfg.firmMW, 0)
    expect(s.lastSeen[t]).toBe(T('18:30') - 1)
  })
})

describe('telemetry loss (normal day)', () => {
  const tl = buildTimeline(defs[2])
  const hero = tl.sites[0]
  it('draws 140 MW before, ramps to 90 MW within cap, never drops below firm', () => {
    expect(hero.gridDraw[T('10:59')]).toBeGreaterThan(139)
    expect(hero.gridDraw[T('11:02')]).toBeLessThan(140)
    expect(hero.gridDraw[T('11:03')]).toBeCloseTo(90, 0)
    let min = 999
    for (let t = T('10:59'); t < T('11:10'); t++) min = Math.min(min, hero.gridDraw[t])
    expect(min).toBeGreaterThanOrEqual(89.999)
  })
})
