// Night Dispatch basemap: a restrained control-room style over self-hosted Protomaps PMTiles (OpenStreetMap data).
// Three archives, drawn back to front: conus (z0-5) -> lite (z6-10, Indiana/Ohio) -> detail (z11-12, central Indiana).
// Fills (earth, water, parks) of the coarser archive stay under the finer one so panning past the detail box never goes
// blank; lines and labels hand over at fixed zooms, applied at runtime by `lineWindow` once an archive has loaded.
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const C = {
  water: '#1b3858',
  land: '#121a2a',
  park: '#15233a',
  river: '#2f6aa3',
  state: '#4a5d86',
  country: '#62759f',
  county: '#2a3955',
  road: '#26365a',
  road2: '#1f2d49',
  place: '#c3cee3',
  placeMinor: '#8c9bb9',
  stateLabel: '#6b7ea3',
  waterLabel: '#6f9bcc',
}

const FONT = ['Noto Sans Regular']
const FONT_MED = ['Noto Sans Medium']
const FONT_IT = ['Noto Sans Italic']
const poly: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon'] as unknown as ExpressionSpecification

export type Src = 'conus' | 'lite' | 'detail'
export const SRC_ZOOM: Record<Src, { minzoom: number; maxzoom: number; bounds?: [number, number, number, number] }> = {
  conus: { minzoom: 0, maxzoom: 5 },
  lite: { minzoom: 6, maxzoom: 10, bounds: [-88.3, 37.6, -80.3, 42.0] },
  detail: { minzoom: 11, maxzoom: 12, bounds: [-87.0, 39.2, -85.5, 40.4] },
}
/** Visible zoom window for the lines + labels of each archive, given which finer archives are ready. */
export function lineWindow(src: Src, liteReady: boolean, detailReady: boolean): [number, number] {
  if (src === 'conus') return [0, liteReady ? 6 : 24]
  if (src === 'lite') return [6, detailReady ? 11 : 24]
  return [11, 24]
}
/** Ids of the line and label layers whose zoom window changes as archives load. */
export const lineLayerIds = (src: Src) => [
  'roads-minor', 'roads-hwy', 'rivers', 'b-county', 'b-state', 'b-country',
  'l-water-poly', 'l-river', 'l-state', 'l-place',
].map((n) => `${src}-${n}`)
/** Lower zoom bound for each line/label layer, relative to its archive window. */
const LAYER_MIN: Record<string, number> = {
  'roads-minor': 8, 'roads-hwy': 5.5, rivers: 5, 'b-county': 6.5, 'l-water-poly': 7.5, 'l-river': 7.5, 'l-place': 4.5,
}
const LAYER_MAX: Record<string, number> = { 'l-state': 8.4 }
export function layerZoomRange(src: Src, name: string, liteReady: boolean, detailReady: boolean): [number, number] {
  const [lo, hi] = lineWindow(src, liteReady, detailReady)
  return [Math.max(lo, LAYER_MIN[name] ?? 0), Math.min(hi, LAYER_MAX[name] ?? 24)]
}

function layersFor(src: Src): LayerSpecification[] {
  const id = (n: string) => `${src}-${n}`
  const z = (n: string) => { const [minzoom, maxzoom] = layerZoomRange(src, n, false, false); return { source: src, minzoom, maxzoom } }
  const fillMin = src === 'conus' ? 0 : SRC_ZOOM[src].minzoom
  const f = { source: src, minzoom: fillMin, maxzoom: 24 }
  return [
    { id: id('earth'), type: 'fill', 'source-layer': 'earth', paint: { 'fill-color': C.land }, ...f },
    { id: id('landuse'), type: 'fill', 'source-layer': 'landuse', paint: { 'fill-color': C.park, 'fill-opacity': 0.55 }, ...f, minzoom: Math.max(fillMin, 8) },
    { id: id('water'), type: 'fill', 'source-layer': 'water', filter: poly, paint: { 'fill-color': C.water }, ...f },
    { id: id('roads-minor'), type: 'line', 'source-layer': 'roads', filter: ['==', ['get', 'kind'], 'major_road'], paint: { 'line-color': C.road2, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 11, 1] }, ...z('roads-minor') },
    { id: id('roads-hwy'), type: 'line', 'source-layer': 'roads', filter: ['==', ['get', 'kind'], 'highway'], paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.9, 11, 1.8] }, ...z('roads-hwy') },
    { id: id('rivers'), type: 'line', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': C.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 1.2, 11, 2.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 8, 1] }, layout: { 'line-cap': 'round', 'line-join': 'round' }, ...z('rivers') },
    { id: id('b-county'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'county'], paint: { 'line-color': C.county, 'line-width': 0.7, 'line-dasharray': [2, 2] }, ...z('b-county') },
    { id: id('b-state'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'region'], paint: { 'line-color': C.state, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 1.6] }, ...z('b-state') },
    { id: id('b-country'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'country'], paint: { 'line-color': C.country, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 9, 1.8] }, ...z('b-country') },
  ]
}

function labelsFor(src: Src): LayerSpecification[] {
  const id = (n: string) => `${src}-${n}`
  const z = (n: string) => { const [minzoom, maxzoom] = layerZoomRange(src, n, false, false); return { source: src, minzoom, maxzoom } }
  const popSize: ExpressionSpecification = ['step', ['get', 'population_rank'], 10, 8, 11, 10, 12, 12, 13.5, 13, 15.5] as unknown as ExpressionSpecification
  const popColor: ExpressionSpecification = ['step', ['get', 'population_rank'], C.placeMinor, 10, C.place] as unknown as ExpressionSpecification
  return [
    { id: id('l-water-poly'), type: 'symbol', 'source-layer': 'water', filter: ['all', poly, ['has', 'name']], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_IT, 'text-size': 11, 'text-letter-spacing': 0.08, 'text-max-width': 8 }, paint: { 'text-color': C.waterLabel, 'text-halo-color': C.water, 'text-halo-width': 1.2 }, ...z('l-water-poly') },
    { id: id('l-river'), type: 'symbol', 'source-layer': 'water', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['has', 'name']], layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_IT, 'text-size': 11, 'text-letter-spacing': 0.12 }, paint: { 'text-color': C.waterLabel, 'text-halo-color': C.land, 'text-halo-width': 1.4 }, ...z('l-river') },
    { id: id('l-state'), type: 'symbol', 'source-layer': 'places', filter: ['==', ['get', 'kind'], 'region'], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_MED, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10.5, 8, 15], 'text-letter-spacing': 0.18, 'text-max-width': 8 }, paint: { 'text-color': C.stateLabel, 'text-halo-color': C.land, 'text-halo-width': 1.5 }, ...z('l-state') },
    { id: id('l-place'), type: 'symbol', 'source-layer': 'places', filter: ['all', ['==', ['get', 'kind'], 'locality'], ['<=', ['get', 'min_zoom'], ['+', ['zoom'], 0.4]]], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT, 'text-size': popSize, 'text-anchor': 'center', 'text-max-width': 7, 'symbol-sort-key': ['-', 0, ['get', 'population_rank']] }, paint: { 'text-color': popColor, 'text-halo-color': C.land, 'text-halo-width': 1.6 }, ...z('l-place') },
  ]
}

export function baseStyle(origin: string, urls: Record<Src, string>): StyleSpecification {
  // Tile templates (not TileJSON urls) so no archive is touched until a tile inside its zoom range is requested.
  const src = (k: Src) => ({
    type: 'vector' as const, tiles: [`pmtiles://${urls[k]}/{z}/{x}/{y}`], ...SRC_ZOOM[k],
    attribution: '© OpenStreetMap contributors · Protomaps',
  })
  return {
    version: 8,
    glyphs: `${origin}fonts/{fontstack}/{range}.pbf`,
    sources: { conus: src('conus'), lite: src('lite'), detail: src('detail') },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': C.water } },
      ...layersFor('conus'), ...layersFor('lite'), ...layersFor('detail'),
      { id: 'overlay-anchor', type: 'background', paint: { 'background-opacity': 0 } },
      ...labelsFor('conus'), ...labelsFor('lite'), ...labelsFor('detail'),
    ],
  }
}
