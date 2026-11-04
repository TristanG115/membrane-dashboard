import type { SiteSnap } from './snapshot'

export const RUNGS = [
  { n: 1, label: 'Firm load is always served', detail: 'Inference and revenue-critical work. Never touched.' },
  { n: 2, label: 'Flexible jobs run on grid headroom', detail: 'Only when the cautious P10 forecast allows it.' },
  { n: 3, label: 'Battery covers the gap', detail: 'Discharges to hold flexible work through a stress window.' },
  { n: 4, label: 'Flexible training checkpoints and pauses', detail: 'In priority order, only after headroom and battery are used.' },
  { n: 5, label: 'Failsafe: drop to firm', detail: 'On loss of control or telemetry, or a Max Gen Event.' },
] as const

/** Highest rung currently engaged for a site. */
export function activeRung(s: SiteSnap): number {
  if (s.state === 'link-lost' || s.state === 'firm-only' || s.failsafe) return 5
  if (s.curtailed > 0.5) return 4
  if (s.b > 0.5) return 3
  if (s.g > 0.5) return 2
  return 1
}
