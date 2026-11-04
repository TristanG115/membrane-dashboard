import { arc } from 'd3'

/** Semicircle state-of-charge gauge. */
export function SocGauge({ soc, mwh, mw, flow }: { soc: number; mwh: number; mw: number; flow: number }) {
  const r = 78
  const a = arc()
  const bg = a({ innerRadius: r - 14, outerRadius: r, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })!
  const fg = a({ innerRadius: r - 14, outerRadius: r, startAngle: -Math.PI / 2, endAngle: -Math.PI / 2 + Math.PI * Math.min(1, Math.max(0, soc)) })!
  return (
    <svg width="100%" viewBox="-100 -92 200 112" role="img" aria-label={`Battery state of charge ${Math.round(soc * 100)} percent`}>
      <path d={bg} fill="#0b1220" />
      <path d={fg} fill="#6fd39a" style={{ transition: 'd 0.3s' }} />
      <text y={-14} textAnchor="middle" fontSize={34} fontWeight={500} fill="#e6ecf7" className="num">{Math.round(soc * 100)}%</text>
      <text y={4} textAnchor="middle" fontSize={12} fill="#9aa8c2" className="num">{Math.round(soc * mwh)} of {mwh} MWh</text>
      <text y={19} textAnchor="middle" fontSize={12} fill={flow > 0.5 ? '#6fd39a' : flow < -0.5 ? '#d6ffd7' : '#9aa8c2'} className="num">{flow > 0.5 ? `discharging ${Math.round(flow)} of ${mw} MW` : flow < -0.5 ? `charging ${Math.round(-flow)} MW` : `idle · ${mw} MW rated`}</text>
    </svg>
  )
}

/** Signed ramp meter: how fast the utility meter is moving versus the site's ramp cap. */
export function RampMeter({ rate, cap }: { rate: number; cap: number }) {
  const w = 240, mid = w / 2
  const v = Math.max(-1, Math.min(1, rate / cap))
  const over = Math.abs(rate) > cap * 1.02
  return (
    <svg width="100%" viewBox={`0 0 ${w} 56`} role="img" aria-label={`Ramp rate ${rate.toFixed(2)} megawatts per second against a cap of ${cap}`}>
      <rect x={0} y={20} width={w} height={14} rx={7} fill="#0b1220" />
      <rect x={mid + Math.min(0, v) * mid} y={20} width={Math.abs(v) * mid} height={14} rx={0} fill={over ? '#d9365e' : '#a9b0fe'} />
      <line x1={mid} x2={mid} y1={14} y2={40} stroke="#e6ecf7" />
      <line x1={2} x2={2} y1={16} y2={38} stroke="#e5765b" strokeWidth={2} /><line x1={w - 2} x2={w - 2} y1={16} y2={38} stroke="#e5765b" strokeWidth={2} />
      <text x={2} y={52} fontSize={11} fill="#9aa8c2" className="num">−{cap} MW/s cap</text>
      <text x={w - 2} y={52} fontSize={11} textAnchor="end" fill="#9aa8c2" className="num">+{cap} MW/s cap</text>
      <text x={mid} y={12} fontSize={13} textAnchor="middle" fill="#e6ecf7" className="num">{rate >= 0 ? '+' : '−'}{Math.abs(rate).toFixed(2)} MW/s</text>
    </svg>
  )
}
