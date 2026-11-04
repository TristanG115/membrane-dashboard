// Single source of truth for every constant used across views.
// All values here describe a SIMULATED scenario unless a `source` says otherwise.

export const CANONICAL = {
  requestedMW: 140,
  firmMW: 90,
  flexMW: 50,
  battery: { mw: 40, mwh: 160, hours: 4 },
  stress: { start: '16:00', end: '20:00', hoursPerYear: 85, curtailedMW: 10, batteryCoverMW: 40 },
  availability: { flexHoursPct: 99, annualEnergyDeferredPct: 0.07 },
  source: 'Duke University 2025 (0.25% curtailment case) for ~85 stress hours/yr',
} as const

export const PHASE0_TARGETS = [
  { id: 'interruptions', label: 'Firm-load interruptions caused by the tool', target: '0', kind: 'max', value: 0 },
  { id: 'p10', label: 'Actual headroom at or above P10 forecast', target: '≥ 90% of intervals', kind: 'min', value: 90 },
  { id: 'response', label: 'Flexible load reduced after a signal', target: 'within 60 s', kind: 'max', value: 60 },
  { id: 'ledger', label: 'Ledger matches utility revenue meter', target: '≥ 99.9% of intervals', kind: 'min', value: 99.9 },
  { id: 'failsafe', label: 'Loss-of-telemetry failsafe test', target: 'pass, monthly', kind: 'pass', value: 1 },
  { id: 'curtail', label: 'Hours with any flexible curtailment', target: '≤ 1% of year', kind: 'max', value: 1 },
] as const

// ---------------------------------------------------------------- alerts
export type AlertLevel = 0 | 1 | 2 | 3 | 4 | 5
export const ALERTS: { level: AlertLevel; id: string; label: string; short: string; color: string; fleetRule: string }[] = [
  { level: 0, id: 'normal', label: 'Normal', short: 'Normal', color: '#7C8CA8', fleetRule: 'Flexible jobs run on grid headroom' },
  { level: 1, id: 'capacity-advisory', label: 'Capacity Advisory', short: 'Cap. Advisory', color: '#E3C55B', fleetRule: 'All sites pre-position' },
  { level: 2, id: 'conservative-ops', label: 'Conservative Ops', short: 'Conserv. Ops', color: '#E89B3A', fleetRule: 'Flexible ramp-up capped' },
  { level: 3, id: 'max-gen-alert', label: 'Max Gen Alert', short: 'Max Gen Alert', color: '#E0633A', fleetRule: 'Flexible load stepped down ahead of any call' },
  { level: 4, id: 'max-gen-warning', label: 'Max Gen Warning', short: 'Max Gen Warn.', color: '#DB4A52', fleetRule: 'Flexible load stepped down ahead of any call' },
  { level: 5, id: 'max-gen-event', label: 'Max Gen Event', short: 'Max Gen Event', color: '#D9365E', fleetRule: 'Every site goes firm-only' },
]

// ---------------------------------------------------------------- site states
export type SiteState = 'normal' | 'prepositioning' | 'battery' | 'curtailing' | 'firm-only' | 'link-lost' | 'shadow' | 'offline'
export const STATE_META: Record<SiteState, { label: string; meaning: string; color: string; icon: string }> = {
  normal: { label: 'Flexible running', meaning: 'Flexible jobs on grid headroom', color: '#A9B0FE', icon: 'pulse' },
  prepositioning: { label: 'Pre-positioning', meaning: 'Forecast says stress is coming: battery pre-charging, deferral queue building', color: '#E3C55B', icon: 'battery-charging' },
  battery: { label: 'Battery covering', meaning: 'Battery discharging to fill the gap', color: '#6FD39A', icon: 'battery-high' },
  curtailing: { label: 'Curtailing', meaning: 'Flexible training checkpointed and paused', color: '#9CA3AF', icon: 'pause' },
  'firm-only': { label: 'Firm-only (grid event)', meaning: 'Stepped down to the firm limit because of a MISO alert or event', color: '#E5765B', icon: 'shield' },
  'link-lost': { label: 'Link lost: failsafe firm', meaning: 'Lost the Membrane link and fell back to firm locally. Grid service continues.', color: '#5ED3E6', icon: 'link-break' },
  shadow: { label: 'Shadow mode', meaning: 'Phase 0: logging only, never dispatched', color: '#8FA3C8', icon: 'eye' },
  offline: { label: 'Offline / maintenance', meaning: 'Not drawing load', color: '#5B6B88', icon: 'wrench' },
}
export const STATE_ORDER: SiteState[] = ['normal', 'prepositioning', 'battery', 'curtailing', 'firm-only', 'link-lost', 'shadow', 'offline']

// ---------------------------------------------------------------- fleet
export type LoadType = 'ai-training' | 'ai-inference' | 'colocation' | 'cloud' | 'industrial'
export const LOAD_TYPES: Record<LoadType, { label: string }> = {
  'ai-training': { label: 'AI training' },
  'ai-inference': { label: 'AI inference' },
  colocation: { label: 'Colocation' },
  cloud: { label: 'Cloud' },
  industrial: { label: 'Industrial' },
}

export interface SiteConfig {
  id: string
  name: string // fictional
  county: string
  loadType: LoadType
  lngLat: [number, number]
  sub: string
  requestedMW: number
  firmMW: number
  flexMW: number
  battery: { mw: number; mwh: number }
  mode: 'active' | 'shadow' | 'offline'
  rampUpMWs: number // flexible ramp-up cap, MW per second
  rampDownMWs: number // grid-draw ramp-down cap, MW per second
  latencyS: number // command latency to start reacting to a grid event
  hero?: boolean
}

export const FLEET: SiteConfig[] = [
  { id: 'hoosier', name: 'Hoosier Compute Campus', county: 'Hendricks County', loadType: 'ai-training', lngLat: [-86.41, 39.74], sub: 'SUB-HEN', requestedMW: 140, firmMW: 90, flexMW: 50, battery: { mw: 40, mwh: 160 }, mode: 'active', rampUpMWs: 0.5, rampDownMWs: 1.2, latencyS: 3, hero: true },
  { id: 'wabash', name: 'Wabash AI Park', county: 'Boone County', loadType: 'ai-training', lngLat: [-86.47, 39.99], sub: 'SUB-BOO', requestedMW: 300, firmMW: 200, flexMW: 100, battery: { mw: 60, mwh: 240 }, mode: 'active', rampUpMWs: 0.8, rampDownMWs: 2.2, latencyS: 6, },
  { id: 'circle-city', name: 'Circle City Colo', county: 'Marion County', loadType: 'colocation', lngLat: [-86.0, 39.88], sub: 'SUB-MNE', requestedMW: 120, firmMW: 90, flexMW: 30, battery: { mw: 20, mwh: 80 }, mode: 'active', rampUpMWs: 0.4, rampDownMWs: 1.0, latencyS: 4 },
  { id: 'eagle-creek', name: 'Eagle Creek Cloud', county: 'Marion County', loadType: 'cloud', lngLat: [-86.33, 39.87], sub: 'SUB-MNW', requestedMW: 180, firmMW: 120, flexMW: 60, battery: { mw: 30, mwh: 120 }, mode: 'active', rampUpMWs: 0.6, rampDownMWs: 1.6, latencyS: 5 },
  { id: 'southport', name: 'Southport Inference Hub', county: 'Marion County', loadType: 'ai-inference', lngLat: [-86.13, 39.63], sub: 'SUB-MS', requestedMW: 60, firmMW: 50, flexMW: 10, battery: { mw: 10, mwh: 40 }, mode: 'active', rampUpMWs: 0.3, rampDownMWs: 0.8, latencyS: 2 },
  { id: 'morgan-meadows', name: 'Morgan Meadows Compute', county: 'Morgan County', loadType: 'ai-training', lngLat: [-86.33, 39.42], sub: 'SUB-MOR', requestedMW: 200, firmMW: 130, flexMW: 70, battery: { mw: 40, mwh: 160 }, mode: 'shadow', rampUpMWs: 0.6, rampDownMWs: 1.8, latencyS: 4 },
]
export const HERO_ID = 'hoosier'

// ---------------------------------------------------------------- substations (generalized, generic names)
export interface SubConfig { id: string; name: string; lngLat: [number, number]; kv: 345 | 138; planningAreaMW: number }
export const SUBSTATIONS: SubConfig[] = [
  { id: 'SUB-HEN', name: 'Sub-Hendricks West', lngLat: [-86.45, 39.76], kv: 345, planningAreaMW: 520 },
  { id: 'SUB-BOO', name: 'Sub-Boone North', lngLat: [-86.43, 39.96], kv: 138, planningAreaMW: 410 },
  { id: 'SUB-MNE', name: 'Sub-Marion Northeast', lngLat: [-86.04, 39.9], kv: 138, planningAreaMW: 380 },
  { id: 'SUB-MNW', name: 'Sub-Marion Northwest', lngLat: [-86.29, 39.89], kv: 138, planningAreaMW: 440 },
  { id: 'SUB-MS', name: 'Sub-Marion South', lngLat: [-86.16, 39.65], kv: 138, planningAreaMW: 300 },
  { id: 'SUB-MOR', name: 'Sub-Morgan', lngLat: [-86.37, 39.44], kv: 138, planningAreaMW: 350 },
  { id: 'SUB-HAM', name: 'Sub-Hamilton', lngLat: [-86.07, 40.06], kv: 138, planningAreaMW: 260 },
]

// ---------------------------------------------------------------- schematic corridors (NOT real line routes)
// Nodes are plant ids (lng/lat from plants.geojson at runtime) or substation ids. `via` adds a schematic jog.
export interface LineConfig { id: string; a: string; b: string; kv: 345 | 138; staticMW: number; via?: [number, number][] }
export const LINES: LineConfig[] = [
  { id: 'L-345-1', a: 'petersburg', b: 'eagle-valley', kv: 345, staticMW: 1200, via: [[-86.95, 39.0]] },
  { id: 'L-345-2', a: 'eagle-valley', b: 'SUB-HEN', kv: 345, staticMW: 1100, via: [[-86.46, 39.62]] },
  { id: 'L-345-3', a: 'eagle-valley', b: 'harding', kv: 345, staticMW: 1100, via: [[-86.30, 39.6]] },
  { id: 'L-345-4', a: 'harding', b: 'SUB-MNE', kv: 345, staticMW: 1000, via: [[-86.05, 39.78]] },
  { id: 'L-138-1', a: 'SUB-HEN', b: 'SUB-BOO', kv: 138, staticMW: 420 },
  { id: 'L-138-2', a: 'harding', b: 'SUB-MS', kv: 138, staticMW: 380 },
  { id: 'L-138-3', a: 'georgetown', b: 'SUB-MNW', kv: 138, staticMW: 400 },
  { id: 'L-138-4', a: 'georgetown', b: 'SUB-MNE', kv: 138, staticMW: 400, via: [[-86.14, 39.92]] },
  { id: 'L-138-5', a: 'SUB-BOO', b: 'SUB-MNW', kv: 138, staticMW: 390, via: [[-86.36, 39.93]] },
  { id: 'L-138-6', a: 'SUB-MNW', b: 'SUB-HEN', kv: 138, staticMW: 420, via: [[-86.37, 39.83]] },
  { id: 'L-138-7', a: 'SUB-MNE', b: 'SUB-HAM', kv: 138, staticMW: 350, via: [[-86.05, 39.98]] },
  { id: 'L-138-8', a: 'eagle-valley', b: 'SUB-MOR', kv: 138, staticMW: 380 },
  { id: 'L-138-9', a: 'harding', b: 'SUB-MNW', kv: 138, staticMW: 380, via: [[-86.24, 39.78]] },
]

// ---------------------------------------------------------------- map locations & cameras
export const CAMERAS = {
  conus: { center: [-96.5, 38.6] as [number, number], zoom: 3.55, pitch: 0, bearing: 0 },
  indiana: { center: [-86.3, 39.75] as [number, number], zoom: 8.35, pitch: 0, bearing: 0 },
  metro: { center: [-86.25, 39.78] as [number, number], zoom: 9.55, pitch: 0, bearing: 0 },
}

// ---------------------------------------------------------------- fixed demo ledger key (labeled "demo key" in the UI)
// Filled in at milestone 9. Kept here so the key never drifts from the config.
export const DEMO_KEY_LABEL = 'demo key'

export const SIM_BADGE = 'SIMULATED DATA — illustrative'
export const DAY_SECONDS = 86400
