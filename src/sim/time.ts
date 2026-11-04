export function parseTime(s: string): number {
  const [h, m = '0', sec = '0'] = s.split(':')
  return Number(h) * 3600 + Number(m) * 60 + Number(sec)
}
const p2 = (n: number) => String(n).padStart(2, '0')
export function fmtClock(sec: number, withSeconds = true): string {
  const s = ((Math.floor(sec) % 86400) + 86400) % 86400
  const base = `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}`
  return withSeconds ? `${base}:${p2(s % 60)}` : base
}
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
}
