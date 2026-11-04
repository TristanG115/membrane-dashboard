import { CheckCircle, X } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { FLEET, STATE_META, STATE_ORDER } from '../config/scenario'
import { STATE_ICON } from '../map/glyphs'
import { fleetSummary, siteAt } from '../lib/snapshot'
import { useStore } from '../store'

export function StateBadge({ state, size = 18 }: { state: keyof typeof STATE_META; size?: number }) {
  const I = STATE_ICON[state]
  return <span title={STATE_META[state].label} style={{ width: size, height: size, borderRadius: size / 2, background: STATE_META[state].color, display: 'inline-grid', placeItems: 'center', flex: 'none' }}><I size={size * 0.68} color="#0b1220" weight="bold" /></span>
}

export function FleetPanel() {
  const { tl, t, fleetPanel, setFleetPanel, drawer, openDrawer } = useStore()
  const sum = useMemo(() => fleetSummary(tl, t), [tl, t])
  if (!fleetPanel) return null
  const ev = sum.event
  const nSites = ev ? ev.sites.filter((s) => s.stepped > 0).length : tl.sites.filter((s) => s.cfg.mode === 'active').length
  const headline = ev
    ? `${nSites} sites · ${Math.round(ev.released)} MW of flexible load released to the grid in ${ev.headlineS} s`
    : `${nSites} contracted sites · ${Math.round(sum.flexAvail)} MW of flexible load running`
  return (
    <div className="panel" style={{ right: drawer ? 392 : 12, top: 10, width: 356, transition: 'right 0.25s ease', zIndex: 12 }}>
      <div className="hd"><h3>Fleet</h3><button onClick={() => setFleetPanel(false)} aria-label="Close fleet panel"><X size={14} /></button></div>
      <div className="bd">
        <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25, marginBottom: 8 }} className="num">{headline}</div>
        {ev && (
          <div style={{ marginBottom: 8 }}>
            <div className="bar" aria-label="MW released versus target"><i style={{ width: `${Math.min(100, (ev.released / (ev.target || 1)) * 100)}%`, background: 'var(--firm)', transition: 'width 0.3s' }} /></div>
            <div className="row num dim" style={{ justifyContent: 'space-between', fontSize: 12, marginTop: 3 }}><span>{Math.round(ev.released)} of {Math.round(ev.target)} MW target</span><span>{ev.elapsed} s since Max Gen Event</span></div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {STATE_ORDER.filter((s) => sum.counts[s] > 0).map((s) => (
            <span key={s} className="callout" style={{ gap: 6, padding: '2px 7px' }}><StateBadge state={s} size={16} /><span className="num">{sum.counts[s]}</span> {STATE_META[s].label}</span>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr className="dim" style={{ textAlign: 'left', fontFamily: 'var(--cond)' }}><th style={{ fontWeight: 500, paddingBottom: 3 }}>Site</th><th style={{ fontWeight: 500, textAlign: 'right' }}>{ev ? 'Stepped' : 'Grid MW'}</th><th style={{ fontWeight: 500, textAlign: 'right' }}>{ev ? 'To firm' : 'Battery'}</th><th style={{ fontWeight: 500, textAlign: 'right' }}>{ev ? 'Meter' : ''}</th></tr></thead>
          <tbody>
            {FLEET.map((c, k) => {
              const sn = siteAt(tl, k, t)
              const row = ev?.sites.find((r) => r.id === c.id)
              return (
                <tr key={c.id} onClick={() => openDrawer({ kind: 'site', id: c.id })} style={{ cursor: 'pointer', background: drawer?.id === c.id ? 'var(--panel-2)' : undefined }}>
                  <td style={{ padding: '3px 0' }}><span className="row" style={{ gap: 6 }}><StateBadge state={sn.state} size={16} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{c.name}</span></span></td>
                  {ev && row ? (
                    <>
                      <td className="num" style={{ textAlign: 'right' }}>{row.stepped > 0 ? `${Math.round(row.stepped)} MW` : <span className="faint">{c.mode === 'shadow' ? 'observe' : '—'}</span>}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{row.stepped > 0 ? (row.firm ? `${row.tFirm} s` : <span className="faint">{ev.elapsed} s…</span>) : ''}</td>
                      <td style={{ textAlign: 'right' }}>{row.confirmed ? <span style={{ color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 3 }} title="Confirmed by utility meter"><CheckCircle size={14} weight="fill" /> <span style={{ fontSize: 11.5 }}>meter</span></span> : ''}</td>
                    </>
                  ) : (
                    <>
                      <td className="num" style={{ textAlign: 'right' }}>{Math.round(sn.gridDraw)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{sn.b > 0.5 ? `${Math.round(sn.b)} MW` : sn.chg > 0.5 ? `+${Math.round(sn.chg)}` : <span className="faint">{Math.round(sn.soc * 100)}%</span>}</td>
                      <td />
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Simulated. “Meter” ticks are the utility revenue meter verifying each step.</div>
      </div>
    </div>
  )
}
