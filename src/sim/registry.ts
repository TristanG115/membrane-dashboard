import stress from '../scenarios/stress-day.json'
import escalation from '../scenarios/maxgen-escalation.json'
import telemetry from '../scenarios/telemetry-loss.json'
import worst from '../scenarios/worst-case.json'
import { buildTimeline } from './engine'
import type { ScenarioDef, Timeline } from './types'

export const SCENARIOS = [stress, worst, telemetry, escalation] as unknown as ScenarioDef[]
export const DEFAULT_SCENARIO = 'stress-day'
const cache = new Map<string, Timeline>()

export function getTimeline(id: string): Timeline {
  const def = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
  let tl = cache.get(def.id)
  if (!tl) { tl = buildTimeline(def); cache.set(def.id, tl) }
  return tl
}
