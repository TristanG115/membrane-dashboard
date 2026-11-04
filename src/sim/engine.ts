// Deterministic simulation. A Timeline is a pure function of (scenario, seed): every second of the day
// is integrated once, then all views just index into the arrays. No Math.random anywhere.
import { DAY_SECONDS as N, FLEET, SUBSTATIONS, STATE_ORDER, type AlertLevel, type SiteConfig, type SiteState } from '../config/scenario'
import { smoothNoise, stream } from './rng'
import { parseTime } from './time'
import type { FleetEvent, ScenarioDef, SiteSeries, Timeline, TimelineEvent } from './types'

const DETECT_S = 3 // controller declares local failsafe after 3 s without a heartbeat
const CHECKPOINT_S = 30 // flexible jobs checkpoint while the battery bridges
const BATTERY_RAMP = 5 // MW/s
const ROUND_TRIP = 0.9
const RESUME_WAIT_S = 10 // after link restore, hold before resuming flexible load
const DEFAULT_FRAC: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 0.5, 5: 0 }

function piecewise(points: [string, number][]): Float32Array {
  const out = new Float32Array(N)
  const pts = points.map(([t, v]) => [parseTime(t), v] as const).sort((a, b) => a[0] - b[0])
  let j = 0
  for (let t = 0; t < N; t++) {
    while (j < pts.length - 2 && t >= pts[j + 1][0]) j++
    const [t0, v0] = pts[Math.min(j, pts.length - 1)]
    const [t1, v1] = pts[Math.min(j + 1, pts.length - 1)]
    const f = t1 === t0 ? 1 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
    out[t] = v0 + (v1 - v0) * f
  }
  return out
}

function stepFn(points: [string, number][]): Uint8Array {
  const out = new Uint8Array(N)
  const pts = points.map(([t, v]) => [parseTime(t), v] as const).sort((a, b) => a[0] - b[0])
  let level = pts[0]?.[1] ?? 0
  let j = 0
  for (let t = 0; t < N; t++) {
    while (j < pts.length && pts[j][0] <= t) level = pts[j++][1]
    out[t] = level
  }
  return out
}

const bump = (h: number, peak: number, width: number) => Math.exp(-(((h - peak) / width) ** 2))

export function buildTimeline(def: ScenarioDef): Timeline {
  const seed = def.seed
  const alert = stepFn(def.alerts)
  const affectedAll = def.affected === 'all'
  const isAffected = (id: string) => affectedAll || (Array.isArray(def.affected) && def.affected.includes(id))

  // ---- headroom per substation (MW per 50 MW of site flex), scaled per site
  const subCurve = new Map<string, Float32Array>()
  for (const s of SUBSTATIONS) subCurve.set(s.id, piecewise(def.headroom[s.id] ?? def.headroom['*']))

  const sites: SiteSeries[] = FLEET.map((cfg) => simulateSite(cfg, def, alert, subCurve.get(cfg.sub)!, isAffected(cfg.id), seed))

  // ---- system signals
  const load = new Float32Array(N)
  const loadFcst = new Float32Array(N)
  const lmp = new Float32Array(N)
  const temp = new Float32Array(N)
  const wind = new Float32Array(N)
  const dlr = new Float32Array(N)
  const match = new Float32Array(N)
  const heat = Math.max(0, def.weather.tempPeakF - 80)
  for (let t = 0; t < N; t++) {
    const h = t / 3600
    const peak = bump(h, 16.5, 4.6)
    loadFcst[t] = 2300 + (380 + heat * 42) * peak + 120 * bump(h, 8, 2)
    load[t] = loadFcst[t] * (1 + 0.012 * smoothNoise(seed, 'load', t, 600)) + (alert[t] >= 3 ? 40 : 0)
    temp[t] = def.weather.tempPeakF - 19 + 19 * bump(h, 15.5, 5.2) + 0.8 * smoothNoise(seed, 'temp', t, 1800)
    wind[t] = Math.max(0.5, def.weather.windMph * (1 + 0.35 * smoothNoise(seed, 'wind', t, 900)))
    dlr[t] = Math.min(25, Math.max(0, 6 + 1.7 * (wind[t] - 5) - 0.45 * (temp[t] - 80)))
    const adder = [0, 6, 16, 62, 130, 260][alert[t]]
    lmp[t] = 24 + 38 * peak * (heat / 15 + 0.35) + adder + 2.2 * smoothNoise(seed, 'lmp', t, 300)
    match[t] = 99.975 + 0.012 * smoothNoise(seed, 'match', t, 3600)
  }

  const curtailMWhCum = new Float32Array(N)
  let acc = 0
  for (let t = 0; t < N; t++) {
    for (const s of sites) if (s.cfg.mode === 'active') acc += s.curtailed[t] / 3600
    curtailMWhCum[t] = acc
  }

  const events = buildEvents(def, sites)
  const fleetEvents = buildFleetEvents(sites, alert, seed)
  return { def, sites, alert, sys: { load, loadFcst, lmp, temp, wind, dlr, match }, curtailMWhCum, fleetEvents, events, beatsT: def.beats.map((b) => parseTime(b.t)).sort((a, b) => a - b) }
}

function simulateSite(cfg: SiteConfig, def: ScenarioDef, alert: Uint8Array, curve: Float32Array, affected: boolean, seed: number): SiteSeries {
  const flexNom = cfg.flexMW
  const scale = flexNom / 50
  const bat = cfg.battery
  const mk = () => new Float32Array(N)
  const s: SiteSeries = {
    cfg, g: mk(), b: mk(), chg: mk(), soc: mk(), flexRun: mk(), curtailed: mk(), gridDraw: mk(), hdr: mk(), p10: mk(),
    state: new Uint8Array(N), linkUp: new Uint8Array(N).fill(1), lastSeen: new Uint32Array(N), failsafe: new Uint8Array(N),
  }
  for (const w of def.linkLoss ?? []) {
    if (w.site !== cfg.id) continue
    const a = parseTime(w.from), z = parseTime(w.to)
    for (let t = a; t < z && t < N; t++) s.linkUp[t] = 0
  }
  // headroom + P10 (forecast margin grows with level)
  for (let t = 0; t < N; t++) {
    const base = curve[t] * scale
    const n = base > 0 ? 1 + 0.01 * smoothNoise(seed, 'hdr-' + cfg.id, t, 420) : 1
    s.hdr[t] = Math.max(0, base * n)
  }
  for (let t = 0; t < N; t++) s.p10[t] = Math.max(0, s.hdr[t] - (1 + 0.06 * s.hdr[t] / scale) * Math.max(1, scale))

  let g = Math.min(flexNom, s.p10[0])
  let b = 0
  let soc = def.socOverride?.[cfg.id] ?? def.initialSoc ?? 0.8
  let downFor = 0
  let upFor = RESUME_WAIT_S
  let failStart = -1
  let flexAtLoss = 0
  let prevFail = false
  let lastSeen = 0
  const frac = (L: number) => def.levelFlexFrac?.[L as AlertLevel] ?? DEFAULT_FRAC[L]

  for (let t = 0; t < N; t++) {
    const Lc = alert[Math.max(0, t - cfg.latencyS)] // command level after this site's latency
    const L = alert[t]
    const down = s.linkUp[t] === 0
    downFor = down ? downFor + 1 : 0
    upFor = down ? 0 : Math.min(upFor + 1, 1000)
    const failsafe = down && downFor >= DETECT_S
    if (failsafe && !prevFail) { failStart = t; flexAtLoss = g + b }
    prevFail = failsafe
    if (!down) lastSeen = t
    s.lastSeen[t] = lastSeen
    s.failsafe[t] = failsafe ? 1 : 0

    const holding = failsafe || upFor < RESUME_WAIT_S
    const allowed = holding ? 0 : flexNom * frac(Lc)
    const cap = Math.min(s.p10[Math.min(t + 60, N - 1)], s.hdr[Math.max(0, t - 5)])
    const gCap = Math.min(allowed, cap)

    // Pre-positioning / overnight recharge: only when the battery is not needed to fill a gap.
    // The connection is capped at firm + flex, so flexible work is deferred to make room for charging.
    const hour = t / 3600
    const night = hour >= 20 || hour < 6
    const prepos = affected && (Lc === 1 || Lc === 2)
    const socTarget = prepos ? 1 : night ? 0.8 : -1
    let wantChg = 0
    if (!holding && cfg.mode !== 'offline' && L < 3 && soc < socTarget - 0.002 && allowed - gCap < 0.5) wantChg = bat.mw * 0.5

    const gTarget = Math.max(0, Math.min(gCap, flexNom - wantChg))
    const up = cfg.rampUpMWs * (Lc === 2 ? 0.25 : 1)
    g = gTarget > g ? Math.min(gTarget, g + up) : Math.max(gTarget, g - cfg.rampDownMWs)
    const chg = wantChg > 0 ? Math.min(wantChg, Math.max(0, Math.min(s.hdr[t], flexNom) - g)) : 0

    // battery discharge: fill the gap to what is allowed; bridge while jobs checkpoint in failsafe
    let bWant = 0
    if (failsafe) bWant = t - failStart < CHECKPOINT_S ? Math.min(bat.mw, Math.max(0, flexAtLoss - g)) : 0
    else if (!holding) bWant = Math.min(bat.mw, Math.max(0, allowed - g))
    if (chg > 0 || soc <= 0.0005) bWant = 0
    b = b < bWant ? Math.min(bWant, b + BATTERY_RAMP) : Math.max(bWant, b - BATTERY_RAMP)

    // forecast miss: if grid headroom is below what we draw, the battery absorbs the excess
    const gd = Math.min(g, s.hdr[t])
    const absorbed = g - gd
    const bTot = Math.min(bat.mw, b + absorbed)
    soc = Math.min(1, Math.max(0, soc + (chg * ROUND_TRIP - bTot) / (3600 * bat.mwh)))

    const flexRun = gd + bTot
    s.g[t] = gd; s.b[t] = bTot; s.chg[t] = chg; s.soc[t] = soc
    s.flexRun[t] = flexRun
    s.curtailed[t] = Math.max(0, flexNom - flexRun - chg) // flexible work deferred to charge is not curtailment
    s.gridDraw[t] = cfg.mode === 'offline' ? 0 : cfg.mode === 'shadow' ? cfg.firmMW : cfg.firmMW + gd + chg

    let st: SiteState
    if (cfg.mode === 'offline') st = 'offline'
    else if (cfg.mode === 'shadow') st = 'shadow'
    else if (down || failsafe) st = 'link-lost'
    else if (Lc === 5 && flexRun < 0.5) st = 'firm-only'
    else if (s.curtailed[t] > 0.5) st = 'curtailing'
    else if (bTot > 0.5) st = 'battery'
    else if (chg > 0.5 || prepos) st = 'prepositioning'
    else st = 'normal'
    s.state[t] = STATE_ORDER.indexOf(st)
  }
  return s
}

function buildEvents(def: ScenarioDef, sites: SiteSeries[]): TimelineEvent[] {
  const ev: TimelineEvent[] = def.beats.map((b, i) => ({ t: parseTime(b.t), id: `${def.id}-beat-${i}`, title: b.title, text: b.text, severity: b.severity, kind: 'beat' }))
  for (const w of def.linkLoss ?? []) {
    const site = sites.find((x) => x.cfg.id === w.site)
    if (!site) continue
    ev.push({ t: parseTime(w.from) + DETECT_S, id: `${w.site}-lost`, title: `${site.cfg.name}: Membrane link lost`, text: 'Local failsafe active. Grid service is firm and uninterrupted.', severity: 'warn', siteId: w.site, kind: 'link-lost' })
    ev.push({ t: parseTime(w.to), id: `${w.site}-restored`, title: `${site.cfg.name}: link restored`, text: 'Buffered ledger entries synced after reconnect. Ramping back within caps.', severity: 'ok', siteId: w.site, kind: 'link-restored' })
  }
  return ev.sort((a, b) => a.t - b.t)
}

function buildFleetEvents(sites: SiteSeries[], alert: Uint8Array, seed: number): FleetEvent[] {
  const out: FleetEvent[] = []
  for (let t = 1; t < N; t++) {
    if (alert[t] !== 5 || alert[t - 1] === 5) continue
    const rnd = stream(seed, 'meter-verify-' + t)
    const steps = sites.map((s) => {
      const active = s.cfg.mode === 'active'
      const steppedMW = active ? Math.max(0, s.gridDraw[t] - s.cfg.firmMW) : 0
      let tFirm: number | null = null
      if (active) for (let u = t; u < Math.min(N, t + 900); u++) if (s.gridDraw[u] <= s.cfg.firmMW + 0.5) { tFirm = u - t; break }
      const confirmed = tFirm === null ? null : tFirm + 2 + Math.round(rnd() * 4)
      return { id: s.cfg.id, steppedMW, tFirmS: tFirm, confirmedS: confirmed }
    })
    out.push({ t0: t, level: 5, sites: steps })
  }
  return out
}
