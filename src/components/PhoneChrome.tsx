import { CaretDown, CurrencyDollar, DotsThreeOutline, FileText, Gauge, MapTrifold, Pause, Play, X } from '@phosphor-icons/react'
import { useMemo, useRef, type ReactNode } from 'react'
import { SIM_BADGE } from '../config/scenario'
import { activeCallouts, alertAt, clampT, fleetSummary } from '../lib/snapshot'
import { SCENARIOS } from '../sim/registry'
import { fmtClock, parseTime } from '../sim/time'
import { SPEEDS, TABS, useStore, type Role } from '../store'
import { AlertChip } from './TopBar'
import { ALERTS } from '../config/scenario'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')

/** Drag handle for bottom sheets: tap toggles half/full, swipe up goes full, swipe down shrinks then closes. */
export function SheetHandle({ onClose }: { onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const y0 = useRef(0)
  const sheet = () => ref.current?.closest<HTMLElement>('[data-sheet]') ?? null
  return (
    <div ref={ref} className="sheet-handle" role="button" tabIndex={0} aria-label="Resize or close panel"
      onPointerDown={(e) => { y0.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerUp={(e) => {
        const sh = sheet(); if (!sh) return
        const dy = e.clientY - y0.current
        const full = sh.dataset.snap === 'full'
        if (Math.abs(dy) < 8) sh.dataset.snap = full ? 'half' : 'full'
        else if (dy < 0) sh.dataset.snap = 'full'
        else if (full) sh.dataset.snap = 'half'
        else onClose?.()
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') { const sh = sheet(); if (sh) sh.dataset.snap = sh.dataset.snap === 'full' ? 'half' : 'full' } else if (e.key === 'Escape') onClose?.() }}>
      <i />
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet-modal" data-sheet data-snap="half" role="dialog" aria-label={title}>
        <SheetHandle onClose={onClose} />
        <div className="sheet-title"><b>{title}</b><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  )
}

export function PhoneTopBar() {
  const { t, tl, sheet, setSheet } = useStore()
  const sum = useMemo(() => fleetSummary(tl, t), [tl, t])
  const alert = alertAt(tl, t)
  return (
    <>
      <header className="ptop">
        <button className="ptop-main" aria-expanded={sheet === 'conditions'} aria-label="Grid conditions and warnings" onClick={() => setSheet(sheet === 'conditions' ? null : 'conditions')}>
          <AlertChip level={alert.level} />
          <span className="num ptop-clock">{fmtClock(t)}</span>
          <span className="num ptop-kpi">{f0(sum.flexAvail)}<small> MW flex</small></span>
          <CaretDown size={14} aria-hidden />
        </button>
        <span className="simbadge sm" title={SIM_BADGE}>SIMULATED</span>
      </header>
      {sheet === 'conditions' && <ConditionsSheet />}
    </>
  )
}

function ConditionsSheet() {
  const { t, tl, setSheet, setTab, role, setRole, setAbout, scenarioId, setScenario, setPlaying } = useStore()
  const i = clampT(t)
  const sum = useMemo(() => fleetSummary(tl, t), [tl, t])
  const callouts = activeCallouts(tl, t)
  const activeFlex = tl.sites.filter((s) => s.cfg.mode === 'active').reduce((a, s) => a + s.cfg.flexMW, 0)
  const cells: [string, string, string?][] = [
    ['AES Indiana load', `${f0(tl.sys.load[i])} MW`, `forecast ${f0(tl.sys.loadFcst[i])}`],
    ['MISO Indiana Hub', `$${tl.sys.lmp[i].toFixed(2)}`, '/MWh'],
    ['Temperature · wind', `${Math.round(tl.sys.temp[i])}°F`, `${Math.round(tl.sys.wind[i])} mph`],
    ['DLR uplift', `+${tl.sys.dlr[i].toFixed(1)}%`, 'vs static'],
    ['Fleet flexible', `${f0(sum.flexAvail)} MW`, `of ${f0(activeFlex)} MW`],
    ['Battery fleet SOC', `${Math.round(sum.soc * 100)}%`],
    ['Curtailed today', `${sum.curtailMWh.toFixed(1)} MWh`, `${sum.curtailMW.toFixed(1)} MW now`],
    ['Ledger ↔ meter', `${tl.sys.match[i].toFixed(2)}%`],
  ]
  return (
    <Sheet title="Grid conditions" onClose={() => setSheet(null)}>
      <div className="cond-grid">{cells.map(([k, v, s]) => <div key={k}><span className="k">{k}</span><b className="num">{v}</b>{s && <span className="s num">{s}</span>}</div>)}</div>
      <h4>Warnings and predictions</h4>
      {callouts.length === 0 && <p className="dim" style={{ margin: 0 }}>No active forecast callouts.</p>}
      {callouts.map((c) => (
        <button key={c.text} className={`callout wrap ${c.tone}`} onClick={() => { if (c.tab) setTab(c.tab); if (c.t) useStore.getState().seek(parseTime(c.t)); setSheet(null) }}>{c.text}</button>
      ))}
      <h4>Scenario</h4>
      <select className="sel" aria-label="Scenario" value={scenarioId} onChange={(e) => { setScenario(e.target.value); setPlaying(false) }}>{SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <h4>View as</h4>
      <RoleSwitch role={role} setRole={setRole} />
      <button className="ghost wide" onClick={() => { setSheet(null); setAbout(true) }}>About and data sources</button>
      <p className="faint" style={{ fontSize: 12, margin: '10px 0 0' }}>{SIM_BADGE}. Alert ramp: {ALERTS.map((a) => a.short).join(' → ')}.</p>
    </Sheet>
  )
}

export function RoleSwitch({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  return (
    <div className="seg wide" role="group" aria-label="View as">
      {(['operator', 'regulator', 'public'] as Role[]).map((r) => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}</button>)}
    </div>
  )
}

const NAV: { id: string; label: string; Icon: typeof Gauge }[] = [
  { id: 'map', label: 'Map', Icon: MapTrifold }, { id: 'dispatch', label: 'Dispatch', Icon: Gauge },
  { id: 'agreement', label: 'Agreement', Icon: FileText }, { id: 'economics', label: 'Economics', Icon: CurrencyDollar },
]
export function PhoneNav() {
  const { tab, setTab, sheet, setSheet, setAbout, role, setRole } = useStore()
  const inMore = !NAV.some((n) => n.id === tab)
  const rest = TABS.filter((x) => !NAV.some((n) => n.id === x.id))
  return (
    <>
      <nav className="pnav" aria-label="Views">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id as never); setSheet(null) }}><Icon size={22} weight={tab === id ? 'fill' : 'regular'} /><span>{label}</span></button>
        ))}
        <button aria-current={inMore ? 'page' : undefined} aria-expanded={sheet === 'more'} onClick={() => setSheet(sheet === 'more' ? null : 'more')}><DotsThreeOutline size={22} weight={inMore ? 'fill' : 'regular'} /><span>{inMore ? TABS.find((x) => x.id === tab)!.short : 'More'}</span></button>
      </nav>
      {sheet === 'more' && (
        <Sheet title="More views" onClose={() => setSheet(null)}>
          <div className="more-list">{rest.map((x) => <button key={x.id} aria-current={tab === x.id ? 'page' : undefined} onClick={() => { setTab(x.id); setSheet(null) }}><b>{x.label}</b>{!x.ready && <span className="faint">coming soon</span>}</button>)}</div>
          <h4>View as</h4>
          <RoleSwitch role={role} setRole={setRole} />
          <button className="ghost wide" onClick={() => { setSheet(null); setAbout(true) }}>About and data sources</button>
        </Sheet>
      )}
    </>
  )
}

/** Compact sim controls for touch: play/pause, speed, clock and a full-width scrubber. */
export function PhoneTransport() {
  const { t, tl, playing, speed, toggle, setSpeed, seek } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 86399) }
  const bands = useMemo(() => {
    const out: { x0: number; x1: number; level: number }[] = []
    let start = 0
    for (let s = 1; s <= 86400; s++) if (s === 86400 || tl.alert[s] !== tl.alert[start]) { out.push({ x0: start / 86400, x1: s / 86400, level: tl.alert[start] }); start = s }
    return out
  }, [tl])
  const next = () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])
  return (
    <div className="ptrans">
      <button className="pbtn" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}</button>
      <button className="pbtn txt" aria-label={`Speed ${speed} times, tap to change`} onClick={next}>{speed}×</button>
      <div ref={ref} className="pscrub" role="slider" aria-label="Time of day" aria-valuemin={0} aria-valuemax={86399} aria-valuenow={Math.round(t)} aria-valuetext={fmtClock(t)}
        onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); at(e) }} onPointerMove={(e) => drag.current && at(e)} onPointerUp={() => (drag.current = false)}>
        <svg preserveAspectRatio="none" viewBox="0 0 1000 24">
          {bands.map((b, k) => <rect key={k} x={b.x0 * 1000} y={14} width={(b.x1 - b.x0) * 1000} height={6} fill={ALERTS[b.level].color} opacity={b.level ? 0.9 : 0.25} />)}
          {[0, 6, 12, 18, 24].map((h) => <line key={h} x1={(h / 24) * 1000} x2={(h / 24) * 1000} y1={6} y2={13} stroke="#5B6B88" vectorEffect="non-scaling-stroke" />)}
          <line x1={(t / 86400) * 1000} x2={(t / 86400) * 1000} y1={1} y2={23} stroke="#A9B0FE" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  )
}

/** First impression on a phone: what this is, one button to play the story, and the simulated-data note. */
export function IntroCard() {
  const { intro, setIntro, setScenario, setSpeed, setPlaying } = useStore()
  if (!intro) return null
  const play = () => { setScenario('stress-day', parseTime('12:00')); setSpeed(300); setPlaying(true); setIntro(false) }
  return (
    <div className="intro" role="dialog" aria-label="Welcome">
      <div className="intro-card">
        <b className="intro-title">The Membrane</b>
        <p>An AI software layer between a large data center and the utility. It lets the site power on early, inside limits the utility has already studied, and holds the firm limit if anything fails.</p>
        <button className="bigbtn intro-play" onClick={play}><Play size={22} weight="fill" /> Play the stress day</button>
        <button className="ghost wide" onClick={() => setIntro(false)}>Explore the map</button>
        <span className="simbadge" style={{ justifySelf: 'center' }}>{SIM_BADGE}</span>
      </div>
    </div>
  )
}
