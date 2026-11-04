import { ALERTS, STATE_ORDER, type SiteState } from '../config/scenario'
import type { Timeline, SiteSeries } from '../sim/types'

export interface SiteSnap {
  s: SiteSeries
  i: number
  state: SiteState
  g: number; b: number; chg: number; soc: number; flexRun: number; curtailed: number
  gridDraw: number
  linkUp: boolean
  failsafe: boolean
  lastSeenS: number
  hdr: number; p10: number
}
export const clampT = (t: number) => Math.min(86399, Math.max(0, Math.floor(t)))

export function siteAt(tl: Timeline, idx: number, t: number): SiteSnap {
  const i = clampT(t)
  const s = tl.sites[idx]
  return { s, i, state: STATE_ORDER[s.state[i]], g: s.g[i], b: s.b[i], chg: s.chg[i], soc: s.soc[i], flexRun: s.flexRun[i], curtailed: s.curtailed[i], gridDraw: s.gridDraw[i], linkUp: s.linkUp[i] === 1, failsafe: s.failsafe[i] === 1, lastSeenS: s.lastSeen[i], hdr: s.hdr[i], p10: s.p10[i] }
}

export function alertAt(tl: Timeline, t: number) { return ALERTS[tl.alert[clampT(t)]] }

export function fleetSummary(tl: Timeline, t: number) {
  const i = clampT(t)
  const counts: Record<SiteState, number> = { normal: 0, prepositioning: 0, battery: 0, curtailing: 0, 'firm-only': 0, 'link-lost': 0, shadow: 0, offline: 0 }
  let flexAvail = 0, socNum = 0, socDen = 0, curtailMW = 0
  tl.sites.forEach((s) => {
    counts[STATE_ORDER[s.state[i]]]++
    if (s.cfg.mode === 'active') {
      flexAvail += s.flexRun[i]
      socNum += s.soc[i] * s.cfg.battery.mwh; socDen += s.cfg.battery.mwh
      curtailMW += s.curtailed[i]
    }
  })
  const ev = [...tl.fleetEvents].reverse().find((e) => e.t0 <= i) ?? null
  let event = null as null | { t0: number; elapsed: number; target: number; released: number; sites: { id: string; stepped: number; tFirm: number | null; firm: boolean; confirmed: boolean }[]; done: boolean; headlineS: number }
  if (ev) {
    const elapsed = i - ev.t0
    const rows = ev.sites.map((r) => ({ id: r.id, stepped: r.steppedMW, tFirm: r.tFirmS, firm: r.tFirmS !== null && elapsed >= r.tFirmS, confirmed: r.confirmedS !== null && elapsed >= r.confirmedS }))
    const target = ev.sites.reduce((a, r) => a + r.steppedMW, 0)
    const released = ev.sites.reduce((a, r) => {
      const s = tl.sites.find((x) => x.cfg.id === r.id)!
      return a + Math.max(0, Math.min(r.steppedMW, r.steppedMW - (s.gridDraw[i] - s.cfg.firmMW)))
    }, 0)
    const withStep = rows.filter((r) => r.stepped > 0)
    const done = withStep.every((r) => r.confirmed)
    const lastConfirm = Math.max(0, ...ev.sites.map((r) => r.confirmedS ?? 0))
    event = { t0: ev.t0, elapsed, target, released, sites: rows, done, headlineS: done ? lastConfirm : elapsed }
  }
  return { counts, flexAvail, soc: socDen ? socNum / socDen : 0, curtailMW, event, curtailMWh: tl.curtailMWhCum[i] }
}

export function activeCallouts(tl: Timeline, t: number) {
  const hh = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 3600 + m * 60 }
  return tl.def.callouts.filter((c) => hh(c.from) <= t && t < hh(c.until))
}

export function currentBeat(tl: Timeline, t: number) {
  let idx = -1
  tl.def.beats.forEach((b, k) => { const [h, m] = b.t.split(':').map(Number); if (h * 3600 + m * 60 <= t && (idx < 0 || h * 3600 + m * 60 >= parseHM(tl.def.beats[idx].t))) idx = k })
  return idx >= 0 ? tl.def.beats[idx] : null
}
const parseHM = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 3600 + m * 60 }
