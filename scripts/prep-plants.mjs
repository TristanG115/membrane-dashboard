// Builds public/data/plants.geojson.
// Coordinates for existing plants come from the EIA-derived Indiana "Power Plants 2023" layer (gisdata.in.gov).
// Capacity / fuel for AES Indiana come from IURC filings and AES releases (see `source`), because the 2023 layer
// predates the Petersburg coal-to-gas conversion and the newest solar / storage projects.
// Usage: node scripts/prep-plants.mjs <path-to-raw-plants.geojson>
import { readFileSync, writeFileSync } from 'node:fs'

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const find = (name) => {
  const f = raw.features.find((x) => x.properties.name === name)
  if (!f) throw new Error('missing ' + name)
  return [Math.round(f.properties.longitude * 1e4) / 1e4, Math.round(f.properties.latitude * 1e4) / 1e4]
}

const IURC = 'AES Indiana IURC SRF presentation 2025 (secure.in.gov/iurc/files/9.-AES-Indiana-SRF-Presentation-2025.pdf)'
const EIA = 'EIA-860 via Indiana GIS Power Plants 2023 (gisdata.in.gov)'
const AES = 'AES Indiana'

const P = [
  // AES Indiana fleet
  { id: 'petersburg', name: 'Petersburg', fuel: 'gas-conversion', cap: 1072, op: AES, c: find('AES PETERSBURG'), status: 'Coal-to-gas conversion in progress (completion targeted Dec 2026)', source: 'AES Indiana Pike County fact sheet Aug 2024; IURC WRF 2024 (1,072 MW)' },
  { id: 'harding', name: 'Harding Street', fuel: 'gas', cap: 929, op: AES, c: find('HARDING STREET'), status: 'Operating', source: IURC },
  { id: 'eagle-valley', name: 'Eagle Valley', fuel: 'gas', cap: 719, op: AES, c: find('EAGLE VALLEY (IN)'), status: 'Operating', source: IURC },
  { id: 'georgetown', name: 'Georgetown', fuel: 'gas', cap: 276, op: AES, c: find('GEORGETOWN'), status: 'Operating', source: EIA },
  { id: 'hardy-hills', name: 'Hardy Hills Solar', fuel: 'solar', cap: 195, op: AES, c: [-86.57, 40.37], approx: true, status: 'Operating since spring 2024 (Clinton County)', source: 'IURC SRF 2025; location approximate' },
  { id: 'pet-energy-center', name: 'Petersburg Energy Center', fuel: 'solar', cap: 250, op: AES, c: [-87.2, 38.575], approx: true, status: 'In service (250 MW solar, 180 MWh storage)', source: 'AES Indiana press release; location approximate' },
  { id: 'pike-bess', name: 'Pike County BESS', fuel: 'storage', cap: 200, mwh: 800, op: AES, c: [-87.31, 38.49], approx: true, status: '200 MW / 800 MWh battery at the Petersburg site', source: 'AES Indiana; location approximate' },
  // Nearby major plants (context only)
  { id: 'cayuga', name: 'Cayuga', fuel: 'coal', cap: 1089, op: 'Duke Energy Indiana', c: find('CAYUGA'), status: 'Operating', source: EIA },
  { id: 'gibson', name: 'Gibson', fuel: 'coal', cap: 3132, op: 'Duke Energy Indiana', c: find('GIBSON'), status: 'Operating', source: EIA },
  { id: 'merom', name: 'Merom', fuel: 'coal', cap: 991, op: 'Hoosier Energy', c: find('MEROM'), status: 'Operating', source: EIA },
  { id: 'edwardsport', name: 'Edwardsport', fuel: 'coal', cap: 595, op: 'Duke Energy Indiana', c: find('EDWARDSPORT'), status: 'Operating (IGCC)', source: EIA },
  { id: 'sugar-creek', name: 'Sugar Creek', fuel: 'gas', cap: 549, op: 'NIPSCO', c: find('SUGAR CREEK POWER'), status: 'Operating', source: EIA },
  { id: 'fowler-ridge', name: 'Fowler Ridge Wind', fuel: 'wind', cap: 600, op: 'Fowler Ridge', c: find('FOWLER RIDGE WIND FARM LLC'), status: 'Operating', source: EIA },
  { id: 'meadow-lake', name: 'Meadow Lake Wind', fuel: 'wind', cap: 200, op: 'Meadow Lake', c: find('MEADOW LAKE WIND FARM LLC'), status: 'Operating (phase I shown)', source: EIA },
  { id: 'wildcat', name: 'Wildcat Wind', fuel: 'wind', cap: 200, op: 'RWE', c: find('WILDCAT WIND FARM I, LLC'), status: 'Operating', source: EIA },
]

const features = P.map((p) => ({
  type: 'Feature',
  properties: { id: p.id, name: p.name, fuel: p.fuel, capMW: p.cap, mwh: p.mwh ?? null, operator: p.op, aes: p.op === AES, approxLocation: !!p.approx, status: p.status, source: p.source },
  geometry: { type: 'Point', coordinates: p.c },
}))
writeFileSync('public/data/plants.geojson', JSON.stringify({ type: 'FeatureCollection', features }))
console.log('plants', features.length)
