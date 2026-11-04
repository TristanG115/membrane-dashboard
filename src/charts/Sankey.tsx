import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey'
import { useMemo, useState } from 'react'
import { useWidth } from '../lib/useSize'
import { fmtM } from '../lib/money'

export interface SankeyLink { source: string; target: string; value: number; label: string; color: string }
export interface SankeyNodeDef { id: string; name: string; color: string; short?: string }

/** Flows of money between parties for one scenario. Labels sit on the nodes; each link names its stream on hover or tap. */
export function Sankey({ nodes, links, height = 340 }: { nodes: SankeyNodeDef[]; links: SankeyLink[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const narrow = w < 560
  const padL = narrow ? 74 : 170, padR = narrow ? 88 : 200
  const graph = useMemo(() => {
    const used = new Set(links.flatMap((l) => [l.source, l.target]))
    const ns = nodes.filter((n) => used.has(n.id)).map((n) => ({ ...n }))
    const layout = sankey<SankeyNodeDef, SankeyLink>().nodeId((d) => d.id).nodeAlign(sankeyJustify).nodeWidth(12).nodePadding(16).extent([[padL, 8], [Math.max(padL + 120, w - padR), height - 8]])
    return layout({ nodes: ns, links: links.map((l) => ({ ...l })) })
  }, [nodes, links, w, height, padL, padR])
  const path = sankeyLinkHorizontal()
  const font = narrow ? 11 : 12.5
  return (
    <div ref={ref}>
      <svg width={w} height={height} role="img" aria-label="Sankey diagram of money flowing between the data center, AES, ratepayers and The Membrane">
        {graph.links.map((l, i) => (
          <path key={i} d={path(l) ?? ''} fill="none" stroke={(l as unknown as SankeyLink).color} strokeOpacity={hover === null ? 0.5 : hover === i ? 0.85 : 0.18} strokeWidth={Math.max(1.5, l.width ?? 1)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
            <title>{`${(l as unknown as SankeyLink).label}: ${fmtM(l.value)}`}</title>
          </path>
        ))}
        {graph.nodes.map((n) => {
          const left = (n.x0 ?? 0) < w / 2
          const cy = ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2
          const tx = left ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8
          return (
            <g key={n.id}>
              <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0))} fill={n.color} rx={2} />
              <text x={tx} y={cy - 3} textAnchor={left ? 'end' : 'start'} fontSize={font} fill="#e6ecf7">{narrow ? n.short ?? n.name : n.name}</text>
              <text x={tx} y={cy + 12} textAnchor={left ? 'end' : 'start'} fontSize={font - 1} fill="#9aa8c2" className="num">{fmtM(n.value ?? 0)}</text>
            </g>
          )
        })}
        {hover !== null && graph.links[hover] && (
          <text x={w / 2} y={height - 2} textAnchor="middle" fontSize={12} fill="#e6ecf7" className="num">{(graph.links[hover] as unknown as SankeyLink).label}: {fmtM(graph.links[hover].value)}</text>
        )}
      </svg>
      <div className="legend-inline" style={{ marginTop: 4 }}>
        {Array.from(new Map(links.map((l) => [l.label, l.color])).entries()).map(([label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
      </div>
    </div>
  )
}
