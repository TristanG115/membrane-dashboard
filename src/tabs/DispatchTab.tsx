import { LinkBreak, ArrowCounterClockwise } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { FailsafeChart } from '../charts/FailsafeChart'
import { RampMeter, SocGauge } from '../charts/Gauges'
import { StackedArea } from '../charts/StackedArea'
import { CANONICAL, FLEET, HERO_ID, STATE_META } from '../config/scenario'
import { StateBadge } from '../components/FleetPanel'
import { JOBS, jobState, type JobState } from '../lib/jobs'
import { activeRung, RUNGS } from '../lib/ladder'
import { clampT, siteAt } from '../lib/snapshot'
import { fmtClock, parseTime } from '../sim/time'
import { useStore } from '../store'

const JOB_LABEL: Record<JobState, string> = { running: 'Running', checkpointing: 'Checkpointing…', paused: 'Paused', resuming: 'Resuming from checkpoint' }
const JOB_COLOR: Record<JobState, string> = { running: 'var(--text-dim)', checkpointing: 'var(--warn)', paused: 'var(--curtail)', resuming: 'var(--battery)' }

export function DispatchTab() {
  const { tl, t, injected, injectLoss, clearInjected } = useStore()
  const idx = FLEET.findIndex((s) => s.id === HERO_ID)
  const cfg = FLEET[idx]
  const s = tl.sites[idx]
  const sn = siteAt(tl, idx, t)
  const rung = activeRung(sn)
  const i = clampT(t)
  const rate = (s.gridDraw[i] - s.gridDraw[Math.max(0, i - 4)]) / 4

  // the link-loss window to explain: the latest one that has started, otherwise the next one
  const windows = (tl.def.linkLoss ?? []).filter((w) => w.site === HERO_ID).map((w) => ({ from: parseTime(w.from), to: parseTime(w.to) })).sort((a, b) => a.from - b.from)
  const win = [...windows].reverse().find((w) => w.from <= t) ?? windows[0]

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 12, gap: 12 }}>
        <StateBadge state={sn.state} size={26} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{cfg.name} <span className="dim" style={{ fontWeight: 400 }}>· {CANONICAL.requestedMW} MW request, {CANONICAL.firmMW} firm + {CANONICAL.flexMW} flexible, {CANONICAL.battery.mw} MW / {CANONICAL.battery.mwh} MWh battery</span></div>
          <div style={{ color: STATE_META[sn.state].color, fontSize: 13 }}>{STATE_META[sn.state].label} · {STATE_META[sn.state].meaning}</div>
        </div>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          {injected && <button className="ghost" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }} onClick={clearInjected} title="Remove the simulated loss"><ArrowCounterClockwise size={14} /> Undo</button>}
          <button className="bigbtn" style={{ width: 270 }} onClick={() => injectLoss(HERO_ID)} aria-label="Simulate telemetry loss" title={`Drops the Membrane link in 5 s. The controller must reach ${cfg.firmMW} MW on its own.`}><LinkBreak size={22} weight="bold" /> Simulate telemetry loss</button>
        </div>
        <div style={{ textAlign: 'right', minWidth: 170 }} className="num">
          <div className="big">{Math.round(sn.gridDraw)} <span className="dim" style={{ fontSize: 13 }}>MW from the grid</span></div>
          <div className="dim" style={{ fontSize: 12 }}>utility meter · {fmtClock(t)}</div>
        </div>
      </div>

      <div className="dispatch">
        <div className="stack">
          <div className="card">
            <h3>Dispatch ladder <small>highest engaged rung lights up</small></h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {[...RUNGS].reverse().map((r) => (
                <div key={r.n} className={`rung ${rung === r.n ? 'on' : ''} r${r.n}`}>
                  <span className="n">{r.n}</span>
                  <div><b>{r.label}</b><span>{r.detail}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Battery <small>{cfg.battery.mw} MW · {cfg.battery.mwh} MWh · 4 h</small></h3>
            <SocGauge soc={sn.soc} mwh={cfg.battery.mwh} mw={cfg.battery.mw} flow={sn.b > 0.5 ? sn.b : -sn.chg} />
          </div>
          <div className="card">
            <h3>Ramp rate at the utility meter <small>cap {cfg.rampDownMWs} MW/s</small></h3>
            <RampMeter rate={rate} cap={cfg.rampDownMWs} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Stress-day dispatch <small>{tl.def.name} · simulated</small></h3>
            <StackedArea tl={tl} idx={idx} t={t} />
          </div>
          <div className="card">
            <h3>Worst case: comms lost mid-event <small>second by second · simulated</small></h3>
            {win ? (
              <>
                <FailsafeChart tl={tl} idx={idx} t0={win.from} t={t} />
                <FailsafeSteps tl={tl} idx={idx} t0={win.from} />
              </>
            ) : (
              <div className="dim" style={{ padding: '14px 0' }}>No link loss has been scheduled for this site in “{tl.def.name}”. Press <b>Simulate telemetry loss</b>, or open the “Worst Case: Comms Lost at Peak” scenario to see comms lost at 17:45 with the battery already partly drained.</div>
            )}
          </div>
          <div className="card">
            <h3>What happens when something fails <small>fault tree</small></h3>
            <FaultTree firm={cfg.firmMW} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Job queue <small>illustrative workload mix</small></h3>
            <div className="dim" style={{ fontSize: 12, margin: '0 0 6px' }}>Inference is firm. Training is flexible and pauses in reverse priority.</div>
            {(['firm', 'flex'] as const).map((tier) => (
              <div key={tier} style={{ marginBottom: 8 }}>
                <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0 4px' }}>
                  <b style={{ fontWeight: 600, fontSize: 12.5, color: tier === 'firm' ? 'var(--firm)' : 'var(--flex)' }}>{tier === 'firm' ? 'Inference (firm tier)' : 'Training (flexible tier)'}</b>
                  <span className="dim num" style={{ fontSize: 12 }}>{tier === 'firm' ? `${cfg.firmMW} MW` : `${Math.round(sn.flexRun)} of ${cfg.flexMW} MW running`}</span>
                </div>
                {JOBS.filter((j) => j.tier === tier).map((j) => {
                  const st = jobState(s, j, t)
                  return (
                    <div key={j.id} className={`job ${tier} ${st}`}>
                      <span>{j.name}{j.priority ? <span className="faint"> · priority {j.priority}</span> : null}</span>
                      <span className="num dim">{j.mw} MW</span>
                      <span className="st" style={{ color: JOB_COLOR[st], textAlign: 'left', gridColumn: '1 / 3' }}>{tier === 'firm' ? 'Running · never touched' : JOB_LABEL[st]}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="card">
            <h3>Utility channel <small>independent of our platform</small></h3>
            <div className="kv num"><span>Meter (AES SCADA)</span><span style={{ color: 'var(--ok)' }}>reporting · {sn.gridDraw.toFixed(1)} MW</span></div>
            <div className="kv num"><span>Membrane link</span><span style={{ color: sn.linkUp ? 'var(--ok)' : 'var(--linklost)' }}>{sn.linkUp ? 'connected' : `lost · last known ${fmtClock(sn.lastSeenS)}`}</span></div>
            <div className="kv num"><span>Controller</span><span>{sn.failsafe ? 'local failsafe active' : 'following dispatch'}</span></div>
            <div className="kv num"><span>Headroom (P10 / actual)</span><span>{sn.p10.toFixed(0)} / {sn.hdr.toFixed(0)} MW</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Plain-language steps derived from the simulated seconds, not hard-coded. */
function FailsafeSteps({ tl, idx, t0 }: { tl: ReturnType<typeof useStore.getState>['tl']; idx: number; t0: number }) {
  const s = tl.sites[idx]
  const info = useMemo(() => {
    const firm = s.cfg.firmMW
    const pre = s.gridDraw[t0 - 1]
    let tFirm: number | null = null
    for (let u = t0; u < t0 + 300; u++) if (s.gridDraw[u] <= firm + 0.5) { tFirm = u - t0; break }
    let maxDrop = 0, bMax = 0, minDraw = 999
    for (let u = t0; u < t0 + 240; u++) { maxDrop = Math.max(maxDrop, s.gridDraw[u - 1] - s.gridDraw[u]); bMax = Math.max(bMax, s.b[u]); minDraw = Math.min(minDraw, s.gridDraw[u]) }
    const flexBefore = s.flexRun[t0 - 1]
    const paused = JOBS.filter((j) => j.tier === 'flex' && jobState(s, j, t0 + 40) !== 'running').map((j) => j.name)
    return { pre, tFirm, maxDrop, bMax, minDraw, flexBefore, paused, socBefore: s.soc[t0 - 1], socAfter: s.soc[t0 + 40] }
  }, [s, t0])
  const steps: [string, string][] = [
    [fmtClock(t0), 'Membrane link drops. Our platform can no longer reach the site.'],
    [fmtClock(t0 + 3), 'On-site controller detects the loss (3 s heartbeat timeout). It is local, not cloud-dependent, and switches to failsafe.'],
    [fmtClock(t0 + 3), info.pre - s.cfg.firmMW < 0.5 ? `Grid draw is already at the ${s.cfg.firmMW} MW firm limit, so there is no step to bridge.` : `Controller ramps the grid draw ${info.pre.toFixed(0)} → ${s.cfg.firmMW} MW within the ramp cap (${s.cfg.rampDownMWs} MW/s). Firm reached ${info.tFirm} s after the loss.`],
    [fmtClock(t0 + 3), info.bMax > 0.5 ? `Battery bridges up to ${info.bMax.toFixed(0)} MW (state of charge ${Math.round(info.socBefore * 100)}% → ${Math.round(info.socAfter * 100)}%) while flexible jobs checkpoint.` : 'Battery is idle, so jobs checkpoint directly.'],
    [fmtClock(t0 + 30), info.paused.length ? `Flexible jobs checkpointed: ${info.paused.join(', ')}. Inference continues at ${s.cfg.firmMW} MW.` : `Inference continues at ${s.cfg.firmMW} MW.`],
    [fmtClock(t0 + (info.tFirm ?? 0)), `The grid sees a decline of at most ${info.maxDrop.toFixed(2)} MW/s down to ${info.minDraw.toFixed(0)} MW. An uncontrolled trip would drop ${info.pre.toFixed(0)} MW in under a second.`],
  ]
  return (
    <table className="tbl" style={{ marginTop: 8 }}>
      <thead><tr><th style={{ width: 82 }}>Time</th><th>What the site does</th></tr></thead>
      <tbody>{steps.map(([a, b], k) => <tr key={k}><td className="num">{a}</td><td>{b}</td></tr>)}</tbody>
    </table>
  )
}

function FaultTree({ firm }: { firm: number }) {
  const end = `Firm limit ${firm} MW, no grid cliff.`
  const rows: [string, string, string][] = [
    ['Comms loss (Membrane link)', 'Controller times out after 3 s and goes to failsafe on its own.', 'Ramps to firm within the cap while the battery bridges, jobs checkpoint.'],
    ['Meter loss (utility channel)', 'Controller falls back to its own metering and the last signed limit. The ledger buffers entries.', 'Flexible load stops drawing headroom and ramps down within the cap.'],
    ['Battery fault', 'Battery is taken out of the plan. Flexible work is limited to what P10 headroom allows.', 'Excess jobs checkpoint at once. Ramp caps still apply.'],
    ['Comms loss + battery fault', 'No bridge available. The controller ramps down at the cap and jobs checkpoint faster.', 'The grid sees a bounded ramp, never a step.'],
    ['Comms loss + meter loss', 'Controller drops to the firm limit using its own metering.', 'Holds firm until both channels return, then resumes within caps if P10 allows.'],
  ]
  return (
    <table className="tbl">
      <thead><tr><th>Fault</th><th>System response</th><th>Ends at</th></tr></thead>
      <tbody>{rows.map(([a, b, c]) => <tr key={a}><td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{a}</td><td>{b} <span className="dim">{c}</span></td><td style={{ color: 'var(--ok)', whiteSpace: 'nowrap' }}>{end}</td></tr>)}</tbody>
    </table>
  )
}
