// Night Dispatch basemap: a restrained control-room style over self-hosted Protomaps PMTiles
// (OpenStreetMap data). A "conus" file serves low zoom, an "inoh" file serves Indiana/Ohio detail.
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'

export const C = {
  water: '#1b3858',
  land: '#121a2a',
  landcover: '#141f31',
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

function layersFor(src: 'conus' | 'inoh', zr: { minzoom?: number; maxzoom?: number }): LayerSpecification[] {
  const id = (n: string) => `${src}-${n}`
  const base = { source: src, ...zr }
  const L: LayerSpecification[] = [
    { id: id('earth'), type: 'fill', 'source-layer': 'earth', paint: { 'fill-color': C.land }, ...base },
    { id: id('landcover'), type: 'fill', 'source-layer': 'landcover', paint: { 'fill-color': C.landcover, 'fill-opacity': 0.7 }, ...base },
    { id: id('landuse'), type: 'fill', 'source-layer': 'landuse', filter: ['in', ['get', 'kind'], ['literal', ['park', 'national_park', 'nature_reserve', 'forest', 'cemetery']]], paint: { 'fill-color': C.park, 'fill-opacity': 0.55 }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 6) },
    { id: id('water'), type: 'fill', 'source-layer': 'water', filter: poly, paint: { 'fill-color': C.water }, ...base },
    { id: id('roads-minor'), type: 'line', 'source-layer': 'roads', filter: ['==', ['get', 'kind'], 'major_road'], paint: { 'line-color': C.road2, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 11, 1] }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 8) },
    { id: id('roads-hwy'), type: 'line', 'source-layer': 'roads', filter: ['==', ['get', 'kind'], 'highway'], paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.9, 11, 1.8] }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 5.5) },
    { id: id('rivers'), type: 'line', 'source-layer': 'water', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': C.river, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 1.2, 11, 2.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 8, 1] }, layout: { 'line-cap': 'round', 'line-join': 'round' }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 5) },
    { id: id('b-county'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'county'], paint: { 'line-color': C.county, 'line-width': 0.7, 'line-dasharray': [2, 2] }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 6.5) },
    { id: id('b-state'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'region'], paint: { 'line-color': C.state, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 1.6] }, ...base },
    { id: id('b-country'), type: 'line', 'source-layer': 'boundaries', filter: ['==', ['get', 'kind'], 'country'], paint: { 'line-color': C.country, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 9, 1.8] }, ...base },
  ]
  return L
}

function labelsFor(src: 'conus' | 'inoh', zr: { minzoom?: number; maxzoom?: number }): LayerSpecification[] {
  const id = (n: string) => `${src}-${n}`
  const base = { source: src, ...zr }
  const popSize: ExpressionSpecification = ['step', ['get', 'population_rank'], 10, 8, 11, 10, 12, 12, 13.5, 13, 15.5] as unknown as ExpressionSpecification
  const popColor: ExpressionSpecification = ['step', ['get', 'population_rank'], C.placeMinor, 10, C.place] as unknown as ExpressionSpecification
  return [
    { id: id('l-water-poly'), type: 'symbol', 'source-layer': 'water', filter: ['all', poly, ['has', 'name']], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_IT, 'text-size': 11, 'text-letter-spacing': 0.08, 'text-max-width': 8 }, paint: { 'text-color': C.waterLabel, 'text-halo-color': C.water, 'text-halo-width': 1.2 }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 7.5) },
    { id: id('l-river'), type: 'symbol', 'source-layer': 'water', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['has', 'name']], layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_IT, 'text-size': 11, 'text-letter-spacing': 0.12 }, paint: { 'text-color': C.waterLabel, 'text-halo-color': C.land, 'text-halo-width': 1.4 }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 7.5) },
    { id: id('l-state'), type: 'symbol', 'source-layer': 'places', filter: ['==', ['get', 'kind'], 'region'], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT_MED, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10.5, 8, 15], 'text-letter-spacing': 0.18, 'text-max-width': 8 }, paint: { 'text-color': C.stateLabel, 'text-halo-color': C.land, 'text-halo-width': 1.5 }, ...base, maxzoom: Math.min(zr.maxzoom ?? 24, 8.4) },
    { id: id('l-place'), type: 'symbol', 'source-layer': 'places', filter: ['all', ['==', ['get', 'kind'], 'locality'], ['<=', ['get', 'min_zoom'], ['+', ['zoom'], 0.4]]], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT, 'text-size': popSize, 'text-anchor': 'center', 'text-max-width': 7, 'symbol-sort-key': ['-', 0, ['get', 'population_rank']] }, paint: { 'text-color': popColor, 'text-halo-color': C.land, 'text-halo-width': 1.6 }, ...base, minzoom: Math.max(zr.minzoom ?? 0, 4.5) },
  ]
}

export function baseStyle(origin: string): StyleSpecification {
  const conusZ = { maxzoom: 6 }
  const inohZ = { minzoom: 6 }
  return {
    version: 8,
    glyphs: `${origin}fonts/{fontstack}/{range}.pbf`,
    sources: {
      conus: { type: 'vector', url: `pmtiles://${origin}tiles/conus.pmtiles`, attribution: '© OpenStreetMap contributors · Protomaps' },
      inoh: { type: 'vector', url: `pmtiles://${origin}tiles/inoh.pmtiles`, attribution: '© OpenStreetMap contributors · Protomaps' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': C.water } },
      ...layersFor('conus', conusZ),
      ...layersFor('inoh', inohZ),
      { id: 'overlay-anchor', type: 'background', paint: { 'background-opacity': 0 } },
      ...labelsFor('conus', conusZ),
      ...labelsFor('inoh', inohZ),
    ],
  }
}
