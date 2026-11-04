// Illustrative workload mix for the 140 MW site. Inference is firm; training is flexible, paused in reverse priority.
import { clampT } from './snapshot'
import type { SiteSeries } from '../sim/types'

export interface Job { id: string; name: string; tier: 'firm' | 'flex'; mw: number; priority?: number }
export const JOBS: Job[] = [
  { id: 'inf-1', name: 'Search ranking inference', tier: 'firm', mw: 35 },
  { id: 'inf-2', name: 'Assistant serving', tier: 'firm', mw: 30 },
  { id: 'inf-3', name: 'Recommendations inference', tier: 'firm', mw: 15 },
  { id: 'inf-4', name: 'Embedding API', tier: 'firm', mw: 10 },
  { id: 'trn-1', name: 'Foundation model pretraining', tier: 'flex', mw: 20, priority: 1 },
  { id: 'trn-2', name: 'Fine-tuning batch', tier: 'flex', mw: 12, priority: 2 },
  { id: 'trn-3', name: 'Evaluation sweeps', tier: 'flex', mw: 8, priority: 3 },
  { id: 'trn-4', name: 'Distillation and data prep', tier: 'flex', mw: 10, priority: 4 },
]
export type JobState = 'running' | 'checkpointing' | 'paused' | 'resuming'
const TRANSITION_S = 25

const flexJobs = JOBS.filter((j) => j.tier === 'flex')
const cumEnd = (job: Job) => { let c = 0; for (const j of flexJobs) { c += j.mw; if (j.id === job.id) return c } return c }
const on = (s: SiteSeries, job: Job, t: number) => s.flexRun[clampT(t)] + 0.6 >= cumEnd(job)

export function jobState(s: SiteSeries, job: Job, t: number): JobState {
  if (job.tier === 'firm') return 'running'
  const now = on(s, job, t), before = on(s, job, t - TRANSITION_S)
  if (now) return before ? 'running' : 'resuming'
  return before ? 'checkpointing' : 'paused'
}
