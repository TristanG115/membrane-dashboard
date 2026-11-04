import { CheckCircle, Info, Lightning, Warning, WarningDiamond, WarningOctagon } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { ALERTS, SIM_BADGE } from '../config/scenario'
import { Sparkline } from '../charts/Sparkline'
import { activeCallouts, alertAt, clampT, fleetSummary } from '../lib/snapshot'
import { TABS, useStore, type Role } from '../store'
import { fmtClock, parseTime } from '../sim/time'

const ALERT_ICONS = [CheckCircle, Info, Warning, WarningDiamond, WarningOctagon, Lightning]
const f0 = (n: number) => Math.round(n).toLocaleString('en-US')

export function AlertChip({ level }: { level: number }) {
  const a = ALERTS[level]
  const Icon = ALERT_ICONS[level]
  return (
    <span className={`chip ${level >= 3 ? 'pulse' : ''}`} style={{ background: a.color }} key={level}>
      <Icon size={16} weight="fill" aria-hidden />
      {a.label}
    </span>
  )
}

export function TopBar() {
  const { t, tl, tab, role, setTab, setRole, setAbout, present } = useStore()
  const i = clampT(t)
  const sum = useMemo(() => fleetSummary(tl, t), [tl, t])
  const alert = alertAt(tl, t)
  const callouts = activeCallouts(tl, t)
  // load sparkline: 15-minute samples across the day, actual drawn up to now
  const spark = useMemo(() => {
    const act = new Float32Array(96), fc = new Float32Array(96)
    for (let k = 0; k < 96; k++) { act[k] = tl.sys.load[k * 900]; fc[k] = tl.sys.loadFcst[k * 900] }
    return { act, fc }
  }, [tl])
  const activeFlex = tl.sites.filter((s) => s.cfg.mode === 'active').reduce((a, s) => a + s.cfg.flexMW, 0)

  return (
    <>
      <div className="row1">
        <div className="brand"><b>The Membrane</b><span>Operator Console</span></div>
        <nav className="tabs" role="tablist" aria-label="Views">
          {TABS.map((x, k) => (
            <button key={x.id} role="tab" className="tab" title={x.label} aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
              <kbd>{k + 1}</kbd>{x.short}
            </button>
          ))}
        </nav>
        {!present && <button className="ghost" title="About & data sources" onClick={() => setAbout(true)}><span className="about-label">About &amp; data sources</span><span className="about-short">About</span></button>}
        <div className="seg" role="group" aria-label="View as">
          {(['operator', 'regulator', 'public'] as Role[]).map((r) => (
            <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}</button>
          ))}
        </div>
        <span className="simbadge" title="All telemetry, prices, forecasts and most requests in this console are simulated">{SIM_BADGE}</span>
      </div>

      <div className="metrics" aria-label="Current grid conditions">
        <div className="metric">
          <span className="k">AES Indiana load vs forecast</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="v num">{f0(tl.sys.load[i])}<small>MW</small></span>
            <Sparkline actual={spark.act} forecast={spark.fc} nowIdx={Math.floor(i / 900)} w={78} h={24} />
          </span>
        </div>
        <div className="metric"><span className="k">MISO Indiana Hub</span><span className="v num">${tl.sys.lmp[i].toFixed(2)}<small>/MWh</small></span></div>
        <div className="metric"><span className="k">MISO alert state</span><AlertChip level={alert.level} /></div>
        <div className="metric"><span className="k">Temperature · wind</span><span className="v num">{Math.round(tl.sys.temp[i])}°F<small>{Math.round(tl.sys.wind[i])} mph</small></span></div>
        <div className="metric"><span className="k">DLR uplift</span><span className="v num">+{tl.sys.dlr[i].toFixed(1)}<small>%</small></span></div>
        <div className="metric"><span className="k">Fleet flexible MW</span><span className="v num">{f0(sum.flexAvail)}<small>of {f0(activeFlex)} MW</small></span></div>
        <div className="metric"><span className="k">Battery fleet SOC</span><span className="v num">{Math.round(sum.soc * 100)}<small>%</small></span></div>
        <div className="metric"><span className="k">Curtailed so far today</span><span className="v num">{sum.curtailMW.toFixed(1)}<small>MW now</small></span><span className="sub num">{sum.curtailMWh.toFixed(1)} MWh today</span></div>
        <div className="metric"><span className="k">Ledger ↔ meter match</span><span className="v num">{tl.sys.match[i].toFixed(2)}<small>%</small></span></div>
        <div className="metric"><span className="k">Simulation clock</span><span className="v num">{fmtClock(t)}</span></div>
      </div>

      <div className="strip" aria-label="Warnings and predictions">
        <span className="lab">Warnings &amp; predictions</span>
        {callouts.length === 0 && <span className="dim" style={{ fontSize: 12.5 }}>No active forecast callouts</span>}
        {callouts.map((c) => (
          <button key={c.text} className={`callout ${c.tone}`} title="Jump to the relevant view and time" onClick={() => { if (c.tab) setTab(c.tab); if (c.t) useStore.getState().seek(parseTime(c.t)) }}>
            {c.tone === 'alert' ? <WarningOctagon size={14} weight="fill" color="#E0633A" /> : c.tone === 'warn' ? <Warning size={14} weight="fill" color="#E3C55B" /> : <Info size={14} weight="fill" color="#A9B0FE" />}
            {c.text}
          </button>
        ))}
      </div>
    </>
  )
}
