/** Offline render of an ambient scene to a seamless looping AudioBuffer (for WAV export). */
import type { ExportSettings } from '../state/types'
import type { Scene } from '../state/ambientTypes'
import { LAYER_DEFS } from '../state/ambientTypes'
import { ensureCrusher, normalizeBuffer } from './context'
import {
  buildContinuous,
  buildLofiChain,
  eventMidi,
  eventRate,
  makeReverbIR,
  spawnEvent,
  toneCutoff,
} from './ambientVoices'
import { clamp } from '../utils/misc'

const isAlwaysOn = (start: number, len: number, duration: number) => start <= 0.05 && start + len >= duration - 0.05

/** Fold the render so it loops seamlessly at `dur` seconds by equal-power crossfading the wrap. */
function makeSeamless(buf: AudioBuffer, dur: number, xfade: number): AudioBuffer {
  const rate = buf.sampleRate
  const durS = Math.floor(dur * rate)
  const xf = Math.min(Math.floor(xfade * rate), buf.length - durS - 1)
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: durS, sampleRate: rate })
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch)
    const o = out.getChannelData(ch)
    for (let i = 0; i < durS; i++) o[i] = src[i]
    if (xf > 8) {
      for (let i = 0; i < xf; i++) {
        const w = (i / xf) * (Math.PI / 2)
        o[i] = src[i] * Math.sin(w) + src[durS + i] * Math.cos(w)
      }
    }
  }
  return out
}

export function estimateSceneSeconds(scene: Scene) {
  return scene.duration
}

export async function renderScene(scene: Scene, opts: ExportSettings): Promise<AudioBuffer | null> {
  if (!scene.tracks.length) return null
  const dur = scene.duration
  const xfade = Math.min(1.5, dur * 0.2)
  const total = dur + xfade + 0.35
  const octx = new OfflineAudioContext(opts.channels, Math.ceil(total * opts.rate), opts.rate)

  await ensureCrusher(octx)
  let crusher: AudioWorkletNode | null = null
  try { crusher = new AudioWorkletNode(octx, 'slim-crusher', { outputChannelCount: [2] }) } catch { crusher = null }

  const reverb = octx.createConvolver(); reverb.buffer = makeReverbIR(octx)
  const reverbReturn = octx.createGain(); reverbReturn.gain.value = 0.9
  const dryBus = octx.createGain()
  const lofi = buildLofiChain(octx, crusher)
  lofi.setLofi(scene.lofi, true)
  reverb.connect(reverbReturn).connect(lofi.input)
  dryBus.connect(lofi.input)
  lofi.out.connect(octx.destination)

  interface N { type: Scene['tracks'][number]['type']; base: number; continuous: boolean; tone: BiquadFilterNode; gain: GainNode; send: GainNode; alwaysOn: boolean; level: number }
  const nodes: (N & { track: Scene['tracks'][number] })[] = []

  for (const t of scene.tracks) {
    if (t.muted) continue
    const def = LAYER_DEFS[t.type]
    const tone = octx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6
    tone.frequency.value = toneCutoff(t.tone)
    const gain = octx.createGain()
    const send = octx.createGain(); send.gain.value = t.space
    tone.connect(gain); gain.connect(dryBus); gain.connect(send); send.connect(reverb)
    const alwaysOn = isAlwaysOn(t.clip.start, t.clip.len, dur)
    if (def.continuous) buildContinuous(octx, t.type, tone, def.base, t.motion, def.base + t.pitch)
    gain.gain.value = def.continuous ? (alwaysOn ? t.level : 0) : t.level
    nodes.push({ track: t, type: t.type, base: def.base, continuous: def.continuous, tone, gain, send, alwaysOn, level: t.level })
  }

  const cycles = Math.ceil(total / dur) + 1
  for (let c = 0; c < cycles; c++) {
    const T = c * dur
    for (const n of nodes) {
      const t = n.track
      const rs = T + t.clip.start
      const re = Math.min(T + dur, rs + t.clip.len)
      if (rs >= total) continue
      if (n.continuous) {
        if (n.alwaysOn) continue
        const g = n.gain.gain
        const fade = clamp(Math.min(1.2, t.clip.len * 0.3), 0.05, Math.max(0.05, t.clip.len / 2))
        g.setValueAtTime(0, Math.max(0, rs - 0.01))
        g.linearRampToValueAtTime(n.level, rs + fade)
        g.setValueAtTime(n.level, Math.max(rs + fade, re - fade))
        g.linearRampToValueAtTime(0, re)
      } else {
        const span = re - rs
        const count = Math.round(span * eventRate(t.motion))
        for (let i = 0; i < count; i++) {
          const time = rs + Math.random() * Math.max(0.05, span - 0.15)
          if (time < total) spawnEvent(octx, t.type, n.tone, time, eventMidi(n.base + t.pitch))
        }
      }
    }
  }

  let rendered = await octx.startRendering()
  rendered = makeSeamless(rendered, dur, xfade)
  if (opts.normalize) rendered = normalizeBuffer(rendered, 0.92)
  return rendered
}
