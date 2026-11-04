import { useEffect } from 'react'
import { useStore } from '../store'
import { PHONE_QUERY } from './phoneQuery'

/** Keeps `body.phone` and the store flag in step with the media query. */
export function usePhoneLayout() {
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const apply = () => { document.body.classList.toggle('phone', mq.matches); useStore.getState().setPhone(mq.matches) }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
}

/**
 * Wide tables become stacked cards on phones. CSS needs each cell's column name, so copy the header text onto the cells
 * (and keep doing it as tabs render new tables).
 */
export function useStackedTables(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const label = () => {
      el.querySelectorAll<HTMLTableElement>('table.tbl').forEach((t) => {
        const heads = Array.from(t.querySelectorAll('thead th')).map((h) => h.textContent?.trim() ?? '')
        t.querySelectorAll('tbody tr').forEach((tr) => Array.from(tr.children).forEach((td, i) => { const c = td as HTMLElement; if (heads[i] && c.dataset.label !== heads[i]) c.dataset.label = heads[i]; const empty = /^[–-]$/.test(c.textContent?.trim() ?? ''); if (i > 0 && empty !== (c.dataset.empty === '1')) { if (empty) c.dataset.empty = '1'; else delete c.dataset.empty } }))
      })
    }
    label()
    const mo = new MutationObserver(label)
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [root])
}
