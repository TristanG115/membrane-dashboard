import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl'
import { PMTiles, Protocol } from 'pmtiles'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CAMERAS, FLEET, STATE_META, SUBSTATIONS, LINES } from '../config/scenario'
import { siteAt } from '../lib/snapshot'
import { LAYER_DEFS, clock, useStore } from '../store'
import { PlantGlyph, SiteGlyph, FUEL_META } from './glyphs'
import { loadGeo, type GeoData, type PlantProps } from './geo'
import { allLineLoading, hexValues, lineLoading, plantPct, subHeadroomRatio } from './live'
import { baseStyle, layerZoomRange, lineLayerIds, type Src } from './style'
import { ArchiveSource, loadArchive, startTileLoads, subscribeTiles, tileStatus, TILE_URLS } from './tiles'
import { TileChip } from './TileChip'

const origin = `${window.location.origin}${import.meta.env.BASE_URL}`
const DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
const RTO_COLOR = ['match', ['get', 'name'], 'MISO', '#3f5ba9', 'PJM', '#7a62b3', 'SPP', '#3e8a8c', 'ERCOT', '#a4673e', 'CAISO', '#3e7d5a', 'NYISO', '#8c5a7a', 'ISO-NE', '#5a7a9e', '#3f5ba9']
const RTO_LABELS: [string, number, number][] = [['MISO', -92.6, 43.4], ['PJM', -79.4, 40.1], ['SPP', -98.4, 38.2], ['ERCOT', -98.9, 31.2], ['CAISO', -120.4, 37.2], ['NYISO', -75.6, 42.9], ['ISO-NE', -71.6, 42.5]]
const lineW = (k: number) => ['interpolate', ['linear'], ['zoom'], 5, ['*', 0.5, ['case', ['==', ['get', 'kv'], 345], 2.6, ['==', ['get', 'feeder'], true], 1.4, 1.8]], 9, ['*', 1.1 * k, ['case', ['==', ['get', 'kv'], 345], 2.6, ['==', ['get', 'feeder'], true], 1.4, 1.8]], 11, ['*', 1.5 * k, ['case', ['==', ['get', 'kv'], 345], 2.6, ['==', ['get', 'feeder'], true], 1.4, 1.8]]] as never
const LOAD_COLOR = ['step', ['get', 'pct'], '#5b7cc0', 60, '#e3c55b', 80, '#e8893a', 95, '#db4a52'] as never

type Tip = { x: number; y: number; kind: 'site' | 'plant' | 'line' | 'sub'; id: string } | null
interface MarkerRec { kind: 'site' | 'plant'; id: string; el: HTMLDivElement; marker: maplibregl.Marker; minZoom: number }

export function MapView() {
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [geo, setGeo] = useState<GeoData | null>(null)
  const [ready, setReady] = useState(false)
  const [recs, setRecs] = useState<MarkerRec[]>([])
  const [tip, setTip] = useState<Tip>(null)
  const layers = useStore((s) => s.layers)
  const role = useStore((s) => s.role)
  const tab = useStore((s) => s.tab)
  const camera = useStore((s) => s.camera)
  const drawer = useStore((s) => s.drawer)
  const openDrawer = useStore((s) => s.openDrawer)
  const loadingRef = useRef(new Map<string, { flow: number; dlrRating: number; pct: number }>())

  // ---- map + geo bootstrap
  useEffect(() => {
    maplibregl.setWorkerUrl(workerUrl)
    const protocol = new Protocol()
    for (const id of ['conus', 'lite', 'detail'] as const) protocol.add(new PMTiles(new ArchiveSource(id)))
    maplibregl.addProtocol('pmtiles', protocol.tile)
    startTileLoads() // conus first, then lite, then detail on desktop; the map never waits on the larger two
    const map = new maplibregl.Map({
      container: box.current!, style: baseStyle(origin, TILE_URLS), center: CAMERAS.conus.center, zoom: CAMERAS.conus.zoom,
      minZoom: 2.6, maxZoom: 12, dragRotate: false, pitchWithRotate: false, attributionControl: { compact: true }, fadeDuration: 150,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map
    map.once('load', () => setReady(true))
    loadGeo().then(setGeo)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(box.current!)
    // Hand lines/labels over to the finer archive as soon as it has loaded, and pull detail in once the user zooms past z10.
    let last = ''
    const handover = () => {
      const st = tileStatus(), lite = st.lite.state === 'ready', detail = st.detail.state === 'ready'
      if (last === `${lite}${detail}`) return // progress ticks arrive many times a second; only readiness matters here
      last = `${lite}${detail}`
      for (const src of ['conus', 'lite', 'detail'] as Src[]) {
        for (const lid of lineLayerIds(src)) {
          if (!map.getLayer(lid)) continue
          const [lo, hi] = layerZoomRange(src, lid.slice(src.length + 1), lite, detail)
          map.setLayerZoomRange(lid, lo, hi)
        }
      }
    }
    const unsub = subscribeTiles(handover)
    map.once('load', () => { last = ''; handover() })
    map.on('zoom', () => { if (map.getZoom() >= 10 && tileStatus().detail.state === 'idle') loadArchive('detail').catch(() => undefined) })
    return () => { unsub(); ro.disconnect(); map.remove(); maplibregl.removeProtocol('pmtiles'); mapRef.current = null }
  }, [])

  useEffect(() => { if (tab === 'map') requestAnimationFrame(() => mapRef.current?.resize()) }, [tab])

  // ---- overlays
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !geo) return
    const A = 'overlay-anchor'
    map.addSource('rto', { type: 'geojson', data: geo.rto })
    map.addSource('terr', { type: 'geojson', data: geo.territories })
    map.addSource('hex', { type: 'geojson', data: geo.hexes, promoteId: 'id' })
    map.addSource('grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [...geo.lines.features, ...geo.feeders.features] } })
    map.addSource('subs', { type: 'geojson', data: geo.subs, promoteId: 'id' })
    map.addSource('labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [
      ...RTO_LABELS.map(([n, x, y]) => ({ type: 'Feature' as const, properties: { n, k: 'rto' }, geometry: { type: 'Point' as const, coordinates: [x, y] } })),
      { type: 'Feature', properties: { n: 'AES Indiana', k: 'aes' }, geometry: { type: 'Point', coordinates: [-86.3, 40.27] } },
      { type: 'Feature', properties: { n: 'AES Ohio', k: 'aes' }, geometry: { type: 'Point', coordinates: [-84.2, 40.12] } },
    ] } })
    const add = (l: object) => map.addLayer(l as never, A)
    add({ id: 'rto-fill', type: 'fill', source: 'rto', paint: { 'fill-color': RTO_COLOR, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.2, 7, 0.07] } })
    add({ id: 'rto-line', type: 'line', source: 'rto', paint: { 'line-color': '#9aa8c2', 'line-opacity': 0.28, 'line-width': 0.8, 'line-dasharray': [3, 2] } })
    add({ id: 'rto-label', type: 'symbol', source: 'labels', filter: ['==', ['get', 'k'], 'rto'], maxzoom: 6.5, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Medium'], 'text-size': 13, 'text-letter-spacing': 0.14 }, paint: { 'text-color': '#aab8d4', 'text-opacity': 0.8, 'text-halo-color': '#121a2a', 'text-halo-width': 1.4 } })
    add({ id: 'hex-fill', type: 'fill', source: 'hex', paint: { 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.0, 7.5, 0.42], 'fill-color': ['interpolate', ['linear'], ['coalesce', ['feature-state', 'v'], 0], 0, '#14233b', 0.3, '#1c4572', 0.55, '#2b7a9b', 0.8, '#58aab4', 1, '#bfe8e3'], 'fill-antialias': false } })
    add({ id: 'terr-fill', type: 'fill', source: 'terr', paint: { 'fill-color': '#4f6fd6', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.3, 8, 0.05] } })
    add({ id: 'terr-glow', type: 'line', source: 'terr', paint: { 'line-color': '#6f8ce6', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 6, 9, 14], 'line-blur': ['interpolate', ['linear'], ['zoom'], 3, 5, 9, 10], 'line-opacity': 0.55 } })
    add({ id: 'terr-line', type: 'line', source: 'terr', paint: { 'line-color': '#d4defc', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 9, 1.8] } })
    add({ id: 'terr-label', type: 'symbol', source: 'labels', filter: ['==', ['get', 'k'], 'aes'], maxzoom: 8.2, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Medium'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 7, 15], 'text-letter-spacing': 0.04, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#e6ecf7', 'text-halo-color': '#0b1220', 'text-halo-width': 2 } })
    add({ id: 'sub-halo', type: 'circle', source: 'subs', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 18, 10, 46], 'circle-blur': 0.75, 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 8, 0.55], 'circle-color': ['interpolate', ['linear'], ['coalesce', ['feature-state', 'r'], 2], 0, '#db4a52', 0.8, '#e8893a', 1.2, '#e3c55b', 1.8, '#3f9aa6'] } })
    add({ id: 'grid-casing', type: 'line', source: 'grid', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['==', ['get', 'lost'], 1], '#5ed3e6', '#0b1220'], 'line-width': lineW(2.2), 'line-opacity': ['case', ['==', ['get', 'lost'], 1], 0.55, 0.8], 'line-blur': ['case', ['==', ['get', 'lost'], 1], 3, 0] } })
    add({ id: 'grid-base', type: 'line', source: 'grid', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LOAD_COLOR, 'line-width': lineW(1), 'line-opacity': 0.92 } })
    add({ id: 'flow-slow', type: 'line', source: 'grid', filter: ['all', ['==', ['get', 'flow'], 1], ['<', ['get', 'pct'], 70]], paint: { 'line-color': '#ffffff', 'line-width': lineW(0.55), 'line-opacity': 0.85, 'line-dasharray': DASH[0] } })
    add({ id: 'flow-fast', type: 'line', source: 'grid', filter: ['all', ['==', ['get', 'flow'], 1], ['>=', ['get', 'pct'], 70]], paint: { 'line-color': '#ffffff', 'line-width': lineW(0.55), 'line-opacity': 0.95, 'line-dasharray': DASH[0] } })
    add({ id: 'grid-hit', type: 'line', source: 'grid', paint: { 'line-width': 14, 'line-opacity': 0 } })
    add({ id: 'sub-dot', type: 'circle', source: 'subs', minzoom: 6.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 11, 6], 'circle-color': '#0b1220', 'circle-stroke-color': '#e6ecf7', 'circle-stroke-width': 1.6 } })
    add({ id: 'sub-label', type: 'symbol', source: 'subs', minzoom: 9.8, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-optional': true }, paint: { 'text-color': '#9aa8c2', 'text-halo-color': '#0b1220', 'text-halo-width': 1.4 } })

    // hover / click on WebGL features
    const hitLayers = ['grid-hit', 'sub-dot']
    const over = (e: MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: hitLayers })[0]
      map.getCanvas().style.cursor = f ? 'pointer' : ''
      if (!f) return setTip((t) => (t && (t.kind === 'line' || t.kind === 'sub') ? null : t))
      setTip({ x: e.point.x, y: e.point.y, kind: f.layer.id === 'sub-dot' ? 'sub' : 'line', id: String(f.properties?.id) })
    }
    map.on('mousemove', over)
    map.on('mouseout', () => setTip(null))
    map.on('click', (e: MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: hitLayers })[0]
      if (f) useStore.getState().openDrawer({ kind: f.layer.id === 'sub-dot' ? 'sub' : 'line', id: String(f.properties?.id) })
    })

    // markers (sites + plants) are DOM so glyphs can animate and stay crisp
    const made: MarkerRec[] = []
    const mk = (kind: 'site' | 'plant', id: string, lngLat: [number, number], minZoom: number) => {
      const el = document.createElement('div')
      el.style.zIndex = kind === 'site' ? '3' : '2'
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map)
      made.push({ kind, id, el, marker, minZoom })
    }
    geo.plants.features.forEach((f) => mk('plant', f.properties.id, f.geometry.coordinates as [number, number], f.properties.aes ? 6.2 : 7))
    FLEET.forEach((s) => mk('site', s.id, s.lngLat, 6.4))
    setRecs(made)
    const fade = () => {
      const z = map.getZoom()
      map.getContainer().dataset.zhi = z >= 9.4 ? '1' : '0'
      for (const r of made) { const o = Math.max(0, Math.min(1, (z - r.minZoom) / 0.7)); r.el.style.setProperty('--o', String(o)); r.el.style.pointerEvents = o < 0.3 ? 'none' : 'auto' }
    }
    map.on('zoom', fade); fade()

    // live updates: data ~4 Hz, hexes ~1.3 Hz, flow dashes at their own cadence
    let n = 0, dFast = 0, dSlow = 0, lastFast = 0, lastSlow = 0, raf = 0
    const update = () => {
      const { tl } = useStore.getState()
      const t = clock.t
      const ll = allLineLoading(tl, t)
      const feats = [...geo.lines.features, ...geo.feeders.features].map((f) => {
        const r = ll.find((x) => x.l.id === f.properties!.id)!
        loadingRef.current.set(r.l.id, { flow: r.flow, dlrRating: r.dlrRating, pct: r.pct })
        const site = f.properties!.site ? tl.sites.find((s) => s.cfg.id === f.properties!.site)! : null
        const lost = site && site.linkUp[Math.floor(t)] === 0 ? 1 : 0
        const offline = site?.cfg.mode === 'offline'
        return { ...f, properties: { ...f.properties, pct: Math.round(r.pct * 10) / 10, flow: offline ? 0 : 1, lost } }
      })
      ;(map.getSource('grid') as GeoJSONSource)?.setData({ type: 'FeatureCollection', features: feats as never })
      for (const s of SUBSTATIONS) map.setFeatureState({ source: 'subs', id: s.id }, { r: subHeadroomRatio(tl, s.id, t).ratio })
      if (n++ % 3 === 0) { const v = hexValues(tl, geo, t); for (let k = 0; k < v.length; k++) map.setFeatureState({ source: 'hex', id: k }, { v: v[k] }) }
    }
    update()
    const iv = window.setInterval(update, 250)
    const anim = (now: number) => {
      if (now - lastFast > 55) { lastFast = now; dFast = (dFast + 1) % DASH.length; if (map.getLayer('flow-fast')) map.setPaintProperty('flow-fast', 'line-dasharray', DASH[dFast]) }
      if (now - lastSlow > 140) { lastSlow = now; dSlow = (dSlow + 1) % DASH.length; if (map.getLayer('flow-slow')) map.setPaintProperty('flow-slow', 'line-dasharray', DASH[dSlow]) }
      raf = requestAnimationFrame(anim)
    }
    raf = requestAnimationFrame(anim)

    // opening shot: continental US → Indiana
    const qp = new URLSearchParams(window.location.search)
    const view = qp.get('view') as keyof typeof CAMERAS | null
    if (view && CAMERAS[view]) map.jumpTo(CAMERAS[view])
    else if (qp.get('intro') === '0') map.jumpTo(CAMERAS.indiana)
    else window.setTimeout(() => map.flyTo({ ...CAMERAS.indiana, duration: 7000, curve: 1.5, essential: true, easing: (x: number) => x * x * (3 - 2 * x) }), 900)
    return () => { clearInterval(iv); cancelAnimationFrame(raf); made.forEach((r) => r.marker.remove()) }
  }, [ready, geo])

  // ---- layer visibility (toggles + role)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !geo || !map.getLayer('rto-fill')) return
    const vis = (id: string) => { const d = LAYER_DEFS.find((l) => l.id === id)!; return layers[id] && !(d.hideFor as readonly string[]).includes(role) ? 'visible' : 'none' }
    const set = (ids: string[], layer: string) => ids.forEach((i) => map.setLayoutProperty(i, 'visibility', vis(layer)))
    set(['rto-fill', 'rto-line', 'rto-label'], 'rto')
    set(['terr-fill', 'terr-glow', 'terr-line', 'terr-label'], 'territory')
    set(['hex-fill'], 'demand')
    set(['grid-casing', 'grid-base', 'flow-slow', 'flow-fast', 'grid-hit'], 'lines')
    set(['sub-dot', 'sub-label'], 'subs')
    set(['sub-halo'], 'halos')
    recs.forEach((r) => { r.el.style.display = (r.kind === 'site' ? vis('sites') : vis('plants')) === 'visible' ? '' : 'none' })
  }, [layers, role, ready, geo, recs])

  // ---- camera cues
  useEffect(() => {
    const map = mapRef.current
    const c = camera.cue
    if (!map || !ready || !camera.seq) return
    const ease = (x: number) => x * x * (3 - 2 * x)
    if (c.flyTo) {
      const v = typeof c.flyTo === 'string' ? CAMERAS[c.flyTo] : { center: c.flyTo.center, zoom: c.flyTo.zoom }
      map.flyTo({ center: v.center, zoom: v.zoom, duration: 3200, curve: 1.4, essential: true, easing: ease })
    }
    if (c.openSite) {
      const s = FLEET.find((x) => x.id === c.openSite)
      if (s) map.flyTo({ center: s.lngLat, zoom: Math.max(map.getZoom(), 10.1), offset: [-190, 0], duration: 2400, essential: true, easing: ease })
    }
    if (c.focusSubs?.length) {
      const b = new maplibregl.LngLatBounds()
      c.focusSubs.forEach((id) => b.extend(SUBSTATIONS.find((s) => s.id === id)!.lngLat))
      map.fitBounds(b, { padding: { top: 120, bottom: 80, left: 80, right: 420 }, maxZoom: 10.4, duration: 2400, essential: true })
    }
  }, [camera, ready])

  // ---- recentre when the user opens something
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !drawer) return
    const at = drawer.kind === 'site' ? FLEET.find((s) => s.id === drawer.id)?.lngLat
      : drawer.kind === 'sub' ? SUBSTATIONS.find((s) => s.id === drawer.id)?.lngLat
        : drawer.kind === 'plant' ? (geo?.nodes.get(drawer.id) as [number, number] | undefined)
          : (() => { const l = LINES.find((x) => x.id === drawer.id); const a = l && geo?.nodes.get(l.a), b = l && geo?.nodes.get(l.b); return a && b ? ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number]) : undefined })()
    if (at) map.easeTo({ center: at, offset: [-190, 0], zoom: Math.max(map.getZoom(), drawer.kind === 'plant' ? 9 : 9.6), duration: 900 })
  }, [drawer, ready, geo])

  const plantById = useMemo(() => new Map(geo?.plants.features.map((f) => [f.properties.id, f.properties]) ?? []), [geo])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {recs.map((r) =>
        createPortal(
          r.kind === 'site'
            ? <SiteMarker key={r.id} id={r.id} onHover={(p) => setTip(p ? { ...p, kind: 'site', id: r.id } : null)} onClick={() => openDrawer({ kind: 'site', id: r.id })} />
            : <PlantMarker key={r.id} p={plantById.get(r.id)!} onHover={(p) => setTip(p ? { ...p, kind: 'plant', id: r.id } : null)} onClick={() => openDrawer({ kind: 'plant', id: r.id })} />,
          r.el, r.id),
      )}
      <TileChip map={mapRef} />
      {tip && <TipView tip={tip} plants={plantById} loading={loadingRef.current} />}
    </div>
  )
}

function SiteMarker({ id, onHover, onClick }: { id: string; onHover: (p: { x: number; y: number } | null) => void; onClick: () => void }) {
  const t = useStore((s) => s.t)
  const tl = useStore((s) => s.tl)
  const sel = useStore((s) => s.drawer?.kind === 'site' && s.drawer.id === id)
  const idx = FLEET.findIndex((s) => s.id === id)
  const snap = siteAt(tl, idx, t)
  return (
    <div style={{ opacity: 'var(--o, 0)' }} onClick={onClick} onMouseMove={(e) => { const r = (e.currentTarget.closest('.maplibregl-map') as HTMLElement).getBoundingClientRect(); onHover({ x: e.clientX - r.left, y: e.clientY - r.top }) }} onMouseLeave={() => onHover(null)}>
      <SiteGlyph cfg={FLEET[idx]} snap={snap} selected={sel} />
    </div>
  )
}

function PlantMarker({ p, onHover, onClick }: { p: PlantProps; onHover: (p: { x: number; y: number } | null) => void; onClick: () => void }) {
  const t = useStore((s) => s.t)
  const tl = useStore((s) => s.tl)
  const sel = useStore((s) => s.drawer?.kind === 'plant' && s.drawer.id === p.id)
  return (
    <div style={{ opacity: 'var(--o, 0)' }} onClick={onClick} onMouseMove={(e) => { const r = (e.currentTarget.closest('.maplibregl-map') as HTMLElement).getBoundingClientRect(); onHover({ x: e.clientX - r.left, y: e.clientY - r.top }) }} onMouseLeave={() => onHover(null)}>
      <PlantGlyph fuel={p.fuel} capMW={p.capMW} pct={plantPct(tl, p.id, p.fuel, t)} aes={p.aes} selected={sel} name={p.name} />
    </div>
  )
}

function TipView({ tip, plants, loading }: { tip: NonNullable<Tip>; plants: Map<string, PlantProps>; loading: Map<string, { flow: number; dlrRating: number; pct: number }> }) {
  const t = useStore((s) => s.t)
  const tl = useStore((s) => s.tl)
  let body: React.ReactNode
  if (tip.kind === 'site') {
    const idx = FLEET.findIndex((s) => s.id === tip.id), c = FLEET[idx], sn = siteAt(tl, idx, t)
    body = <><b>{c.name}</b><div className="dim">{STATE_META[sn.state].label}</div><div className="num">Grid draw {Math.round(sn.gridDraw)} MW · firm {c.firmMW} · flex {c.flexMW}</div><div className="num">Battery {Math.round(sn.soc * 100)}% · {c.battery.mw} MW / {c.battery.mwh} MWh</div></>
  } else if (tip.kind === 'plant') {
    const p = plants.get(tip.id)!
    body = <><b>{p.name}</b><div className="dim">{FUEL_META[p.fuel]?.label} · {p.operator}</div><div className="num">{p.capMW.toLocaleString()} MW nameplate · output {Math.round(plantPct(tl, p.id, p.fuel, t) * 100)}% (simulated)</div></>
  } else if (tip.kind === 'sub') {
    const s = SUBSTATIONS.find((x) => x.id === tip.id)!, h = subHeadroomRatio(tl, s.id, t)
    body = <><b>{s.name}</b><div className="dim">{s.kv} kV node (generalized)</div><div className="num">P10 headroom {h.p10.toFixed(0)} MW vs site need {h.need} MW</div></>
  } else {
    const l = LINES.find((x) => x.id === tip.id)
    const live = loading.get(tip.id)
    const staticMW = l?.staticMW ?? Math.round((FLEET.find((s) => `F-${s.id}` === tip.id)!.requestedMW) * 1.35)
    const kv = l?.kv ?? 138
    const lv = live ?? lineLoading(tl, tip.id, staticMW, t)
    body = <><b>{l ? `${kv} kV corridor (schematic)` : 'Site feeder (138 kV class)'}</b><div className="num">{lv.pct.toFixed(0)}% of DLR rating · {Math.round(lv.flow)} MW</div><div className="dim num">DLR {Math.round(lv.dlrRating)} MW · static {staticMW} MW</div></>
  }
  return <div className="tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{body}</div>
}
