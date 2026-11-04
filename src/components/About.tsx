import { X } from '@phosphor-icons/react'
import { SIM_BADGE } from '../config/scenario'
import { useStore } from '../store'

const REAL: [string, string, string][] = [
  ['Basemap: land, water, rivers, roads, places', 'OpenStreetMap contributors via Protomaps daily build (2026-11-01), extracted to Indiana/Ohio and the continental US', 'https://docs.protomaps.com/basemaps/downloads'],
  ['State boundaries, county shapes', 'US Census Bureau cartographic boundary files, 2023', 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html'],
  ['Power plant locations (Indiana)', 'EIA-860 as republished in the Indiana GIS “Power Plants 2023” layer (gisdata.in.gov)', 'https://gisdata.in.gov/server/rest/services/Hosted/Power_Plants_2023/FeatureServer'],
  ['AES Indiana plant capacities and status', 'AES Indiana IURC filings (SRF 2025, WRF 2024) and Pike County fact sheet (Aug 2024)', 'https://secure.in.gov/iurc/files/9.-AES-Indiana-SRF-Presentation-2025.pdf'],
  ['Stress hours per year (about 85)', 'Duke University, 2025: 0.25% curtailment case', 'https://nicholasinstitute.duke.edu/'],
]
const APPROX = [
  'AES Indiana and AES Ohio territories are approximate unions of counties, not the legal service-territory boundary.',
  'RTO/ISO regions are generalized to whole states. Real boundaries cut across states (for example, Illinois, Kentucky and Indiana are split).',
  'Transmission corridors and substations are schematic and generalized. They are not real line routes and contain no CEII-level detail.',
  'Locations marked approximate (Hardy Hills Solar, Petersburg Energy Center, Pike County BESS) are placed near their counties, not surveyed.',
]
const SIMULATED = [
  'All telemetry, battery state and curtailment',
  'MISO prices (LMP), alerts and load forecasts',
  'Headroom forecasts (P10/P50/P90) and calibration',
  'Substation loading and line loading vs DLR',
  'Weather',
  'The fleet of Membrane sites (every name is fictional) and interconnection requests',
  'Ledger entries and meter matches',
]

export function About() {
  const { about, setAbout } = useStore()
  if (!about) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="About and data sources" onClick={() => setAbout(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,18,0.7)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{ position: 'relative', width: 'min(820px, 94vw)', maxHeight: '86vh', overflowY: 'auto', padding: '16px 20px' }}>
        <button onClick={() => setAbout(false)} aria-label="Close" style={{ position: 'absolute', right: 14, top: 14 }}><X size={18} /></button>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>About &amp; data sources</h2>
        <p className="dim" style={{ marginTop: 0 }}>The Membrane Operator Console is a prototype for the AES Energy Innovation Challenge. <b style={{ color: 'var(--warn)' }}>{SIM_BADGE}.</b> Nothing here is real AES or MISO operational data.</p>
        <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>Real public data used</h3>
        {REAL.map(([a, b, u]) => (
          <div key={a} style={{ marginBottom: 8 }}>
            <b style={{ fontWeight: 600 }}>{a}</b>
            <div className="dim">{b} · <a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--flex)' }}>source</a></div>
          </div>
        ))}
        <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>Approximate</h3>
        <ul className="dim" style={{ margin: 0, paddingLeft: 18 }}>{APPROX.map((a) => <li key={a}>{a}</li>)}</ul>
        <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>Simulated</h3>
        <ul className="dim" style={{ margin: 0, paddingLeft: 18 }}>{SIMULATED.map((a) => <li key={a}>{a}</li>)}</ul>
        <h3 style={{ fontSize: 14, margin: '14px 0 6px' }}>Icons and fonts</h3>
        <div className="dim">Phosphor Icons (MIT). IBM Plex Sans (SIL OFL). Noto Sans map glyphs from Protomaps basemaps-assets (SIL OFL).</div>
      </div>
    </div>
  )
}
