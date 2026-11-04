interface Props { actual: ArrayLike<number>; forecast?: ArrayLike<number>; nowIdx: number; w?: number; h?: number; color?: string }
export function Sparkline({ actual, forecast, nowIdx, w = 120, h = 26, color = '#A9B0FE' }: Props) {
  const n = actual.length
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < n; i++) { lo = Math.min(lo, actual[i], forecast?.[i] ?? Infinity); hi = Math.max(hi, actual[i], forecast?.[i] ?? -Infinity) }
  const x = (i: number) => (i / (n - 1)) * w
  const y = (v: number) => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)
  const path = (a: ArrayLike<number>, to: number) => { let d = ''; for (let i = 0; i <= Math.min(to, n - 1); i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(a[i]).toFixed(1)}`; return d }
  return (
    <svg width={w} height={h} aria-hidden>
      {forecast && <path d={path(forecast, n - 1)} fill="none" stroke="#7384A3" strokeWidth={1} strokeDasharray="2 2" />}
      <path d={path(actual, nowIdx)} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={x(nowIdx)} cy={y(actual[Math.min(nowIdx, n - 1)])} r={2.4} fill={color} />
    </svg>
  )
}
