import { geoContains } from 'd3'
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import { FLEET, LINES, SUBSTATIONS } from '../config/scenario'

export interface PlantProps { id: string; name: string; fuel: string; capMW: number; mwh: number | null; operator: string; aes: boolean; approxLocation: boolean; status: string; source: string }
export interface GeoData {
  rto: FeatureCollection
  territories: FeatureCollection
  plants: FeatureCollection<Point, PlantProps>
  counties: FeatureCollection<Point, { name: string; state: string }>
  lines: FeatureCollection<LineString>
  feeders: FeatureCollection<LineString>
  subs: FeatureCollection<Point>
  hexes: FeatureCollection<Polygon>
  hexBase: Float32Array
  hexCenters: [number, number][]
  nodes: Map<string, [number, number]>
}

const base = import.meta.env.BASE_URL
const get = async <T,>(f: string): Promise<T> => (await fetch(`${base}data/${f}`)).json()

function chaikin(pts: [number, number][], rounds = 2): [number, number][] {
  let p = pts
  for (let r = 0; r < rounds; r++) {
    const out: [number, number][] = [p[0]]
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]]
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    out.push(p[p.length - 1])
    p = out
  }
  return p
}

// Demand centres (lat, lng, weight, sigma°) used to shape the synthetic demand surface.
const CENTRES: [number, number, number, number][] = [
  [39.77, -86.16, 1.0, 0.2], [39.97, -86.05, 0.55, 0.1], [39.61, -86.11, 0.5, 0.09], [39.70, -86.40, 0.4, 0.09],
  [39.76, -84.19, 0.9, 0.16], [39.92, -83.81, 0.45, 0.09], [39.68, -84.17, 0.5, 0.09], [39.85, -86.40, 0.3, 0.08],
]

export async function loadGeo(): Promise<GeoData> {
  const [rto, territories, plants, counties] = await Promise.all([
    get<FeatureCollection>('rto.geojson'), get<FeatureCollection>('territories.geojson'),
    get<FeatureCollection<Point, PlantProps>>('plants.geojson'), get<FeatureCollection<Point, { name: string; state: string }>>('counties.geojson'),
  ])
  const nodes = new Map<string, [number, number]>()
  SUBSTATIONS.forEach((s) => nodes.set(s.id, s.lngLat))
  plants.features.forEach((f) => nodes.set(f.properties.id, f.geometry.coordinates as [number, number]))

  const lines: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: LINES.map((l) => {
      const a = nodes.get(l.a)!, b = nodes.get(l.b)!
      return { type: 'Feature', id: l.id, properties: { id: l.id, kv: l.kv, staticMW: l.staticMW, pct: 40, bucket: 0, flow: 1 }, geometry: { type: 'LineString', coordinates: chaikin([a, ...(l.via ?? []), b], 2) } }
    }),
  }
  const feeders: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: FLEET.map((s) => {
      const sub = nodes.get(s.sub)!
      const mid: [number, number] = [(sub[0] + s.lngLat[0]) / 2 + 0.012, (sub[1] + s.lngLat[1]) / 2 - 0.008]
      return { type: 'Feature', id: `F-${s.id}`, properties: { id: `F-${s.id}`, kv: 138, staticMW: Math.round((s.firmMW + s.flexMW) * 1.35), pct: 40, bucket: 0, flow: 1, site: s.id, feeder: true }, geometry: { type: 'LineString', coordinates: chaikin([sub, mid, s.lngLat], 2) } }
    }),
  }
  const subs: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: SUBSTATIONS.map((s) => ({ type: 'Feature', id: s.id, properties: { id: s.id, name: s.name, kv: s.kv }, geometry: { type: 'Point', coordinates: s.lngLat } })),
  }

  // ---- demand hexes over both AES territories (synthetic surface, not measured load)
  const KX = 0.77 // lng scale at ~39.7°N so hexes look regular on screen
  const R = 0.022
  const hexes: Feature<Polygon>[] = []
  const hexBase: number[] = []
  const hexCenters: [number, number][] = []
  const dy = R * 1.5, dx = R * Math.sqrt(3)
  let id = 0
  for (const terr of territories.features) {
    const [x0, y0, x1, y1] = bbox(terr)
    let row = 0
    for (let y = y0; y <= y1; y += dy, row++) {
      for (let x = x0 * KX + (row % 2 ? dx / 2 : 0); x <= x1 * KX; x += dx) {
        const lng = x / KX
        if (!geoContains(terr as never, [lng, y])) continue
        const ring: [number, number][] = Array.from({ length: 7 }, (_, k) => {
          const a = (Math.PI / 3) * (k % 6) + Math.PI / 6
          return [(x + R * Math.cos(a)) / KX, y + R * Math.sin(a)] as [number, number]
        })
        let d = 0.08
        for (const [cy, cx, w, sg] of CENTRES) d += w * Math.exp(-(((y - cy) ** 2 + ((lng - cx) * KX) ** 2) / (2 * sg * sg)))
        hexes.push({ type: 'Feature', id: id, properties: { id }, geometry: { type: 'Polygon', coordinates: [ring] } })
        hexBase.push(Math.min(1, d))
        hexCenters.push([lng, y])
        id++
      }
    }
  }
  return { rto, territories, plants, counties, lines, feeders, subs, hexes: { type: 'FeatureCollection', features: hexes }, hexBase: Float32Array.from(hexBase), hexCenters, nodes }
}

function bbox(f: Feature): [number, number, number, number] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90
  const walk = (a: unknown): void => {
    const arr = a as number[] | unknown[]
    if (typeof arr[0] === 'number') { const [x, y] = arr as number[]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) } else (arr as unknown[]).forEach(walk)
  }
  walk((f.geometry as { coordinates: unknown }).coordinates)
  return [x0, y0, x1, y1]
}
