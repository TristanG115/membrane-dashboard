// Builds public/data/rto.geojson and public/data/territories.geojson from Census cartographic boundaries.
// Usage: node scripts/prep-geo.mjs <dir-with-state-shp> <dir-with-county-shp>
// Both outputs are APPROXIMATE (state-level RTO shapes, county-union service territories) and labeled so in the UI.
import { open } from 'shapefile'
import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [stDir, coDir] = process.argv.slice(2)
const out = 'public/data'
mkdirSync(out, { recursive: true })

async function readAll(path) {
  const src = await open(path)
  const feats = []
  for (let r = await src.read(); !r.done; r = await src.read()) feats.push(r.value)
  return feats
}

const round = (g) => JSON.parse(JSON.stringify(g, (_k, v) => (typeof v === 'number' ? Math.round(v * 1e3) / 1e3 : v)))

function dissolve(features, groupOf) {
  const groups = new Map()
  for (const f of features) {
    const k = groupOf(f)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(f)
  }
  const result = []
  for (const [name, fs] of groups) {
    const topo = topology(Object.fromEntries(fs.map((f, i) => [`g${i}`, f])))
    const geoms = Object.values(topo.objects)
    const geometry = merge(topo, geoms)
    result.push({ type: 'Feature', properties: { name }, geometry: round(geometry) })
  }
  return result
}

// ---- RTO / ISO regions: state-level generalization (approximate) ----
const RTO = {
  MISO: ['ND', 'MN', 'IA', 'WI', 'MI', 'IN', 'IL', 'MO', 'AR', 'LA', 'MS'],
  PJM: ['OH', 'PA', 'NJ', 'DE', 'MD', 'DC', 'VA', 'WV'],
  SPP: ['KS', 'OK', 'NE'],
  ERCOT: ['TX'],
  CAISO: ['CA'],
  NYISO: ['NY'],
  'ISO-NE': ['CT', 'RI', 'MA', 'VT', 'NH', 'ME'],
}
const stateOf = Object.fromEntries(Object.entries(RTO).flatMap(([r, ss]) => ss.map((s) => [s, r])))
const states = await readAll(join(stDir, 'cb_2023_us_state_20m.shp'))
const rto = dissolve(states, (f) => stateOf[f.properties.STUSPS])
rto.forEach((f) => (f.properties.approximate = true))
writeFileSync(join(out, 'rto.geojson'), JSON.stringify({ type: 'FeatureCollection', features: rto }))

// ---- AES service territories: union of counties (approximate) ----
const TERR = {
  'AES Indiana': { state: '18', rto: 'MISO', counties: ['Marion', 'Hendricks', 'Johnson', 'Morgan', 'Hamilton', 'Boone', 'Hancock', 'Shelby'] },
  'AES Ohio': { state: '39', rto: 'PJM', counties: ['Montgomery', 'Greene', 'Miami', 'Clark', 'Darke', 'Shelby', 'Preble', 'Champaign', 'Warren'] },
}
const counties = await readAll(join(coDir, 'cb_2023_us_county_500k.shp'))
const terr = Object.entries(TERR).map(([name, t]) => {
  const sel = counties.filter((c) => c.properties.STATEFP === t.state && t.counties.includes(c.properties.NAME))
  if (sel.length !== t.counties.length) throw new Error(`county mismatch for ${name}: ${sel.length}/${t.counties.length}`)
  const [f] = dissolve(sel, () => name)
  f.properties = { name, rto: t.rto, approximate: true, counties: t.counties.join(', ') }
  return f
})
writeFileSync(join(out, 'territories.geojson'), JSON.stringify({ type: 'FeatureCollection', features: terr }))

// ---- County centroids for IN/OH (search box + public-view lookup) ----
const bboxCenter = (g) => {
  let [x0, y0, x1, y1] = [180, 90, -180, -90]
  const walk = (a) => (typeof a[0] === 'number' ? ((x0 = Math.min(x0, a[0])), (x1 = Math.max(x1, a[0])), (y0 = Math.min(y0, a[1])), (y1 = Math.max(y1, a[1]))) : a.forEach(walk))
  walk(g.coordinates)
  return [Math.round(((x0 + x1) / 2) * 1e3) / 1e3, Math.round(((y0 + y1) / 2) * 1e3) / 1e3]
}
const cc = counties
  .filter((c) => c.properties.STATEFP === '18' || c.properties.STATEFP === '39')
  .map((c) => ({ type: 'Feature', properties: { name: `${c.properties.NAME} County`, state: c.properties.STATEFP === '18' ? 'IN' : 'OH' }, geometry: { type: 'Point', coordinates: bboxCenter(c.geometry) } }))
writeFileSync(join(out, 'counties.geojson'), JSON.stringify({ type: 'FeatureCollection', features: cc }))
console.log('rto', rto.length, 'territories', terr.length, 'counties', cc.length)
