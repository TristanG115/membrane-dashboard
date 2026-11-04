import { CaretLeft, CaretRight, Pause, Play } from '@phosphor-icons/react'
import { useCallback, useMemo, useRef } from 'react'
import { ALERTS } from '../config/scenario'
import { SPEEDS, useStore } from '../store'
import { SCENARIOS } from '../sim/registry'
import { fmtClock, parseTime } from '../sim/time'

/** Global sim controls + 24-hour scrubber. Lives under every tab. */
export function Transport() {
  const { t, tl, playing, speed, toggle, setSpeed, step, seek, scenarioId, setScenario, present } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const bands = useMemo(() => {
    const out: { x0: number; x1: number; level: number }[] = []
    let start = 0
    for (let s = 1; s <= 86400; s++) {
      if (s === 86400 || tl.alert[s] !== tl.alert[start]) { out.push({ x0: start / 86400, x1: s / 86400, level: tl.alert[start] }); start = s }
    }
    return out
  }, [tl])

  const at = useCallback((e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 86399)
  }, [seek])

  return (
    <div className="transport">
      {!present && (
        <select aria-label="Scenario" value={scenarioId} onChange={(e) => setScenario(e.target.value)} style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line-2)', borderRadius: 6, padding: '5px 6px', fontFamily: 'var(--cond)', fontSize: 13, maxWidth: 200 }}>
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button className="tbtn" aria-label="Step back one minute" title="Step back 1 min" onClick={() => step(-60)}><CaretLeft size={16} /></button>
      <button className="tbtn" aria-label={playing ? 'Pause' : 'Play'} title="Space" onClick={toggle}>{playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}</button>
      <button className="tbtn" aria-label="Step forward one minute" title="Step forward 1 min" onClick={() => step(60)}><CaretRight size={16} /></button>
      <div className="seg" role="group" aria-label="Speed">
        {SPEEDS.map((s) => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
      <span className="clock num">{fmtClock(t)}</span>
      <div ref={ref} className="scrub" role="slider" aria-label="Time of day" aria-valuemin={0} aria-valuemax={86399} aria-valuenow={Math.round(t)} aria-valuetext={fmtClock(t)} tabIndex={0}
        onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); at(e) }}
        onPointerMove={(e) => dragging.current && at(e)} onPointerUp={() => (dragging.current = false)}>
        <svg preserveAspectRatio="none" viewBox="0 0 1000 34">
          {bands.map((b, k) => <rect key={k} x={b.x0 * 1000} y={20} width={(b.x1 - b.x0) * 1000} height={6} fill={ALERTS[b.level].color} opacity={b.level ? 0.9 : 0.25} />)}
          {Array.from({ length: 25 }, (_, h) => <line key={h} x1={(h / 24) * 1000} x2={(h / 24) * 1000} y1={h % 6 === 0 ? 8 : 14} y2={19} stroke="#5B6B88" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
          {tl.def.beats.map((b, k) => <path key={k} d={`M${(parseTime(b.t) / 86400) * 1000 - 4},29 l4,5 l4,-5 z`} fill="#E6ECF7" opacity={0.75} />)}
          <line x1={(t / 86400) * 1000} x2={(t / 86400) * 1000} y1={2} y2={32} stroke="#A9B0FE" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {[0, 6, 12, 18, 24].map((h) => <span key={h} className="faint num" style={{ position: 'absolute', top: -1, left: `${(h / 24) * 100}%`, transform: `translateX(${h === 24 ? '-100%' : h === 0 ? '0' : '-50%'})`, fontSize: 10.5, fontFamily: 'var(--cond)', pointerEvents: 'none' }}>{String(h).padStart(2, '0')}:00</span>)}
      </div>
    </div>
  )
}
