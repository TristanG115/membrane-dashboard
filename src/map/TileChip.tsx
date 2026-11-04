import { useEffect, useState, type RefObject } from 'react'
import type { Map } from 'maplibre-gl'
import { useTileStatus } from './tiles'

/** Subtle loading state shown only when the camera needs a basemap archive that is still downloading. */
export function TileChip({ map }: { map: RefObject<Map | null> }) {
  const st = useTileStatus()
  const [z, setZ] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => { const m = map.current; if (m) setZ(Math.round(m.getZoom() * 4) / 4) }, 300)
    return () => clearInterval(id)
  }, [map])
  const need = z >= 10.4 && st.detail.state !== 'ready' ? ('detail' as const) : z >= 5.6 && st.lite.state !== 'ready' ? ('lite' as const) : null
  if (!need) return null
  const a = st[need]
  const pct = a.total > 0 ? Math.min(99, Math.round((a.loaded / a.total) * 100)) : null
  return (
    <div className="tilechip" role="status">
      <span className="tilechip-bar"><i style={{ width: `${pct ?? 8}%` }} /></span>
      {a.state === 'error' ? 'Basemap detail unavailable, overlays still live' : need === 'lite' ? 'Loading Indiana and Ohio basemap' : 'Loading street-level detail'}
      {pct !== null && a.state === 'loading' && <span className="num">{pct}%</span>}
    </div>
  )
}
