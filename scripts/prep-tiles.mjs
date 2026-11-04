// Builds the three self-hosted basemap archives in src/assets/tiles/ from the Protomaps daily build
// (OpenStreetMap data), pruned down to exactly what the Night Dispatch style draws.
//
//   conus   z0-5   whole US                  (opening shot; shown as soon as it loads)
//   lite    z6-10  Indiana + Ohio            (loads right after conus; enough for the whole demo)
//   detail  z11-12 central Indiana only      (desktop / when the user zooms past z10)
//
// Usage: PMTILES_BIN=/path/to/pmtiles node scripts/prep-tiles.mjs [--build 20261103] [--stats]
// Needs the go-pmtiles CLI (https://github.com/protomaps/go-pmtiles/releases) and Node >= 22.5.
// Raw extracts go to .cache/ (git-ignored); outputs are imported with ?url so Vite content-hashes them.
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, openSync, readSync, rmSync, statSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { PbfReader } from 'pbf'
import { VectorTile } from '@mapbox/vector-tile'
import { fromVectorTileJs as vtpbf } from 'vt-pbf'
import { bytesToHeader, tileIdToZxy } from 'pmtiles'

const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const BUILD = arg('--build', '20261103')
const BIN = process.env.PMTILES_BIN ?? 'pmtiles'
const STATS = args.includes('--stats')
const RAW = '.cache/tiles-raw'
const OUT = 'src/assets/tiles'
mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true })

const SETS = [
  { name: 'conus', bbox: '-125,24,-66,50', min: 0, max: 5 },
  { name: 'lite', bbox: '-88.3,37.6,-80.3,42.0', min: 6, max: 10 },
  { name: 'detail', bbox: '-87.0,39.2,-85.5,40.4', min: 11, max: 12 },
]

// What the style reads. Everything else (buildings, pois, transit, natural, minor roads, name translations) is dropped.
const KEEP_PROPS = {
  landuse: ['kind'], water: ['kind', 'name', 'name:en'], roads: ['kind'], boundaries: ['kind'],
  places: ['kind', 'name', 'name:en', 'population_rank', 'min_zoom'], earth: [],
}  // landcover is dropped: its tint is within a few percent of the land colour, so it costs 0.6 MB for nothing
const LANDUSE = new Set(['park', 'national_park', 'nature_reserve'])
const BOUNDS = new Set(['country', 'region', 'county'])
function keepFeature(layer, p, z, type, geom) {
  if (geom && type === 3 && !p.name && layer !== 'earth' && bboxSize(geom) < 24) return false // specks and ponds

  switch (layer) {
    case 'landuse': return z >= 8 && LANDUSE.has(p.kind)
    case 'roads': if (z < 12 && String(p.kind_detail).endsWith('_link')) return false // interchange ramps
      return p.kind === 'highway' || (p.kind === 'major_road' && z >= 9)
    case 'boundaries': return BOUNDS.has(p.kind)
    case 'places': return p.kind === 'locality' || p.kind === 'region'
    case 'water': return type !== 2 || p.kind === 'river' || (z >= 9 && p.name) // named creeks only once zoomed in; no ditches
    default: return true
  }
}


// Minimal PMTiles v3 reader: yields {z, x, y, data} for every tile (the CLI can only convert mbtiles -> pmtiles).
function* readArchive(path) {
  const fd = openSync(path, 'r')
  const read = (off, len) => { const b = Buffer.alloc(len); readSync(fd, b, 0, len, off); return b }
  const header = bytesToHeader(read(0, 127).buffer.slice(0, 127))
  const unz = (b) => (header.internalCompression === 2 ? gunzipSync(b) : b)
  function varints(buf) { let pos = 0; return () => { let v = 0, shift = 0, b; do { b = buf[pos++]; v += (b & 0x7f) * 2 ** shift; shift += 7 } while (b & 0x80); return v } }
  function* walk(off, len) {
    const next = varints(unz(read(off, len)))
    const n = next(), entries = []
    let last = 0
    for (let i = 0; i < n; i++) { last += next(); entries.push({ id: last }) }
    for (const e of entries) e.run = next()
    for (const e of entries) e.len = next()
    for (let i = 0; i < n; i++) { const o = next(); entries[i].off = o === 0 && i > 0 ? entries[i - 1].off + entries[i - 1].len : o - 1 }
    for (const e of entries) {
      if (e.run === 0) yield* walk(header.leafDirectoryOffset + e.off, e.len)
      else for (let r = 0; r < e.run; r++) yield { id: e.id + r, off: e.off, len: e.len }
    }
  }
  for (const e of walk(header.rootDirectoryOffset, header.rootDirectoryLength)) {
    const [z, x, y] = tileIdToZxy(e.id)
    yield { z, x, y, data: read(header.tileDataOffset + e.off, e.len), gz: header.tileCompression === 2 }
  }
}

function bboxSize(rings) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
  for (const r of rings) for (const p of r) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
  return Math.max(x1 - x0, y1 - y0)
}
// Douglas-Peucker, iterative. Tolerance in (quantized) tile units.
function simplify(pts, tol) {
  if (pts.length < 3) return pts
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]], t2 = tol * tol
  while (stack.length) {
    const [a, b] = stack.pop()
    const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy
    let max = 0, idx = -1
    for (let i = a + 1; i < b; i++) {
      const P = pts[i]
      let d2
      if (len2 === 0) d2 = (P.x - A.x) ** 2 + (P.y - A.y) ** 2
      else { const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2)); d2 = (P.x - A.x - t * dx) ** 2 + (P.y - A.y - t * dy) ** 2 }
      if (d2 > max) { max = d2; idx = i }
    }
    if (max > t2 && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
  }
  return pts.filter((_, i) => keep[i])
}
// Halve coordinate precision (extent 4096 -> 2048) below z11: invisible at these zooms, ~30% smaller after gzip.
function quantize(rings, type, shift) {
  const out = []
  for (const r of rings) {
    let q = []
    for (const p of r) { const x = p.x >> shift, y = p.y >> shift; const l = q[q.length - 1]; if (!l || l.x !== x || l.y !== y) q.push({ x, y }) }
    if (type !== 1 && q.length > 2) q = simplify(q, 2)
    if (type === 3 && q.length >= 3 && (q[0].x !== q[q.length - 1].x || q[0].y !== q[q.length - 1].y)) q.push({ ...q[0] })
    if (q.length >= (type === 3 ? 4 : type === 2 ? 2 : 1)) out.push(q)
  }
  return out
}
function filterTile(buf, z, stats) {
  const vt = new VectorTile(new PbfReader(buf))
  const layers = {}
  for (const [name, layer] of Object.entries(vt.layers)) {
    const keys = KEEP_PROPS[name]
    const feats = []
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i)
      if (stats) { const s = (stats[name] ??= { n: 0, kept: 0, kinds: {} }); s.n++; s.kinds[f.properties.kind ?? '-'] = (s.kinds[f.properties.kind ?? '-'] ?? 0) + 1 }
      if (!keys) continue
      let geom = f.loadGeometry()
      if (!keepFeature(name, f.properties, z, f.type, geom)) continue
      if (z < 11) { geom = quantize(geom, f.type, z <= 8 ? 2 : 1); if (!geom.length) continue }
      if (stats) stats[name].kept++
      const props = {}
      for (const k of keys) if (f.properties[k] !== undefined) props[k] = f.properties[k]
      feats.push({ id: f.id, type: f.type, properties: props, loadGeometry: () => geom })
    }
    if (feats.length) {
      layers[name] = { version: 2, name, extent: z < 11 ? layer.extent >> (z <= 8 ? 2 : 1) : layer.extent, length: feats.length, feature: (i) => feats[i] }
      if (stats) stats[name].bytes = (stats[name].bytes ?? 0) + gzipSync(Buffer.from(vtpbf({ layers: { [name]: layers[name] } }))).length
    }
  }
  return gzipSync(Buffer.from(vtpbf({ layers })), { level: 9 })
}

for (const set of SETS) {
  const raw = `${RAW}/${set.name}.pmtiles`
  if (!existsSync(raw)) {
    execFileSync(BIN, ['extract', `https://build.protomaps.com/${BUILD}.pmtiles`, raw, `--bbox=${set.bbox}`, `--minzoom=${set.min}`, `--maxzoom=${set.max}`], { stdio: 'inherit' })
  }
  const outDb = `${RAW}/${set.name}.pruned.mbtiles`
  rmSync(outDb, { force: true })
  const dst = new DatabaseSync(outDb)
  dst.exec('CREATE TABLE metadata (name text, value text); CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob); CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);')
  for (const [k, v] of [['name', set.name], ['format', 'pbf'], ['minzoom', set.min], ['maxzoom', set.max], ['bounds', set.bbox], ['type', 'baselayer'], ['attribution', '© OpenStreetMap contributors · Protomaps']]) dst.prepare('INSERT INTO metadata VALUES (?, ?)').run(k, String(v))
  const ins = dst.prepare('INSERT INTO tiles VALUES (?, ?, ?, ?)')
  const stats = STATS ? {} : null
  let inBytes = 0, outBytes = 0, n = 0
  dst.exec('BEGIN')
  for (const t of readArchive(raw)) {
    inBytes += t.data.length
    const out = filterTile(t.gz ? gunzipSync(t.data) : t.data, t.z, stats)
    outBytes += out.length; n++
    ins.run(t.z, t.x, (1 << t.z) - 1 - t.y, out) // MBTiles rows are TMS (y flipped)
  }
  dst.exec('COMMIT'); dst.close()
  const target = `${OUT}/${set.name}.pmtiles`
  rmSync(target, { force: true })
  execFileSync(BIN, ['convert', outDb, target], { stdio: 'inherit' })
  console.log(`${set.name}: ${n} tiles, raw ${(inBytes / 1e6).toFixed(1)} MB -> pruned ${(outBytes / 1e6).toFixed(2)} MB, archive ${(statSync(target).size / 1e6).toFixed(2)} MB`)
  if (stats) console.log(Object.entries(stats).map(([k, v]) => `${k}: ${v.kept}/${v.n} feats, ${(v.bytes / 1e6 || 0).toFixed(2)} MB gz`).join('\n'))
}
