// Derived live values for map overlays. Everything is a pure function of (timeline, t): simulated, not measured.
import { FLEET, LINES, SUBSTATIONS } from '../config/scenario'
import { clampT } from '../lib/snapshot'
import { hashString, smoothNoise } from '../sim/rng'
import type { Timeline } from '../sim/types'
import type { GeoData } from './geo'

const peakLoad = (tl: Timeline) => { let m = 0; for (let t = 0; t < 86400; t += 600) m = Math.max(m, tl.sys.loadFcst[t]); return m }
const peakCache = new WeakMap<Timeline, number>()
function loadNorm(tl: Timeline, i: number) {
  let p = peakCache.get(tl)
  if (!p) { p = peakLoad(tl); peakCache.set(tl, p) }
  return Math.min(1, Math.max(0, (tl.sys.load[i] - 2200) / (p - 2200)))
}

export function plantPct(tl: Timeline, id: string, fuel: string, t: number): number {
  const i = clampT(t), h = i / 3600
  const ln = loadNorm(tl, i)
  const n = smoothNoise(tl.def.seed, 'plant-' + id, i, 900)
  switch (fuel) {
    case 'gas': return clamp01(0.28 + 0.6 * ln + 0.04 * n)
    case 'gas-conversion': return clamp01(0.4 + 0.45 * ln + 0.04 * n)
    case 'coal': return clamp01(0.55 + 0.3 * ln + 0.04 * n)
    case 'solar': return h < 6.3 || h > 20.2 ? 0 : clamp01(Math.sin((Math.PI * (h - 6.3)) / 13.9) * (0.88 + 0.1 * n))
    case 'wind': return clamp01(0.14 + 0.3 * (tl.sys.wind[i] / 14) + 0.12 * n)
    case 'storage': {
      // discharge into the evening peak, charge at midday, otherwise idle
      if (h >= 16 && h < 20.5) return 0.8 + 0.08 * n
      if (h >= 10.5 && h < 15) return 0.5 + 0.06 * n
      return 0.04
    }
  }
  return 0.5
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Loading of a corridor as % of its dynamic (DLR) rating, plus MW flow. */
export function lineLoading(tl: Timeline, lineId: string, staticMW: number, t: number, siteDrawMW = 0) {
  const i = clampT(t)
  const ln = loadNorm(tl, i)
  const off = 0.82 + (hashString(lineId) % 40) / 100
  const flow = staticMW * (0.2 + 0.42 * ln) * off * (1 + 0.04 * smoothNoise(tl.def.seed, lineId, i, 600)) + siteDrawMW * 0.7
  const dlrRating = staticMW * (1 + tl.sys.dlr[i] / 100)
  return { flow, dlrRating, pct: (flow / dlrRating) * 100 }
}

/** Per-line loading incl. the draw of contracted sites served downstream of its end substations. */
export function allLineLoading(tl: Timeline, t: number) {
  const i = clampT(t)
  const siteBySub = new Map<string, number>()
  tl.sites.forEach((s) => siteBySub.set(s.cfg.sub, (siteBySub.get(s.cfg.sub) ?? 0) + s.gridDraw[i]))
  return LINES.map((l) => {
    const sub = [l.a, l.b].find((n) => siteBySub.has(n))
    return { l, ...lineLoading(tl, l.id, l.staticMW, t, l.kv === 138 && sub ? siteBySub.get(sub)! : 0) }
  }).concat(
    FLEET.map((c) => {
      const s = tl.sites.find((x) => x.cfg.id === c.id)!
      const staticMW = Math.round((c.firmMW + c.flexMW) * 1.35)
      const flow = s.gridDraw[i] // utility channel: AES revenue meter / SCADA, independent of the Membrane link
      const rating = staticMW * (1 + tl.sys.dlr[i] / 100)
      return { l: { id: `F-${c.id}`, a: c.sub, b: c.id, kv: 138 as const, staticMW }, flow, dlrRating: rating, pct: (flow / rating) * 100 }
    }),
  )
}

/** Headroom ratio = P10 headroom / site need at a substation. <1 means the site cannot run all its flexible load. */
export function subHeadroomRatio(tl: Timeline, subId: string, t: number): { ratio: number; p10: number; need: number } {
  const i = clampT(t)
  const served = tl.sites.filter((s) => s.cfg.sub === subId)
  if (served.length) {
    const need = served.reduce((a, s) => a + s.cfg.flexMW, 0)
    const p10 = served.reduce((a, s) => a + s.p10[i], 0)
    return { ratio: p10 / need, p10, need }
  }
  const ref = tl.sites[0]
  return { ratio: ref.p10[i] / ref.cfg.flexMW, p10: ref.p10[i], need: ref.cfg.flexMW }
}

export const subName = (id: string) => SUBSTATIONS.find((s) => s.id === id)?.name ?? id

/** Demand surface for hexes: base shape × system load, with a local bump around contracted sites. */
export function hexValues(tl: Timeline, geo: GeoData, t: number): Float32Array {
  const i = clampT(t)
  const f = 0.55 + 0.45 * loadNorm(tl, i)
  const out = new Float32Array(geo.hexBase.length)
  for (let k = 0; k < out.length; k++) {
    let v = geo.hexBase[k] * f
    const [lng, lat] = geo.hexCenters[k]
    for (const s of tl.sites) {
      const d2 = ((lng - s.cfg.lngLat[0]) * 0.77) ** 2 + (lat - s.cfg.lngLat[1]) ** 2
      if (d2 < 0.02) v += (s.gridDraw[i] / 260) * Math.exp(-d2 / 0.0016)
    }
    out[k] = Math.min(1, v)
  }
  return out
}
