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

// ---------------------------------------------------------------- economics (140 MW case)
// Every input is editable in the Economics tab. `kind` says where the default comes from:
//   deck  = the team's deck / canonical case      cited = a public source (see `source`, `url`)      team = team assumption, not a sourced figure
export type AssumptionKind = 'deck' | 'cited' | 'team'
export interface Assumption {
  id: string; label: string; unit: string; value: number; min: number; max: number; step: number
  group: 'capital' | 'operations' | 'benefits' | 'market' | 'contract' | 'guardrail'
  kind: AssumptionKind; source: string; url?: string
}
// Each entry was read in a public source on 2026-11-04. Secondary sources are described as such.
export const SOURCES = {
  cbre: { label: 'CBRE average asking rate $184/kW-month for 250-500 kW deployments, H1 2025 (via Data Center Knowledge). CBRE H2 2025 is reported near $196.', url: 'https://www.datacenterknowledge.com/colocation/power-not-space-the-colocation-battleground-in-2026' },
  pra: { label: 'MISO 2026/27 Planning Resource Auction: Zones 1-7 summer $424.30/MW-day, annualized Zone 6 average $126.19/MW-day (via Enel North America summary of MISO results)', url: 'https://www.enelnorthamerica.com/insights/blogs/miso-2026-2027-capacity-auction-results' },
  hea: { label: 'Indiana HEA 1007 (2025): large-load customers must cover at least 80% of costs reasonably allocable to them; the IURC found the Google contract meets it (press accounts, order not read)', url: 'https://mgrid.org/2026/10/10/indiana-approves-aess-plan-for-googles-390-mw-monrovia-data-center-and-puts-73-8-million-of-upgrades-in-rate-base/' },
  duke: { label: 'Duke Nicholas Institute, "Rethinking Load Growth" (Feb 2025): about 85 curtailment hours/yr at the 0.25% case (via Facilities Dive)', url: 'https://www.facilitiesdive.com/news/us-grid-headroom-flexible-load-data-center-ai-ev-duke-report/739938/' },
  google: { label: 'IURC approval, Cause No. 46394 (7 Oct 2026): 390 MW Monrovia site, $737.3M project, $73.8M of network upgrades in rate base, contract of at least 15 years (press accounts)', url: 'https://mgrid.org/2026/10/10/indiana-approves-aess-plan-for-googles-390-mw-monrovia-data-center-and-puts-73-8-million-of-upgrades-in-rate-base/' },
} as const

export const ECON: Assumption[] = [
  { id: 'batteryGrossM', label: 'Battery, gross installed cost', unit: '$M', value: 48, min: 30, max: 70, step: 0.5, group: 'capital', kind: 'deck', source: 'Deck: 40 MW / 160 MWh, $300/kWh installed' },
  { id: 'itcRate', label: 'Section 48E investment tax credit', unit: '%', value: 30, min: 0, max: 50, step: 1, group: 'capital', kind: 'deck', source: 'Deck: $14.4M on $48M gross' },
  { id: 'itcRealization', label: 'ITC realized (100% = owner uses it; a transfer sale prices below par)', unit: '%', value: 100, min: 80, max: 100, step: 1, group: 'capital', kind: 'team', source: 'Team assumption. Lower it to model selling the credit through transferability.' },
  { id: 'integrationM', label: 'Membrane integration', unit: '$M', value: 2.4, min: 0.5, max: 6, step: 0.1, group: 'capital', kind: 'deck', source: 'Deck' },
  { id: 'licenseK', label: 'Membrane software license', unit: '$k/yr', value: 360, min: 0, max: 900, step: 10, group: 'operations', kind: 'deck', source: 'Deck: about $360k/yr' },
  { id: 'eventCostK', label: 'Deferred compute per 4-hour event', unit: '$k', value: 60, min: 0, max: 150, step: 5, group: 'operations', kind: 'deck', source: 'Deck: about $50-70k per 4-hour event' },
  { id: 'eventsPerYr', label: 'Curtailment events per year', unit: 'events', value: 21, min: 0, max: 60, step: 1, group: 'operations', kind: 'cited', source: '85 stress hours per year (Duke 2025, 0.25% case) divided by 4-hour events, rounded', url: SOURCES.duke.url },
  { id: 'omPct', label: 'Battery O&M, % of gross cost per year', unit: '%', value: 2.5, min: 0, max: 5, step: 0.1, group: 'operations', kind: 'team', source: 'Team assumption' },
  { id: 'interimYears', label: 'Interim-service term (curtailment possible)', unit: 'years', value: 5, min: 1, max: 7, step: 1, group: 'contract', kind: 'deck', source: 'Deck default 5 years. SPP CHILLS allows up to 7.' },
  { id: 'horizonYears', label: 'Analysis horizon and AES contract life', unit: 'years', value: 15, min: 5, max: 20, step: 1, group: 'contract', kind: 'team', source: 'Team assumption. The Cause No. 46394 contract is at least 15 years.', url: SOURCES.google.url },
  { id: 'discountPct', label: 'Discount rate', unit: '%', value: 10, min: 4, max: 18, step: 0.5, group: 'contract', kind: 'team', source: 'Team assumption (blended cost of capital)' },
  { id: 'tollPerKWMonth', label: 'Storage-as-a-service payment (AES-owned model)', unit: '$/kW-month', value: 12, min: 4, max: 25, step: 0.25, group: 'contract', kind: 'team', source: 'Team assumption, sized so AES earns a contracted return. Not a quoted market price.' },
  { id: 'monthsEarly', label: 'Months energized earlier than firm-only service', unit: 'months', value: 24, min: 0, max: 60, step: 1, group: 'benefits', kind: 'team', source: 'Team assumption. The break-even chart shows how few months are needed.' },
  { id: 'itMW', label: 'IT load energized early', unit: 'MW', value: 140, min: 0, max: 140, step: 5, group: 'benefits', kind: 'deck', source: 'Deck: 140 MW request' },
  { id: 'revPerMWMonthK', label: 'Revenue per MW-month of IT load', unit: '$k', value: 130, min: 60, max: 220, step: 5, group: 'benefits', kind: 'cited', source: 'Team default, set below CBRE asking rates ($184/kW-month H1 2025, 250-500 kW blocks) because hyperscale leases price lower.', url: SOURCES.cbre.url },
  { id: 'marginPct', label: 'Operating margin on that revenue (after power and wires bills)', unit: '%', value: 45, min: 20, max: 70, step: 1, group: 'benefits', kind: 'team', source: 'Team assumption' },
  { id: 'avoidedGenM', label: 'Avoided on-site gas or diesel while energized early', unit: '$M/yr', value: 1.5, min: 0, max: 10, step: 0.1, group: 'benefits', kind: 'team', source: 'Team assumption' },
  { id: 'wiresPerMWh', label: 'AES Indiana wires and energy margin', unit: '$/MWh', value: 14, min: 0, max: 40, step: 1, group: 'benefits', kind: 'team', source: 'Team assumption' },
  { id: 'loadFactorPct', label: 'Data center load factor', unit: '%', value: 75, min: 40, max: 95, step: 1, group: 'benefits', kind: 'team', source: 'Team assumption' },
  { id: 'dividendPct', label: 'Utilization dividend: share of AES Indiana margin on early load credited to ratepayers', unit: '%', value: 25, min: 0, max: 100, step: 5, group: 'benefits', kind: 'team', source: 'Team proposal for the pilot' },
  { id: 'arbKWYr', label: 'Energy arbitrage', unit: '$/kW-yr', value: 30, min: 0, max: 80, step: 1, group: 'market', kind: 'team', source: 'Team assumption. Potential, subject to MISO/IURC rules.' },
  { id: 'accredPct', label: 'Capacity accreditation of the battery', unit: '% of MW', value: 60, min: 0, max: 100, step: 5, group: 'market', kind: 'team', source: 'Team assumption. Potential, subject to MISO/IURC rules.' },
  { id: 'praPerMWDay', label: 'MISO capacity price, annualized', unit: '$/MW-day', value: 126.19, min: 0, max: 700, step: 1, group: 'market', kind: 'cited', source: SOURCES.pra.label, url: SOURCES.pra.url },
  { id: 'ancKWYr', label: 'Ancillary services', unit: '$/kW-yr', value: 6, min: 0, max: 30, step: 1, group: 'market', kind: 'team', source: 'Team assumption. Potential, subject to MISO/IURC rules.' },
  { id: 'aesSharePct', label: 'Battery market revenue kept by AES (AES-owned model)', unit: '%', value: 50, min: 0, max: 100, step: 5, group: 'market', kind: 'team', source: 'Team assumption. The rest is credited to the data center.' },
  { id: 'upgradeM', label: 'Utility interconnection and network upgrades allocable to the site', unit: '$M', value: 24, min: 0, max: 150, step: 1, group: 'guardrail', kind: 'team', source: 'Team assumption, for illustration' },
  { id: 'dcUpgradeSharePct', label: 'Share of those upgrades the data center pays directly', unit: '%', value: 90, min: 0, max: 100, step: 1, group: 'guardrail', kind: 'cited', source: 'Cause No. 46394 put $73.8M of $737.3M (about 10%) in rate base', url: SOURCES.google.url },
  { id: 'heaThresholdPct', label: 'HEA 1007 cost-coverage threshold', unit: '%', value: 80, min: 0, max: 100, step: 1, group: 'guardrail', kind: 'cited', source: SOURCES.hea.label, url: SOURCES.hea.url },
]
export const ECON_DEFAULTS: Record<string, number> = Object.fromEntries(ECON.map((a) => [a.id, a.value]))

// ---------------------------------------------------------------- service agreement & reliability
export interface EvidenceItem { id: string; who: string; what: string; when: string; caveat: string; source: string; url: string }
// Each item was read in a public source on 2026-11-04.
export const EVIDENCE: EvidenceItem[] = [
  { id: 'google-iandm-tva', who: 'Google with Indiana Michigan Power and TVA', what: 'First demand-response agreements to pause or reschedule machine-learning workloads when the grid is stressed. Search, Maps and other essential services are not affected.', when: 'Announced 4 Aug 2025', caveat: 'The I&M piece covers the Fort Wayne site and went to the IURC. We did not confirm its final approval.', source: 'The Register', url: 'https://www.theregister.com/2025/08/04/google_ai_datacenter_grid/' },
  { id: 'google-1gw', who: 'Google with I&M, TVA, Entergy Arkansas, Minnesota Power and DTE Energy', what: 'Google reports 1 GW of demand response written into long-term utility contracts so data centers connect faster. It can "limit or shift a portion of machine learning workloads".', when: '19 Mar 2026', caveat: 'Google says there are limits to how flexible a given data center can be, and the capability is only available at certain locations. 1 GW is contracted capacity, not one dispatch.', source: 'Google blog', url: 'https://blog.google/innovation-and-ai/infrastructure-and-cloud/global-network/demand-response-data-center-milestone/' },
  { id: 'emerald-phoenix', who: 'Emerald AI with Nvidia, Oracle Cloud, Databricks and Salt River Project (EPRI DCFlex)', what: 'A 256-GPU cluster in Oracle’s Phoenix region cut power 25% for three hours, after a 15-minute ramp-down, during an SRP system peak, and met its AI service targets.', when: '1 and 3 May 2025', caveat: 'One cluster, two events. The paper is a 2025 arXiv preprint.', source: 'Nvidia blog', url: 'https://blogs.nvidia.com/blog/ai-factories/' },
  { id: 'spp-chills', who: 'Southwest Power Pool (CHILLS)', what: 'FERC approved non-firm transmission service for large loads for up to seven years while they obtain firm service. SPP can curtail it when the system is constrained or in an emergency.', when: 'FERC acceptance 5 Jun 2026', caveat: 'The tariff sets no cap on how often or how long SPP can curtail. Our contract builder adds that cap.', source: 'Utility Dive', url: 'https://www.utilitydive.com/news/ferc-spp-chills-large-load-transmission-service/822211/' },
  { id: 'pjm-nonfirm', who: 'PJM (FERC directive)', what: 'FERC directed PJM to create firm and non-firm contract-demand services, plus an interim non-firm service until network upgrades finish.', when: 'Dec 2025 order, 18 Jun 2026 follow-up', caveat: 'FERC found PJM’s first compliance proposal insufficiently flexible and ordered a further filing.', source: 'Mondaq legal summary', url: 'https://webiis08.mondaq.com/unitedstates/energy-law/1730084/ferc-directs-pjm-to-facilitate-faster-integration-of-large-electric-loads-including-data-centers' },
  { id: 'miso-flex', who: 'MISO (FERC directive)', what: 'FERC directed MISO to add a flexible transmission service for large loads willing to limit their use of the system. MISO is also weighing a staged "firm service step-up" while upgrades finish.', when: '2026', caveat: 'We could not find the name "FLITS" in public sources, so this console says "MISO’s flexible large-load service". Filing status not confirmed.', source: 'Akin Gump summary', url: 'https://www.akingump.com/en/insights/blogs/speaking-energy/ferc-directs-midcontinent-independent-system-operator-to-revise-tariff-to-expedite-data-center-development' },
]

export interface ContractDefaults { termYears: number; maxTermYears: number; firmMW: number[]; btmFirmEquivMW: number[]; curtailCapHours: number; noticeHours: number }
// Year-by-year utility firm MW as upgrades finish, plus firm-equivalent MW from an optional behind-the-meter build-out (solar and more storage).
export const CONTRACT: ContractDefaults = {
  termYears: 5, maxTermYears: 7,
  firmMW: [90, 90, 105, 120, 130, 140, 140, 140, 140, 140],
  btmFirmEquivMW: [0, 0, 5, 10, 5, 0, 0, 0, 0, 0],
  curtailCapHours: 100, noticeHours: 24,
}

// ---------------------------------------------------------------- fixed demo ledger key (labeled "demo key" in the UI)
// Filled in at milestone 9. Kept here so the key never drifts from the config.
export const DEMO_KEY_LABEL = 'demo key'

export const SIM_BADGE = 'SIMULATED DATA — illustrative'
export const DAY_SECONDS = 86400
