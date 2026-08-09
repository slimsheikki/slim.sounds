/** Shared AudioContext management + small audio helpers (UI-independent). */

let ctx: AudioContext | null = null

export function getCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC({ latencyHint: 'interactive' })
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

export function getNoiseBuffer(c: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(c)
  if (!buf) {
    const len = Math.floor(c.sampleRate * 2)
    buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    noiseBuffers.set(c, buf)
  }
  return buf
}

/* ---------- bitcrusher AudioWorklet ---------- */

const CRUSHER_CODE = `
class SlimCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16 },
      { name: 'reduction', defaultValue: 1, minValue: 1, maxValue: 50 },
      { name: 'mix', defaultValue: 0, minValue: 0, maxValue: 1 },
    ]
  }
  constructor() { super(); this.phase = [0, 0]; this.hold = [0, 0] }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0]
    if (!output || output.length === 0) return true
    const bits = params.bits[0], red = Math.max(1, params.reduction[0]), mix = params.mix[0]
    const steps = Math.pow(2, bits - 1)
    for (let c = 0; c < output.length; c++) {
      const oc = output[c]
      const ic = input && input.length ? (input[c] || input[0]) : null
      if (!ic) { oc.fill(0); continue }
      let phase = this.phase[c] || 0, hold = this.hold[c] || 0
      for (let n = 0; n < oc.length; n++) {
        phase += 1
        if (phase >= red) { phase -= red; hold = Math.round(ic[n] * steps) / steps }
        oc[n] = ic[n] * (1 - mix) + hold * mix
      }
      this.phase[c] = phase; this.hold[c] = hold
    }
    return true
  }
}
registerProcessor('slim-crusher', SlimCrusher)
`

let crusherUrl: string | null = null
const workletReady = new WeakMap<BaseAudioContext, Promise<boolean>>()

/** Load the bitcrusher worklet into any (Offline)AudioContext. Resolves false if unsupported. */
export function ensureCrusher(c: BaseAudioContext): Promise<boolean> {
  let p = workletReady.get(c)
  if (!p) {
    if (!crusherUrl) crusherUrl = URL.createObjectURL(new Blob([CRUSHER_CODE], { type: 'text/javascript' }))
    p = c.audioWorklet
      ? c.audioWorklet.addModule(crusherUrl).then(() => true).catch(() => false)
      : Promise.resolve(false)
    workletReady.set(c, p)
  }
  return p
}

/* ---------- buffer utilities ---------- */

export function makeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0].length, sampleRate })
  channels.forEach((d, i) => buf.copyToChannel(d, i))
  return buf
}

export function copyChannels(buf: AudioBuffer): Float32Array[] {
  return Array.from({ length: buf.numberOfChannels }, (_, i) => {
    const d = new Float32Array(buf.length)
    buf.copyFromChannel(d, i)
    return d
  })
}

export function normalizeBuffer(buf: AudioBuffer, target = 0.97): AudioBuffer {
  const chans = copyChannels(buf)
  let peak = 0
  for (const d of chans) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]))
  if (peak < 0.00001) return buf
  const g = target / peak
  for (const d of chans) for (let i = 0; i < d.length; i++) d[i] *= g
  return makeBuffer(chans, buf.sampleRate)
}

export function cropBuffer(buf: AudioBuffer, startFrac: number, endFrac: number): AudioBuffer {
  const s = Math.floor(Math.min(startFrac, endFrac) * buf.length)
  const e = Math.max(s + 16, Math.ceil(Math.max(startFrac, endFrac) * buf.length))
  const chans = copyChannels(buf).map((d) => d.slice(s, Math.min(e, d.length)))
  return makeBuffer(chans, buf.sampleRate)
}

export function gainBuffer(buf: AudioBuffer, gain: number): AudioBuffer {
  const chans = copyChannels(buf)
  for (const d of chans) for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i] * gain))
  return makeBuffer(chans, buf.sampleRate)
}

const reversedCache = new WeakMap<AudioBuffer, AudioBuffer>()

export function reversedBuffer(buf: AudioBuffer): AudioBuffer {
  let rev = reversedCache.get(buf)
  if (!rev) {
    const chans = copyChannels(buf)
    for (const d of chans) d.reverse()
    rev = makeBuffer(chans, buf.sampleRate)
    reversedCache.set(buf, rev)
  }
  return rev
}

/** Trim trailing near-silence, keeping a little air. */
export function trimTail(buf: AudioBuffer, threshold = 0.0012, keepSecs = 0.06): AudioBuffer {
  const chans = copyChannels(buf)
  let last = 0
  for (const d of chans) {
    for (let i = d.length - 1; i >= 0; i--) {
      if (Math.abs(d[i]) > threshold) { last = Math.max(last, i); break }
    }
  }
  const end = Math.min(buf.length, last + Math.floor(keepSecs * buf.sampleRate))
  if (end <= 0 || end >= buf.length - 8) return buf
  return makeBuffer(chans.map((d) => d.slice(0, end)), buf.sampleRate)
}
