import { CaretDown, CaretUp, Flask, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { ALERTS, FLEET, LOAD_TYPES, STATE_META, STATE_ORDER, SUBSTATIONS, type LoadType } from '../config/scenario'
import { PLACES } from '../config/places'
import { FUEL_META, STATE_ICON, shapePath } from '../map/glyphs'
import { currentBeat, fleetSummary } from '../lib/snapshot'
import { SCENARIOS } from '../sim/registry'
import { fmtClock, parseTime } from '../sim/time'
import { LAYER_DEFS, useStore } from '../store'

export function LayerPanel() {
  const { layers, toggleLayer, role } = useStore()
  const [open, setOpen] = useState(true)
  return (
    <div className="panel" style={{ left: 12, top: 56, width: 218 }}>
      <div className="hd"><h3>Layers</h3><button onClick={() => setOpen(!open)} aria-label="Toggle layer panel">{open ? <CaretUp size={14} /> : <CaretDown size={14} />}</button></div>
      {open && (
        <div className="bd">
          {LAYER_DEFS.map((l) => {
            const hidden = (l.hideFor as readonly string[]).includes(role)
            return (
              <div key={l.id} className="sw-row" style={{ opacity: hidden ? 0.4 : 1 }}>
                <button className="toggle" role="switch" aria-checked={layers[l.id] && !hidden} disabled={hidden} onClick={() => toggleLayer(l.id)} aria-label={l.label} />
                <span>{l.label}</span>
              </div>
            )
          })}
          {role === 'public' && <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Public view hides grid-sensitive layers.</div>}
        </div>
      )}
    </div>
  )
}

export function SearchBox() {
  const [q, setQ] = useState('')
  const fireCue = useStore((s) => s.fireCue)
  const openDrawer = useStore((s) => s.openDrawer)
  const index = useMemo(() => [
    ...FLEET.map((s) => ({ label: s.name, sub: 'Membrane site', go: () => { openDrawer({ kind: 'site', id: s.id }); fireCue({ openSite: s.id }) } })),
    ...SUBSTATIONS.map((s) => ({ label: s.name, sub: 'Substation', go: () => { openDrawer({ kind: 'sub', id: s.id }); fireCue({ focusSubs: [s.id] }) } })),
    ...PLACES.map((p) => ({ label: p.name, sub: `Town, ${p.state}`, go: () => fireCue({ flyTo: { center: p.lngLat, zoom: 10.2 } }) })),
    ...(['Morgan', 'Marion', 'Hendricks', 'Boone', 'Hamilton', 'Johnson', 'Pike', 'Montgomery'] as const).map((c) => ({ label: `${c} County`, sub: 'County', go: () => fireCue({ flyTo: { center: COUNTY[c], zoom: 9.6 } }) })),
    ...['Petersburg', 'Harding Street', 'Eagle Valley', 'Georgetown', 'Hardy Hills Solar', 'Pike County BESS'].map((n) => ({ label: `${n} plant`, sub: 'Power plant', go: () => fireCue({ flyTo: { center: PLANT[n], zoom: 10.2 } }) })),
  ], [fireCue, openDrawer])
  const hits = q.trim().length < 2 ? [] : index.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
  return (
    <div className="panel" style={{ left: 12, top: 10, width: 218, padding: 0 }}>
      <label className="row" style={{ padding: '6px 9px', gap: 6 }}>
        <MagnifyingGlass size={15} color="#9aa8c2" aria-hidden />
        <input aria-label="Search the map" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Morgan County, Petersburg…" style={{ background: 'none', border: 0, color: 'var(--text)', font: 'inherit', width: '100%', outline: 'none' }}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && hits[0]) { hits[0].go(); setQ('') } }} />
      </label>
      {hits.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {hits.map((h) => (
            <button key={h.label + h.sub} onClick={() => { h.go(); setQ('') }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 10px', textAlign: 'left' }} className="callout">
              <span>{h.label}</span><span className="faint" style={{ fontSize: 11.5 }}>{h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
const COUNTY: Record<string, [number, number]> = { Morgan: [-86.43, 39.48], Marion: [-86.14, 39.78], Hendricks: [-86.51, 39.77], Boone: [-86.47, 40.05], Hamilton: [-86.05, 40.08], Johnson: [-86.09, 39.49], Pike: [-87.23, 38.4], Montgomery: [-84.29, 39.76] }
const PLANT: Record<string, [number, number]> = { Petersburg: [-87.2517, 38.5283], 'Harding Street': [-86.1974, 39.7116], 'Eagle Valley': [-86.4205, 39.4813], Georgetown: [-86.2440, 39.9022], 'Hardy Hills Solar': [-86.57, 40.37], 'Pike County BESS': [-87.31, 38.49] }

export function BeatBanner() {
  const { tl, t, drawer } = useStore()
  const b = currentBeat(tl, t)
  if (!b) return null
  const phases: [string, string][] = [['predict', 'Predict'], ['prepare', 'Prepare'], ['react', 'React'], ['recover', 'Recover']]
  return (
    <div style={{ position: 'absolute', left: 150, right: drawer ? 392 : 12, bottom: 10, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 15, transition: 'right 0.25s ease' }}>
      <div className="banner" role="status" aria-live="polite">
        <div className="phases">{phases.map(([k, l]) => <span key={k} className={`phase ${b.phase === k ? 'on' : ''}`}>{l}</span>)}</div>
        <div><div className="t">{fmtClock(parseTime(b.t), false)} · {b.title}</div><div className="x">{b.text}</div></div>
      </div>
    </div>
  )
}

export function EventLab() {
  const { eventLab, setEventLab, scenarioId, setScenario, setPlaying, present } = useStore()
  if (present) return null
  const go = (id: string) => { setScenario(id); setPlaying(true) }
  return (
    <>
      <button className="ghost panel" style={{ left: 238, top: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setEventLab(!eventLab)} aria-expanded={eventLab}><Flask size={15} /> Event Lab</button>
      {eventLab && (
        <div className="panel" style={{ left: 238, top: 48, width: 330 }}>
          <div className="hd"><h3>Event Lab</h3><button onClick={() => setEventLab(false)} aria-label="Close"><X size={14} /></button></div>
          <div className="bd">
            <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>One-click scenarios. Each plays Predict → Prepare → React → Recover.</div>
            {SCENARIOS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} className="callout" style={{ display: 'block', width: '100%', textAlign: 'left', margin: '0 0 6px', whiteSpace: 'normal', borderColor: s.id === scenarioId ? 'var(--flex)' : undefined }}>
                <b style={{ fontWeight: 600 }}>{s.name}</b><div className="dim" style={{ fontSize: 12 }}>{s.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Shape({ type }: { type: LoadType }) {
  return <svg width={20} height={20} viewBox="-12 -12 24 24"><path d={shapePath(type, 9)} fill="#1d2b45" stroke="#8fa3c8" strokeWidth={1.2} /></svg>
}

export function Legend() {
  const [open, setOpen] = useState(false)
  const { tl, t } = useStore()
  const counts = useMemo(() => fleetSummary(tl, t).counts, [tl, t])
  return (
    <div className="panel" style={{ left: 12, bottom: 10, width: open ? 460 : 'auto', maxHeight: '64%', overflowY: 'auto' }}>
      <div className="hd" style={{ gap: 14 }}><h3>Legend</h3><button onClick={() => setOpen(!open)} aria-label="Toggle legend" aria-expanded={open}>{open ? <CaretDown size={14} /> : <CaretUp size={14} />}</button></div>
      {open && (
        <div className="bd" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
          <div>
            <div className="dim" style={{ fontSize: 11.5, margin: '2px 0 2px' }}>Site status (badge)</div>
            {STATE_ORDER.map((s) => {
              const I = STATE_ICON[s]
              return <div key={s} className="sw-row" title={STATE_META[s].meaning}><span style={{ width: 18, height: 18, borderRadius: 9, background: STATE_META[s].color, display: 'grid', placeItems: 'center', flex: 'none' }}><I size={12} color="#0b1220" weight="bold" /></span><span style={{ flex: 1 }}>{STATE_META[s].label}</span><span className="faint num">{counts[s] || ''}</span></div>
            })}
            <div className="dim" style={{ fontSize: 11.5, margin: '8px 0 2px' }}>Site ring</div>
            {[['var(--firm)', 'Firm MW'], ['var(--flex)', 'Flexible on grid'], ['var(--battery)', 'Battery'], ['var(--curtail)', 'Curtailed']].map(([c, l]) => <div key={l} className="sw-row"><span className="swatch" style={{ background: c }} />{l}</div>)}
          </div>
          <div>
            <div className="dim" style={{ fontSize: 11.5, margin: '2px 0 2px' }}>Site type (shape), size = requested MW</div>
            {(Object.keys(LOAD_TYPES) as LoadType[]).map((k) => <div key={k} className="sw-row"><Shape type={k} />{LOAD_TYPES[k].label}</div>)}
            <div className="dim" style={{ fontSize: 11.5, margin: '8px 0 2px' }}>MISO alert</div>
            {ALERTS.map((a) => <div key={a.id} className="sw-row"><span className="swatch" style={{ background: a.color }} />{a.label}</div>)}
            <div className="dim" style={{ fontSize: 11.5, margin: '8px 0 2px' }}>Line loading (% of DLR)</div>
            {[['#5b7cc0', '< 60%'], ['#e3c55b', '60–80%'], ['#e8893a', '80–95%'], ['#db4a52', '≥ 95%']].map(([c, l]) => <div key={l} className="sw-row"><span className="swatch" style={{ background: c, height: 4, borderRadius: 2, marginTop: 1 }} />{l}</div>)}
            <div className="dim" style={{ fontSize: 11.5, margin: '8px 0 2px' }}>Plants (ring = live output)</div>
            {Object.entries(FUEL_META).map(([k, m]) => <div key={k} className="sw-row"><m.Icon size={15} color={m.color} weight="fill" />{m.label}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
