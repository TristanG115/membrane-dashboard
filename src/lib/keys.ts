import { useEffect } from 'react'
import { SPEEDS, TABS, useStore } from '../store'

/** space = play/pause, 1–9 = tabs, ←/→ = scrub, p = presentation mode, [ ] = speed */
export function useKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return
      const s = useStore.getState()
      if (e.code === 'Space') { e.preventDefault(); s.toggle() }
      else if (/^[1-9]$/.test(e.key)) s.setTab(TABS[Number(e.key) - 1].id)
      else if (e.key === 'ArrowLeft') { e.preventDefault(); s.step(e.shiftKey ? -3600 : -300) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); s.step(e.shiftKey ? 3600 : 300) }
      else if (e.key === 'p' || e.key === 'P') s.setPresent(!s.present)
      else if (e.key === '[') { const i = SPEEDS.indexOf(s.speed as (typeof SPEEDS)[number]); s.setSpeed(SPEEDS[Math.max(0, i - 1)]) }
      else if (e.key === ']') { const i = SPEEDS.indexOf(s.speed as (typeof SPEEDS)[number]); s.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, i + 1)]) }
      else if (e.key === 'Escape') { s.openDrawer(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
