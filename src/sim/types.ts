import type { AlertLevel, SiteConfig, SiteState } from '../config/scenario'

export type Severity = 'info' | 'warn' | 'alert' | 'ok'
export type TabId = 'map' | 'dispatch' | 'agreement' | 'economics' | 'forecaster' | 'scorecard' | 'markets' | 'requests' | 'ledger'
export type CameraView = 'conus' | 'indiana' | 'metro'

export interface CameraCue {
  flyTo?: CameraView | { center: [number, number]; zoom: number }
  focusSite?: string
  focusSubs?: string[]
  openSite?: string
  fleetPanel?: boolean
  tab?: TabId
}
export interface BeatDef { t: string; title: string; text: string; severity: Severity; phase?: 'predict' | 'prepare' | 'react' | 'recover'; camera?: CameraCue }
export interface CalloutDef { from: string; until: string; text: string; tone: Severity; tab?: TabId; t?: string }
export interface LinkLossDef { site: string; from: string; to: string }

export interface ScenarioDef {
  id: string
  name: string
  description: string
  group: 'story' | 'event'
  seed: number
  start: string
  weather: { tempPeakF: number; windMph: number }
  alerts: [string, AlertLevel][]
  headroom: Record<string, [string, number][]> // MW per 50 MW of site flex, keyed by substation id or '*'
  levelFlexFrac?: Partial<Record<AlertLevel, number>>
  affected: string[] | 'all'
  linkLoss?: LinkLossDef[]
  initialSoc?: number
  socOverride?: Record<string, number>
  beats: BeatDef[]
  callouts: CalloutDef[]
}

export interface SiteSeries {
  cfg: SiteConfig
  g: Float32Array // flexible MW served from grid headroom (commanded, ramp-limited)
  b: Float32Array // battery discharge MW
  chg: Float32Array // battery charge MW (drawn from grid)
  soc: Float32Array // 0..1
  flexRun: Float32Array // flexible MW running (g + b)
  curtailed: Float32Array
  gridDraw: Float32Array // what the utility meter sees (utility channel)
  hdr: Float32Array // actual headroom MW above firm at the site's substation
  p10: Float32Array
  state: Uint8Array // index into STATE_ORDER
  linkUp: Uint8Array
  lastSeen: Uint32Array // last second the Membrane platform heard from this site
  failsafe: Uint8Array // controller in local failsafe
}

export interface FleetSiteStep { id: string; steppedMW: number; tFirmS: number | null; confirmedS: number | null }
export interface FleetEvent { t0: number; level: AlertLevel; sites: FleetSiteStep[] }

export interface TimelineEvent { t: number; id: string; title: string; text: string; severity: Severity; siteId?: string; kind: 'beat' | 'link-lost' | 'link-restored' | 'firm-only' | 'resume' }

export interface Timeline {
  def: ScenarioDef
  sites: SiteSeries[]
  alert: Uint8Array
  sys: { load: Float32Array; loadFcst: Float32Array; lmp: Float32Array; temp: Float32Array; wind: Float32Array; dlr: Float32Array; match: Float32Array }
  curtailMWhCum: Float32Array
  fleetEvents: FleetEvent[]
  events: TimelineEvent[]
  beatsT: number[]
}
export type { SiteState }
