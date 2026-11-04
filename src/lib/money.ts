const MINUS = '−'
/** $ millions with a real minus sign and sensible precision. */
export function fmtM(v: number, digits = 1): string {
  if (Math.abs(v) < 0.005) return '$0'
  const s = Math.abs(v) >= 100 ? Math.round(Math.abs(v)).toLocaleString('en-US') : Math.abs(v).toFixed(digits)
  return `${v < 0 ? MINUS : ''}$${s}M`
}
export const fmtPct = (v: number | null, digits = 1): string => (v === null ? 'n/a' : v > 5 ? '>500%' : `${(v * 100).toFixed(digits)}%`)
export function fmtMonths(m: number | null): string {
  if (m === null) return 'not within horizon'
  if (m === 0) return 'no upfront capital'
  return m < 24 ? `${m} month${m === 1 ? '' : 's'}` : `${(m / 12).toFixed(1)} years`
}
