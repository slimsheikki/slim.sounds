export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const dbFromGain = (g: number) => (g <= 0.00001 ? -96 : 20 * Math.log10(g))

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function sanitizeFilename(name: string) {
  const s = name.trim().replace(/[^a-zA-Z0-9 _\-.]/g, '').replace(/\s+/g, '_')
  return s || 'solar_sfx'
}

export const fmtSecs = (s: number) => (s >= 10 ? `${s.toFixed(1)}s` : s >= 1 ? `${s.toFixed(2)}s` : `${Math.round(s * 1000)}ms`)

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`

export const fmtHz = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 1 : 2)}kHz` : `${Math.round(hz)}Hz`)

export const fmtSemi = (st: number) => `${st > 0 ? '+' : ''}${Math.round(st)}st`

export const fmtDb = (db: number) => `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`

/** exponential mapping helpers for knobs (freq-like params) */
export const expToNorm = (v: number, lo: number, hi: number) => Math.log(v / lo) / Math.log(hi / lo)
export const normToExp = (n: number, lo: number, hi: number) => lo * Math.pow(hi / lo, clamp(n, 0, 1))
