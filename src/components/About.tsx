import { X } from '@phosphor-icons/react'
import { SIM_BADGE } from '../config/scenario'
import { useStore } from '../store'

const REAL: [string, string, string][] = [
  ['Basemap: land, water, rivers, roads, places', 'OpenStreetMap contributors via the Protomaps daily build of 2026-11-03, pruned to what this map draws and split into three self-hosted files: US (z0-5), Indiana/Ohio (z6-10) and central Indiana detail (z11-12)', 'https://docs.protomaps.com/basemaps/downloads'],
  ['State boundaries, county shapes', 'US Census Bureau cartographic boundary files, 2023', 'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html'],
  ['Power plant locations (Indiana)', 'EIA-860 as republished in the Indiana GIS “Power Plants 2023” layer (gisdata.in.gov)', 'https://gisdata.in.gov/server/rest/services/Hosted/Power_Plants_2023/FeatureServer'],
  ['AES Indiana plant capacities and status', 'AES Indiana IURC filings (SRF 2025, WRF 2024) and Pike County fact sheet (Aug 2024)', 'https://secure.in.gov/iurc/files/9.-AES-Indiana-SRF-Presentation-2025.pdf'],
  ['Stress hours per year (about 85)', 'Duke University Nicholas Institute, Rethinking Load Growth (Feb 2025): 0.25% curtailment case, as reported by Facilities Dive', 'https://www.facilitiesdive.com/news/us-grid-headroom-flexible-load-data-center-ai-ev-duke-report/739938/'],
  ['Google data center in Monrovia, Morgan County (IURC Cause No. 46394)', 'IURC approval of AES Indiana plan on 7 Oct 2026, 390 MW, $737.3M, $73.8M of network upgrades in rate base. Read through press accounts; the order itself was not read', 'https://mgrid.org/2026/10/10/indiana-approves-aess-plan-for-googles-390-mw-monrovia-data-center-and-puts-73-8-million-of-upgrades-in-rate-base/'],
  ['Indiana HEA 1007 (2025): 80% cost-coverage test for large loads', 'As applied by the IURC in Cause No. 46394, via press accounts', 'https://mgrid.org/2026/10/10/indiana-approves-aess-plan-for-googles-390-mw-monrovia-data-center-and-puts-73-8-million-of-upgrades-in-rate-base/'],
  ['MISO capacity price ($126.19/MW-day annualized, 2026/27)', 'MISO Planning Resource Auction results posted 28 Apr 2026, via Enel North America summary', 'https://www.enelnorthamerica.com/insights/blogs/miso-2026-2027-capacity-auction-results'],
  ['Data center lease rates ($184/kW-month, CBRE H1 2025)', 'CBRE average asking rate for 250-500 kW deployments, via Data Center Knowledge', 'https://www.datacenterknowledge.com/colocation/power-not-space-the-colocation-battleground-in-2026'],
  ['Hyperscaler flexibility evidence (Google, Emerald AI, SPP CHILLS, PJM, MISO)', 'Listed with dates, caveats and links on the Service Agreement tab', 'https://blog.google/innovation-and-ai/infrastructure-and-cloud/global-network/demand-response-data-center-milestone/'],
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
  'Every economics result: cash flows, NPV, IRR and break-even come from team assumptions marked on the Economics tab, not from AES or data center financials',
  'The forecaster, its calibration backtest and its driver attribution',
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
