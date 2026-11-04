import { TABS } from '../store'
import type { TabId } from '../sim/types'

export function Placeholder({ tab }: { tab: TabId }) {
  const t = TABS.find((x) => x.id === tab)!
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{t.label}</div>
        <p className="dim">This view shares the same simulation and top bar. It is queued for a later milestone.</p>
      </div>
    </div>
  )
}
