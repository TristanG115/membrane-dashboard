import { UsersThree } from '@phosphor-icons/react'
import { Drawer } from '../components/Drawer'
import { FleetPanel } from '../components/FleetPanel'
import { BeatBanner, EventLab, Legend, LayerPanel, SearchBox } from '../components/MapPanels'
import { MapView } from '../map/MapView'
import { useStore } from '../store'

export function MapTab() {
  const { fleetPanel, setFleetPanel, drawer } = useStore()
  return (
    <>
      <MapView />
      <SearchBox />
      <EventLab />
      <LayerPanel />
      <Legend />
      <BeatBanner />
      {!fleetPanel && (
        <button className="ghost panel" style={{ right: drawer ? 392 : 12, top: 10, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setFleetPanel(true)}>
          <UsersThree size={15} /> Fleet
        </button>
      )}
      <FleetPanel />
      <Drawer />
    </>
  )
}
