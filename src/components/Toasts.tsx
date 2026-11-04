import { useStore } from '../store'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.severity}`} onClick={() => dismiss(t.id)}>
          <b>{t.title}</b>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
