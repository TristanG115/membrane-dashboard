import { create } from 'zustand'
import { FLEET } from '../config/scenario'
import { DEFAULT_SCENARIO, SCENARIOS, getTimeline } from '../sim/registry'
import { parseTime } from '../sim/time'
import type { CameraCue, Severity, TabId, Timeline } from '../sim/types'

export type Role = 'operator' | 'regulator' | 'public'
export type DrawerTarget = { kind: 'site' | 'plant' | 'sub' | 'line'; id: string } | null
export interface Toast { id: string; title: string; text: string; severity: Severity; born: number }
export const SPEEDS = [1, 60, 300, 900] as const
export const TABS: { id: TabId; label: string; short: string; ready: boolean }[] = [
  { id: 'map', label: 'Grid Operations', short: 'Grid Ops', ready: true },
  { id: 'dispatch', label: 'Site Dispatch', short: 'Dispatch', ready: true },
  { id: 'agreement', label: 'Service Agreement', short: 'Agreement', ready: false },
  { id: 'economics', label: 'Economics', short: 'Economics', ready: false },
  { id: 'forecaster', label: 'Headroom Forecaster', short: 'Forecaster', ready: false },
  { id: 'scorecard', label: 'Pilot Scorecard', short: 'Scorecard', ready: false },
  { id: 'markets', label: 'Market Models', short: 'Markets', ready: false },
  { id: 'requests', label: 'Interconnection', short: 'Requests', ready: false },
  { id: 'ledger', label: 'Compliance Ledger', short: 'Ledger', ready: false },
]
export const LAYER_DEFS = [
  { id: 'rto', label: 'RTO / ISO regions', hideFor: [] },
  { id: 'territory', label: 'AES service territories', hideFor: [] },
  { id: 'demand', label: 'Current demand', hideFor: ['public'] },
  { id: 'lines', label: 'Transmission corridors', hideFor: ['public'] },
  { id: 'subs', label: 'Substations', hideFor: ['public'] },
  { id: 'plants', label: 'Power plants', hideFor: [] },
  { id: 'halos', label: 'Headroom halos', hideFor: ['public'] },
  { id: 'sites', label: 'Membrane sites', hideFor: [] },
] as const

// The sim clock lives outside React so the map can read it every frame.
export const clock = { t: 0 }
export const urlParams = () => new URLSearchParams(window.location.search)

interface UIState {
  scenarioId: string
  tl: Timeline
  t: number
  speed: number
  playing: boolean
  tab: TabId
  role: Role
  layers: Record<string, boolean>
  drawer: DrawerTarget
  fleetPanel: boolean
  eventLab: boolean
  present: boolean
  about: boolean
  toasts: Toast[]
  camera: { seq: number; cue: CameraCue }
  setScenario: (id: string, t?: number) => void
  seek: (t: number, applyCue?: boolean) => void
  setSpeed: (s: number) => void
  setPlaying: (p: boolean) => void
  toggle: () => void
  step: (dt: number) => void
  setTab: (t: TabId) => void
  setRole: (r: Role) => void
  toggleLayer: (id: string) => void
  openDrawer: (d: DrawerTarget) => void
  setFleetPanel: (v: boolean) => void
  setEventLab: (v: boolean) => void
  setPresent: (v: boolean) => void
  setAbout: (v: boolean) => void
  fireCue: (cue: CameraCue) => void
  dismissToast: (id: string) => void
  tick: (dtReal: number) => void
}

const params = (() => {
  const p = new URLSearchParams(window.location.search)
  const h = window.location.hash
  const q = h.indexOf('?')
  if (q >= 0) new URLSearchParams(h.slice(q + 1)).forEach((v, k) => p.set(k, v))
  return p
})()

const tabFromHash = (): TabId | null => {
  const m = window.location.hash.match(/^#\/?([a-z]+)/)
  const id = m?.[1] as TabId | undefined
  return id && TABS.some((t) => t.id === id) ? id : null
}

const initialId = SCENARIOS.some((s) => s.id === params.get('scenario')) ? params.get('scenario')! : DEFAULT_SCENARIO
const initialTl = getTimeline(initialId)
const initialT = params.get('t') ? parseTime(params.get('t')!) : parseTime(initialTl.def.start)
clock.t = initialT
const wantTab = (params.get('tab') as TabId | null) ?? tabFromHash() ?? 'map'
const wantRole = (['operator', 'regulator', 'public'] as const).find((r) => r === params.get('role')) ?? 'operator'

let seq = 0
export const useStore = create<UIState>((set, get) => ({
  scenarioId: initialId,
  tl: initialTl,
  t: initialT,
  speed: Number(params.get('speed')) > 0 ? Number(params.get('speed')) : 60,
  playing: params.get('autoplay') === '1',
  tab: TABS.some((t) => t.id === wantTab) ? wantTab : 'map',
  role: wantRole,
  layers: Object.fromEntries(LAYER_DEFS.map((l) => [l.id, true])),
  drawer: params.get('site') && FLEET.some((f) => f.id === params.get('site')) ? { kind: 'site', id: params.get('site')! } : null,
  fleetPanel: params.get('fleet') === '1',
  eventLab: false,
  present: params.get('present') === '1',
  about: false,
  toasts: [],
  camera: { seq: 0, cue: {} },

  setScenario: (id, t) => {
    const tl = getTimeline(id)
    const nt = t ?? parseTime(tl.def.start)
    clock.t = nt
    set({ scenarioId: id, tl, t: nt, drawer: null, toasts: [] })
    get().seek(nt)
  },
  seek: (t, applyCue = true) => {
    const nt = Math.min(86399, Math.max(0, t))
    clock.t = nt
    set({ t: nt })
    // on seek, restore the framing of the latest beat that has a camera cue
    if (!applyCue) return
    const tl = get().tl
    const past = tl.def.beats.filter((b) => b.camera && parseTime(b.t) <= nt).pop()
    if (past?.camera) get().fireCue(past.camera)
  },
  setSpeed: (speed) => set({ speed }),
  setPlaying: (playing) => set({ playing }),
  toggle: () => set({ playing: !get().playing }),
  step: (dt) => get().seek(clock.t + dt),
  setTab: (tab) => {
    set({ tab })
    if (window.location.hash !== `#/${tab}`) history.replaceState(null, '', `${window.location.search}#/${tab}`)
  },
  setRole: (role) => set({ role }),
  toggleLayer: (id) => set({ layers: { ...get().layers, [id]: !get().layers[id] } }),
  openDrawer: (drawer) => set({ drawer }),
  setFleetPanel: (fleetPanel) => set({ fleetPanel }),
  setEventLab: (eventLab) => set({ eventLab }),
  setPresent: (present) => set({ present }),
  setAbout: (about) => set({ about }),
  fireCue: (cue) => {
    if (cue.tab) get().setTab(cue.tab)
    if (cue.openSite) set({ drawer: { kind: 'site', id: cue.openSite } })
    if (cue.fleetPanel !== undefined) set({ fleetPanel: cue.fleetPanel })
    set({ camera: { seq: ++seq, cue } })
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  tick: (dtReal) => {
    const s = get()
    const prev = clock.t
    if (s.playing) {
      const next = prev + dtReal * s.speed
      if (next >= 86399) { clock.t = 86399; set({ playing: false, t: 86399 }); return }
      clock.t = next
      // fire beats / events crossed in this frame
      for (const ev of s.tl.events) {
        if (ev.t > prev && ev.t <= next) {
          const b = s.tl.def.beats.find((x) => parseTime(x.t) === ev.t && x.title === ev.title)
          if (b?.camera) get().fireCue(b.camera)
          const toast: Toast = { id: `${ev.id}-${Math.round(performance.now())}`, title: ev.title, text: ev.text, severity: ev.severity, born: performance.now() }
          set({ toasts: [...get().toasts.slice(-3), toast] })
        }
      }
    }
    const now = performance.now()
    const live = get().toasts.filter((t) => now - t.born < 9000)
    if (live.length !== get().toasts.length) set({ toasts: live })
  },
}))

/** Publishes the clock to React at ~15 Hz; the map reads `clock.t` directly each frame. */
export function startClock() {
  let last = performance.now()
  let lastPub = 0
  let raf = 0
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    useStore.getState().tick(dt)
    if (now - lastPub > 66) {
      lastPub = now
      if (useStore.getState().t !== clock.t) useStore.setState({ t: clock.t })
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(raf)
}
