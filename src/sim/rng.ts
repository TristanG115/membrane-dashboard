// Seeded randomness only. `Math.random` is banned by ESLint.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit string hash, used to split independent streams per site / signal. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function stream(seed: number, name: string): () => number {
  return mulberry32((seed ^ hashString(name)) >>> 0)
}

/** Deterministic smooth value noise in [-1, 1]; `period` in seconds. */
export function smoothNoise(seed: number, name: string, tSec: number, period: number): number {
  const base = (seed ^ hashString(name)) >>> 0
  const cell = Math.floor(tSec / period)
  const frac = tSec / period - cell
  const v = (i: number) => mulberry32((base + Math.imul(i, 0x9e3779b1)) >>> 0)() * 2 - 1
  const k = (1 - Math.cos(frac * Math.PI)) / 2
  return v(cell) * (1 - k) + v(cell + 1) * k
}
