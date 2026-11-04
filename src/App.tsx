import { lazy, Suspense, useEffect, useRef } from 'react'
import { About } from './components/About'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { Transport } from './components/Transport'
import { useKeys } from './lib/keys'
import { MapTab } from './tabs/MapTab'
import { Placeholder } from './tabs/Placeholder'

// Tabs other than the map load on first visit, which keeps the first download small on cellular.
const DispatchTab = lazy(() => import('./tabs/DispatchTab').then((m) => ({ default: m.DispatchTab })))
const EconomicsTab = lazy(() => import('./tabs/EconomicsTab').then((m) => ({ default: m.EconomicsTab })))
const AgreementTab = lazy(() => import('./tabs/AgreementTab').then((m) => ({ default: m.AgreementTab })))
const ForecasterTab = lazy(() => import('./tabs/ForecasterTab').then((m) => ({ default: m.ForecasterTab })))
import { startClock, TABS, urlParams, useStore } from './store'

export default function App() {
  const { tab, present } = useStore()
  const root = useRef<HTMLDivElement>(null)
  useKeys()
  useEffect(() => startClock(), [])
  useEffect(() => {
    // Deep links: an explicit view/site/intro choice wins over the scenario's opening camera cue.
    const q = urlParams()
    const explicit = q.get('view') || q.get('site') || q.get('intro') !== '0'
    useStore.getState().seek(useStore.getState().t, !explicit)
  }, [])
  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#\/?([a-z]+)/)
      const t = TABS.find((x) => x.id === m?.[1])
      if (t) useStore.getState().setTab(t.id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  // presentation mode hides the cursor after inactivity
  useEffect(() => {
    if (!present) return
    let to = 0
    const wake = () => {
      root.current?.classList.remove('idle')
      clearTimeout(to)
      to = window.setTimeout(() => root.current?.classList.add('idle'), 2500)
    }
    wake()
    window.addEventListener('mousemove', wake)
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(to); root.current?.classList.remove('idle') }
  }, [present])
  const ready = TABS.find((x) => x.id === tab)!.ready
  return (
    <div ref={root} className={`app ${present ? 'present' : ''}`}>
      <TopBar />
      <main className="main">
        <div style={{ position: 'absolute', inset: 0, display: tab === 'map' ? 'block' : 'none' }}><MapTab /></div>
        <Suspense fallback={<div className="page dim" style={{ display: 'grid', placeItems: 'center' }}>Loading view</div>}>
          {tab === 'dispatch' && <DispatchTab />}
          {tab === 'economics' && <EconomicsTab />}
          {tab === 'agreement' && <AgreementTab />}
          {tab === 'forecaster' && <ForecasterTab />}
        </Suspense>
        {tab !== 'map' && !ready && <Placeholder tab={tab} />}
        <Toasts corner={tab === 'map' ? 'left' : 'right'} />
      </main>
      <Transport />
      <About />
    </div>
  )
}
