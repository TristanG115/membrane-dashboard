# The Membrane Operator Console

A static demo dashboard for the AES Energy Innovation Challenge final round. Vite, React, TypeScript, MapLibre GL. Every number is simulated and labelled that way in the app; nothing calls a server at runtime.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm test           # simulation, economics and forecaster tests
npm run build      # type-check and build to dist/
npm run deploy     # build, then wrangler deploy (Cloudflare Workers static assets)
```

## Record a shot

Every view is reproducible from the URL. Combine any of these:

| Parameter | Example | Effect |
| --- | --- | --- |
| `scenario` | `stress-day`, `worst-case`, `telemetry-loss`, `maxgen-escalation` | Which scripted day to load |
| `t` | `15:45` | Start the sim clock here |
| `speed` | `1`, `60`, `300`, `900` | Sim speed |
| `autoplay` | `1` | Start playing |
| `tab` or `#/tab` | `#/economics` | Open a tab (`map`, `dispatch`, `agreement`, `economics`, `forecaster`, ...) |
| `role` | `operator`, `regulator`, `public` | View as |
| `site` | `hoosier` | Open a site drawer |
| `view`, `intro=0` | `view=metro` | Skip the national fly-in |
| `present=1` | | Presentation mode |

Keys: space plays and pauses, 1 to 9 switch tabs, left and right scrub, `[` and `]` change speed, `p` toggles presentation mode.

Example: `/?scenario=stress-day&t=15:45&speed=300&autoplay=1#/dispatch`

## Basemap tiles

`scripts/prep-tiles.mjs` cuts three PMTiles archives from a Protomaps daily build (OpenStreetMap data) and prunes them to what the style draws:

| File | Zoom | Area | Size | Loaded |
| --- | --- | --- | --- | --- |
| `conus` | 0 to 5 | US | 0.17 MB | first; the map shows as soon as it arrives |
| `lite` | 6 to 10 | Indiana and Ohio | 3.8 MB | right after, in the background |
| `detail` | 11 to 12 | central Indiana | 1.1 MB | on desktop after `lite`, otherwise when the camera passes zoom 10 |

Workers static assets ignore HTTP Range requests, so each archive is downloaded whole and read from memory (`src/map/tiles.ts`). Vite content-hashes the files and `public/_headers` marks `/assets/*` immutable, so repeat visits download nothing.

Rebuild with the go-pmtiles CLI: `PMTILES_BIN=/path/to/pmtiles node scripts/prep-tiles.mjs --build 20261103`.

## Data

Public sources, dates and caveats are listed in the in-app About panel, on the Service Agreement tab (hyperscaler evidence) and next to each input on the Economics tab. Telemetry, prices, forecasts, the fleet of sites and most interconnection requests are simulated.
