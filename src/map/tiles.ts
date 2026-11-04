// Basemap archive loading. Three self-hosted PMTiles files, each downloaded once with a plain GET
// (Workers static assets ignore Range requests), content-hashed by Vite and served immutable (see public/_headers),
// so a repeat visit reads them from the HTTP cache instead of the network.
//
//   conus   z0-5   ~0.17 MB  loads first; the map is shown as soon as it lands
//   lite    z6-10  ~3.8 MB   starts right after conus, in the background
//   detail  z11-12 ~1.1 MB   desktop-class connections after lite, otherwise only once the user zooms past z10
import type { RangeResponse, Source } from 'pmtiles'
import { useSyncExternalStore } from 'react'
import conusUrl from '../assets/tiles/conus.pmtiles?url'
import liteUrl from '../assets/tiles/lite.pmtiles?url'
import detailUrl from '../assets/tiles/detail.pmtiles?url'

export type ArchiveId = 'conus' | 'lite' | 'detail'
export type ArchiveState = 'idle' | 'loading' | 'ready' | 'error'
export interface ArchiveStatus { state: ArchiveState; loaded: number; total: number }

const abs = (u: string) => new URL(u, window.location.href).href
export const TILE_URLS: Record<ArchiveId, string> = { conus: abs(conusUrl), lite: abs(liteUrl), detail: abs(detailUrl) }

let status: Record<ArchiveId, ArchiveStatus> = {
  conus: { state: 'idle', loaded: 0, total: 0 },
  lite: { state: 'idle', loaded: 0, total: 0 },
  detail: { state: 'idle', loaded: 0, total: 0 },
}
const subs = new Set<() => void>()
const set = (id: ArchiveId, s: Partial<ArchiveStatus>) => { status = { ...status, [id]: { ...status[id], ...s } }; subs.forEach((f) => f()) }
export const tileStatus = () => status
export const subscribeTiles = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useTileStatus = () => useSyncExternalStore(subscribeTiles, tileStatus)

const requests: Partial<Record<ArchiveId, Promise<ArrayBuffer>>> = {}
const listeners: Partial<Record<ArchiveId, (() => void)[]>> = {}
/** Starts (once) and returns the download for an archive, reporting byte progress. */
export function loadArchive(id: ArchiveId): Promise<ArrayBuffer> {
  requests[id] ??= (async () => {
    set(id, { state: 'loading' })
    try {
      const res = await fetch(TILE_URLS[id])
      if (!res.ok || !res.body) throw new Error(`${id}: HTTP ${res.status}`)
      // Content-Length is the compressed size when the CDN compresses on the fly, so treat it as a progress hint only.
      const total = Number(res.headers.get('x-uncompressed-length') ?? res.headers.get('content-length') ?? 0)
      set(id, { total })
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value); loaded += value.length
        set(id, { loaded, total: Math.max(total, loaded) })
      }
      const out = new Uint8Array(loaded)
      let o = 0
      for (const c of chunks) { out.set(c, o); o += c.length }
      set(id, { state: 'ready', loaded, total: loaded })
      listeners[id]?.forEach((f) => f())
      return out.buffer
    } catch (e) {
      set(id, { state: 'error' })
      delete requests[id]
      throw e
    }
  })()
  return requests[id]!
}

/** True on machines where pulling the detail archive up front is reasonable. */
export function canPrefetchDetail(): boolean {
  const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (c?.saveData || (c?.effectiveType && /^(slow-2g|2g|3g)$/.test(c.effectiveType))) return false
  return window.matchMedia('(min-width: 900px) and (pointer: fine)').matches
}

/** Kick off the staged background loads. Conus first, lite as soon as conus lands, detail after lite if allowed. */
export function startTileLoads() {
  loadArchive('conus')
    .then(() => loadArchive('lite'))
    .then(() => { if (canPrefetchDetail()) return loadArchive('detail') })
    .catch(() => { /* surfaced through status */ })
}

/** Reads byte ranges out of an archive once its whole-file download has finished. */
export class ArchiveSource implements Source {
  constructor(private id: ArchiveId) {}
  getKey() { return TILE_URLS[this.id] }
  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const buf = await loadArchive(this.id)
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    return { data: buf.slice(offset, offset + length) }
  }
}
