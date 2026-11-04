import { BatteryChargingVertical, BatteryFull, BatteryHigh, Brain, Buildings, Cloud, Cpu, Eye, Factory, Fan, Flame, LinkBreak, Pause, Pulse, ShieldCheck, Sun, Wrench, ArrowsClockwise } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import { STATE_META, type LoadType, type SiteConfig, type SiteState } from '../config/scenario'
import type { SiteSnap } from '../lib/snapshot'

export const STATE_ICON: Record<SiteState, ComponentType<{ size?: number; color?: string; weight?: 'fill' | 'bold'; x?: number; y?: number }>> = {
  normal: Pulse,
  prepositioning: BatteryChargingVertical,
  battery: BatteryHigh,
  curtailing: Pause,
  'firm-only': ShieldCheck,
  'link-lost': LinkBreak,
  shadow: Eye,
  offline: Wrench,
}

const TYPE_ICON: Record<LoadType, ComponentType<{ size?: number; color?: string; x?: number; y?: number; weight?: 'fill' | 'bold' | 'regular' }>> = {
  'ai-training': Cpu, 'ai-inference': Brain, colocation: Buildings, cloud: Cloud, industrial: Factory,
}

/** Base-shape outline path per load type, centred on 0,0 within radius r. Shape (not colour) encodes type. */
export function shapePath(type: LoadType, r: number): string {
  const p = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z'
  switch (type) {
    case 'ai-training': return p(Array.from({ length: 6 }, (_, k) => [r * Math.cos((Math.PI / 3) * k - Math.PI / 2), r * Math.sin((Math.PI / 3) * k - Math.PI / 2)] as [number, number])) // hexagon
    case 'ai-inference': return `M${-r * 0.85},${-r * 0.85}H${r * 0.85}V${r * 0.85}H${-r * 0.85}Z` // square
    case 'colocation': return p([[-r, r * 0.9], [-r, -r * 0.25], [0, -r], [r, -r * 0.25], [r, r * 0.9]]) // building / pentagon
    case 'cloud': return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z` // circle
    case 'industrial': return p([[-r, r * 0.9], [-r, -r * 0.1], [-r * 0.35, -r * 0.55], [-r * 0.35, -r * 0.1], [r * 0.3, -r * 0.55], [r * 0.3, -r * 0.1], [r, -r * 0.55], [r, r * 0.9]])
  }
}
export const siteSize = (mw: number) => 28 + 26 * Math.min(1, Math.max(0, (mw - 60) / 240))

interface SiteGlyphProps { cfg: SiteConfig; snap: SiteSnap; selected: boolean }

export function SiteGlyph({ cfg, snap, selected }: SiteGlyphProps) {
  const size = siteSize(cfg.requestedMW)
  const base = size / 2
  const R = base + 7
  const C = 2 * Math.PI * R
  const T = cfg.firmMW + cfg.flexMW
  const meta = STATE_META[snap.state]
  const lost = snap.state === 'link-lost'
  const shadow = snap.state === 'shadow'
  const offline = snap.state === 'offline'
  const firmOnly = snap.state === 'firm-only'
  // composition of the ring, clockwise from the top: firm | flexible on grid | battery | curtailed
  const firmLen = (cfg.firmMW / T) * C
  const gLen = shadow || offline ? 0 : (snap.g / T) * C
  const bLen = shadow || offline ? 0 : (snap.b / T) * C
  const cLen = shadow || offline ? 0 : (snap.curtailed / T) * C
  const seg = (start: number, len: number, color: string, extra?: object) => (
    <circle className="ring-seg" r={R} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${Math.max(0, len)} ${C}`} strokeDashoffset={-start} transform="rotate(-90)" {...extra} />
  )
  const Icon = STATE_ICON[snap.state]
  const TIcon = TYPE_ICON[cfg.loadType]
  const bx = R * Math.SQRT1_2, by = -R * Math.SQRT1_2
  const firmTickAngle = (cfg.firmMW / T) * 2 * Math.PI - Math.PI / 2
  const W = R + 26
  const label = lost ? `${Math.round(snap.gridDraw)} MW · AES SCADA` : `${Math.round(snap.gridDraw)} MW`
  return (
    <svg className={`glyph ${snap.state === 'prepositioning' ? 'pulse' : ''}`} width={W * 2} height={W * 2 + 30} viewBox={`${-W} ${-W} ${W * 2} ${W * 2 + 30}`} role="img" aria-label={`${cfg.name}: ${meta.label}, ${Math.round(snap.gridDraw)} MW`}>
      {selected && <circle r={R + 6} fill="none" stroke="#E6ECF7" strokeWidth={1.2} opacity={0.8} />}
      <circle r={R} fill="rgba(11,18,32,0.55)" stroke="#26324A" strokeWidth={5} />
      {lost ? (
        <>
          {seg(0, firmLen, meta.color, { strokeDasharray: `3 3`, strokeDashoffset: 0 })}
          <circle r={R + 6.5} fill="none" stroke={meta.color} strokeWidth={1.4} strokeDasharray="2 3" opacity={0.9} />
        </>
      ) : (
        <>
          {seg(0, firmLen, shadow || offline ? '#3A4A6B' : 'var(--firm)')}
          {seg(firmLen, gLen, 'var(--flex)')}
          {seg(firmLen + gLen, bLen, 'var(--battery)')}
          {seg(firmLen + gLen + bLen, cLen, 'var(--curtail)')}
        </>
      )}
      {!offline && <line x1={Math.cos(firmTickAngle) * (R - 5)} y1={Math.sin(firmTickAngle) * (R - 5)} x2={Math.cos(firmTickAngle) * (R + 5.5)} y2={Math.sin(firmTickAngle) * (R + 5.5)} stroke="#E6ECF7" strokeWidth={1.6} />}
      {firmOnly && <circle r={R + 6.5} fill="none" stroke="var(--firm)" strokeWidth={1.4} />}
      <path d={shapePath(cfg.loadType, base - 2)} fill={shadow || offline ? 'none' : '#1D2B45'} stroke={shadow ? '#8FA3C8' : offline ? '#5B6B88' : '#8FA3C8'} strokeWidth={shadow || offline ? 1.4 : 1.2} strokeDasharray={shadow ? '3 2.5' : undefined} strokeLinejoin="round" />
      <TIcon size={base * 0.95} color={offline ? '#5B6B88' : '#C3CEE3'} x={-base * 0.475} y={-base * 0.475} weight="bold" />
      <g className="badge" transform={`translate(${bx} ${by})`}>
        <circle className="badge-bg" r={10.5} fill={meta.color} stroke="#0B1220" strokeWidth={2} />
        {offline ? <circle r={8.5} fill="#0B1220" stroke={meta.color} strokeWidth={1.4} /> : null}
        <Icon size={14} color={offline ? meta.color : '#0B1220'} weight="bold" x={-7} y={-7} />
      </g>
      <text className="glyph-label" x={0} y={R + 16} textAnchor="middle">{cfg.name}</text>
      <text className="glyph-label sm" x={0} y={R + 28} textAnchor="middle">{label}</text>
    </svg>
  )
}

const FUEL: Record<string, { Icon: ComponentType<{ size?: number; color?: string; weight?: 'fill' | 'bold' | 'regular'; x?: number; y?: number }>; color: string; label: string }> = {
  gas: { Icon: Flame, color: '#9FB4D9', label: 'Natural gas' },
  coal: { Icon: Factory, color: '#8C93A6', label: 'Coal' },
  'gas-conversion': { Icon: Flame, color: '#8FD0E0', label: 'Coal-to-gas conversion' },
  solar: { Icon: Sun, color: '#E3C55B', label: 'Solar' },
  wind: { Icon: Fan, color: '#8FD0C0', label: 'Wind' },
  storage: { Icon: BatteryFull, color: '#6FD39A', label: 'Battery storage' },
}
export const FUEL_META = FUEL

export function PlantGlyph({ fuel, capMW, pct, aes, selected, name }: { fuel: string; capMW: number; pct: number; aes: boolean; selected: boolean; name: string }) {
  const m = FUEL[fuel] ?? FUEL.gas
  const size = 16 + 18 * Math.min(1, Math.sqrt(capMW / 1800))
  const R = size / 2 + 3
  const C = 2 * Math.PI * R
  const W = R + 8
  return (
    <svg className="glyph" width={W * 2} height={W * 2 + 14} viewBox={`${-W} ${-W} ${W * 2} ${W * 2 + 14}`} opacity={aes ? 1 : 0.78} role="img" aria-label={`${name}: ${m.label}, ${capMW} MW, ${Math.round(pct * 100)}% output`}>
      {selected && <circle r={R + 4} fill="none" stroke="#E6ECF7" strokeWidth={1.2} />}
      <circle r={R} fill="#121A2A" stroke="#26324A" strokeWidth={3.5} />
      <circle className="ring-seg" r={R} fill="none" stroke={m.color} strokeWidth={3.5} strokeLinecap="butt" strokeDasharray={`${Math.max(0, pct) * C} ${C}`} transform="rotate(-90)" />
      <circle r={R - 2.5} fill="#172236" stroke={aes ? '#E6ECF7' : 'none'} strokeWidth={aes ? 0.8 : 0} opacity={aes ? 0.9 : 1} />
      <m.Icon size={size * 0.62} color={m.color} weight="fill" x={-size * 0.31} y={-size * 0.31} />
      {fuel === 'gas-conversion' && (
        <g transform={`translate(${R * 0.8} ${-R * 0.8})`}><circle r={5.5} fill="#8FD0E0" stroke="#0B1220" strokeWidth={1.5} /><ArrowsClockwise size={8} color="#0B1220" weight="bold" x={-4} y={-4} /></g>
      )}
      {aes && <text className="glyph-label sm plant-label" x={0} y={R + 12} textAnchor="middle">{name}</text>}
    </svg>
  )
}
