import { CheckCircle, Plugs, PlugsConnected, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { FLEET, LINES, LOAD_TYPES, STATE_META, SUBSTATIONS } from '../config/scenario'
import { activeRung, RUNGS } from '../lib/ladder'
import { siteAt } from '../lib/snapshot'
import { FUEL_META } from '../map/glyphs'
import { lineLoading, plantPct, subHeadroomRatio } from '../map/live'
import type { PlantProps } from '../map/geo'
import { fmtClock, fmtDuration } from '../sim/time'
import { useStore } from '../store'
import { StateBadge } from './FleetPanel'
import { SheetHandle } from './PhoneChrome'

export function Drawer() {
  const { drawer, openDrawer } = useStore()
  const [plants, setPlants] = useState<Map<string, PlantProps>>(new Map())
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/plants.geojson`).then((r) => r.json()).then((j) => setPlants(new Map(j.features.map((f: { properties: PlantProps }) => [f.properties.id, f.properties]))))
  }, [])
  if (!drawer) return null
  return (
    <aside className="drawer" data-sheet data-snap="half" aria-label="Asset detail">
      <SheetHandle onClose={() => openDrawer(null)} />
      <button onClick={() => openDrawer(null)} aria-label="Close detail" style={{ position: 'absolute', right: 10, top: 10, zIndex: 2 }}><X size={16} /></button>
      {drawer.kind === 'site' && <SiteDetail id={drawer.id} />}
      {drawer.kind === 'plant' && plants.get(drawer.id) && <PlantDetail p={plants.get(drawer.id)!} />}
      {drawer.kind === 'sub' && <SubDetail id={drawer.id} />}
      {drawer.kind === 'line' && <LineDetail id={drawer.id} />}
    </aside>
  )
}

const mw = (n: number, d = 1) => `${n.toFixed(d)} MW`

function SiteDetail({ id }: { id: string }) {
  const { tl, t, setTab } = useStore()
  const idx = FLEET.findIndex((s) => s.id === id)
  const c = FLEET[idx]
  const sn = siteAt(tl, idx, t)
  const meta = STATE_META[sn.state]
  const lost = !sn.linkUp
  const downFor = lost ? Math.floor(t) - sn.lastSeenS : 0
  const rung = activeRung(sn)
  // platform's own view is frozen at the last heartbeat while the link is down
  const last = siteAt(tl, idx, sn.lastSeenS)
  const T = c.firmMW + c.flexMW
  return (
    <>
      <section>
        <div className="row" style={{ gap: 10 }}>
          <StateBadge state={sn.state} size={28} />
          <div><div style={{ fontSize: 16, fontWeight: 600 }}>{c.name}</div><div className="dim">{LOAD_TYPES[c.loadType].label} · {c.county}</div></div>
        </div>
        <div style={{ marginTop: 8, color: meta.color, fontWeight: 500 }}>{meta.label}</div>
        <div className="dim" style={{ fontSize: 12.5 }}>{meta.meaning}</div>
        {c.mode === 'shadow' && <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Phase 0 shadow pilot: observe-only. The tool logs what it would do and never dispatches.</div>}
      </section>

      <section>
        <h4>Two independent channels</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {lost ? <Plugs size={20} color="var(--linklost)" weight="bold" /> : <PlugsConnected size={20} color="var(--ok)" weight="bold" />}
            <div>
              <div style={{ fontWeight: 500 }}>Membrane control link: {lost ? <span style={{ color: 'var(--linklost)' }}>LOST {fmtDuration(downFor)}</span> : <span style={{ color: 'var(--ok)' }}>connected</span>}</div>
              <div className="dim" style={{ fontSize: 12.5 }}>{lost ? (sn.failsafe ? 'Controller: local failsafe active' : 'Controller: detecting loss…') : 'Our platform ↔ the on-site controller'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <CheckCircle size={20} color="var(--ok)" weight="fill" />
            <div>
              <div style={{ fontWeight: 500, color: 'var(--ok)' }}>Utility meter: reporting</div>
              <div className="num" style={{ fontSize: 12.5 }}>{mw(sn.gridDraw)}{sn.gridDraw <= c.firmMW + 0.05 ? ' firm' : ''} · via AES SCADA</div>
              <div className="dim" style={{ fontSize: 12.5 }}>AES Indiana revenue meter and telemetry. Independent of our platform.</div>
            </div>
          </div>
        </div>
        {lost && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(94,211,230,0.1)', border: '1px solid rgba(94,211,230,0.5)', fontSize: 12.5 }} className="num">
            Membrane link: LOST {fmtDuration(downFor)} · Controller: local failsafe {sn.failsafe ? 'active' : 'starting'} · Grid service: firm, uninterrupted.
            <div className="faint" style={{ marginTop: 4 }}>The feeder into this site stays energized at the firm level.</div>
          </div>
        )}
      </section>

      <section>
        <h4>Right now{lost ? ' (live MW from the utility channel)' : ''}</h4>
        <div className="big num">{Math.round(sn.gridDraw)} <span className="dim" style={{ fontSize: 14 }}>MW from the grid</span></div>
        <div className="bar" style={{ margin: '8px 0' }}>
          <i style={{ width: `${(c.firmMW / T) * 100}%`, background: 'var(--firm)' }} />
          <i style={{ width: `${(sn.g / T) * 100}%`, background: 'var(--flex)', transition: 'width .4s' }} />
          <i style={{ width: `${(sn.b / T) * 100}%`, background: 'var(--battery)', transition: 'width .4s' }} />
          <i style={{ width: `${(sn.curtailed / T) * 100}%`, background: 'var(--curtail)', transition: 'width .4s' }} />
        </div>
        <div className="kv num"><span><span className="swatch" style={{ background: 'var(--firm)' }} /> Firm</span><span>{mw(c.firmMW, 0)} of {mw(c.firmMW, 0)}</span></div>
        <div className="kv num"><span><span className="swatch" style={{ background: 'var(--flex)' }} /> Flexible on grid</span><span style={{ opacity: lost ? 0.5 : 1 }}>{mw(lost ? last.g : sn.g)}{lost ? ` (last known ${fmtClock(sn.lastSeenS)})` : ''}</span></div>
        <div className="kv num"><span><span className="swatch" style={{ background: 'var(--battery)' }} /> Battery</span><span>{mw(sn.b)}</span></div>
        <div className="kv num"><span><span className="swatch" style={{ background: 'var(--curtail)' }} /> Curtailed</span><span>{mw(sn.curtailed)}</span></div>
        <div className="kv num"><span>Platform view</span><span className={lost ? 'faint' : ''}>{lost ? `last known ${fmtClock(sn.lastSeenS)}` : 'live'}</span></div>
      </section>

      <section>
        <h4>Battery</h4>
        <div className="kv num"><span>State of charge</span><span>{Math.round(sn.soc * 100)}% · {Math.round(sn.soc * c.battery.mwh)} of {c.battery.mwh} MWh</span></div>
        <div className="bar" style={{ margin: '4px 0 6px' }}><i style={{ width: `${sn.soc * 100}%`, background: 'var(--battery)' }} /></div>
        <div className="kv num"><span>Rated</span><span>{c.battery.mw} MW / {c.battery.mwh} MWh</span></div>
        <div className="kv num"><span>Now</span><span>{sn.b > 0.5 ? `discharging ${mw(sn.b, 0)}` : sn.chg > 0.5 ? `charging ${mw(sn.chg, 0)}` : 'idle'}</span></div>
      </section>

      <section>
        <h4>Dispatch ladder</h4>
        {RUNGS.map((r) => (
          <div key={r.n} style={{ display: 'flex', gap: 8, padding: '3px 6px', borderRadius: 5, background: rung === r.n ? 'var(--panel-3)' : undefined, opacity: rung === r.n ? 1 : 0.6, borderLeft: `3px solid ${rung === r.n ? (r.n === 5 ? 'var(--linklost)' : 'var(--flex)') : 'transparent'}` }}>
            <span className="num dim" style={{ width: 12 }}>{r.n}</span><span style={{ fontSize: 12.5 }}>{r.label}</span>
          </div>
        ))}
        {c.hero && <button className="ghost" style={{ marginTop: 10 }} onClick={() => setTab('dispatch')}>Open Site Dispatch</button>}
      </section>
      <section><div className="faint" style={{ fontSize: 11.5 }}>Simulated site. Fictional operator name. Firm {c.firmMW} MW · flexible {c.flexMW} MW · served from {SUBSTATIONS.find((s) => s.id === c.sub)!.name}.</div></section>
    </>
  )
}

function PlantDetail({ p }: { p: PlantProps }) {
  const { tl, t } = useStore()
  const pct = plantPct(tl, p.id, p.fuel, t)
  const m = FUEL_META[p.fuel]
  return (
    <>
      <section>
        <div className="row" style={{ gap: 10 }}><m.Icon size={26} color={m.color} weight="fill" /><div><div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div><div className="dim">{m.label} · {p.operator}</div></div></div>
      </section>
      <section>
        <div className="big num">{Math.round(pct * 100)}%<span className="dim" style={{ fontSize: 14 }}> of capacity (simulated)</span></div>
        <div className="bar" style={{ margin: '8px 0' }}><i style={{ width: `${pct * 100}%`, background: m.color }} /></div>
        <div className="kv num"><span>Nameplate</span><span>{p.capMW.toLocaleString()} MW{p.mwh ? ` / ${p.mwh} MWh` : ''}</span></div>
        <div className="kv"><span>Status</span><span style={{ textAlign: 'right', maxWidth: 220 }}>{p.status}</span></div>
      </section>
      <section>
        <h4>Source</h4>
        <div className="dim" style={{ fontSize: 12.5 }}>{p.source}</div>
        {p.approxLocation && <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Location approximate.</div>}
        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Name, owner and capacity are public. Live output is simulated.</div>
      </section>
    </>
  )
}

function SubDetail({ id }: { id: string }) {
  const { tl, t } = useStore()
  const s = SUBSTATIONS.find((x) => x.id === id)!
  const h = subHeadroomRatio(tl, id, t)
  const served = FLEET.filter((c) => c.sub === id)
  return (
    <>
      <section><div style={{ fontSize: 16, fontWeight: 600 }}>{s.name}</div><div className="dim">{s.kv} kV node · generalized, not a real substation name</div></section>
      <section>
        <h4>P10 headroom</h4>
        <div className="big num">{h.p10.toFixed(0)} <span className="dim" style={{ fontSize: 14 }}>MW vs {h.need} MW site need</span></div>
        <div className="dim" style={{ fontSize: 12.5, marginTop: 4 }}>{h.ratio >= 1.2 ? 'Enough for all flexible load.' : h.ratio >= 0.8 ? 'Tight: battery will fill the gap.' : 'Below flexible need: battery and deferral engaged.'}</div>
        <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>The forecaster is location-specific: each substation has its own P10.</div>
      </section>
      <section><h4>Serves</h4>{served.length ? served.map((c) => <div key={c.id} className="kv"><span>{c.name}</span><span className="num">{c.firmMW}+{c.flexMW} MW</span></div>) : <div className="dim">No contracted site.</div>}</section>
    </>
  )
}

function LineDetail({ id }: { id: string }) {
  const { tl, t } = useStore()
  const l = LINES.find((x) => x.id === id)
  const f = FLEET.find((c) => `F-${c.id}` === id)
  const staticMW = l?.staticMW ?? Math.round(((f?.firmMW ?? 0) + (f?.flexMW ?? 0)) * 1.35)
  const sn = f ? siteAt(tl, FLEET.indexOf(f), t) : null
  const lv = sn ? { flow: sn.gridDraw, dlrRating: staticMW * (1 + tl.sys.dlr[Math.floor(t)] / 100), pct: (sn.gridDraw / (staticMW * (1 + tl.sys.dlr[Math.floor(t)] / 100))) * 100 } : lineLoading(tl, id, staticMW, t)
  return (
    <>
      <section><div style={{ fontSize: 16, fontWeight: 600 }}>{l ? `${l.kv} kV corridor` : `Feeder to ${f?.name}`}</div><div className="dim">Schematic, generalized. Not an actual line route.</div></section>
      <section>
        <div className="big num">{lv.pct.toFixed(0)}% <span className="dim" style={{ fontSize: 14 }}>of dynamic rating</span></div>
        <div className="kv num"><span>Flow (simulated)</span><span>{Math.round(lv.flow)} MW</span></div>
        <div className="kv num"><span>Dynamic (DLR) rating</span><span>{Math.round(lv.dlrRating)} MW</span></div>
        <div className="kv num"><span>Static rating</span><span>{staticMW} MW</span></div>
        <div className="kv num"><span>DLR uplift</span><span>+{tl.sys.dlr[Math.floor(t)].toFixed(1)}%</span></div>
        {sn && <div className="dim" style={{ fontSize: 12.5, marginTop: 8 }}>Flow comes from the utility channel (AES SCADA) and stays energized even if the Membrane link is lost.</div>}
      </section>
    </>
  )
}
