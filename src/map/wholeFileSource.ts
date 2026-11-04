import type { RangeResponse, Source } from 'pmtiles'

/**
 * Cloudflare Workers static assets ignore HTTP Range requests, so PMTiles cannot read the archives
 * piecemeal. The two archives total ~15 MB, so we download each once with a plain GET and serve
 * byte ranges from memory. The browser caches the download like any other static asset.
 */
export class WholeFileSource implements Source {
  private data: Promise<ArrayBuffer> | null = null
  constructor(private url: string) {}
  getKey() { return this.url }
  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    this.data ??= fetch(this.url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${this.url}: ${r.status}`)
      return r.arrayBuffer()
    })
    const buf = await this.data
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    return { data: buf.slice(offset, offset + length) }
  }
}
