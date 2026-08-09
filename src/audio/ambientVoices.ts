/** Generative building blocks for the ambient engine — shared by live playback and offline render. */
import type { LayerType } from '../state/ambientTypes'
import { getNoiseBuffer } from './context'
import { midiFreq } from '../utils/notes'
import { clamp, normToExp } from '../utils/misc'

/** tone 0..1 → filter cutoff, exponential */
export const toneCutoff = (tone: number) => normToExp(clamp(tone, 0, 1), 180, 16000)

export interface GenHandle {
  update: (motion: number, midi: number) => void
  stop: () => void
}

function noiseSource(ctx: BaseAudioContext) {
  const n = ctx.createBufferSource()
  n.buffer = getNoiseBuffer(ctx)
  n.loop = true
  return n
}

const startAll = (ctx: BaseAudioContext, nodes: (OscillatorNode | AudioBufferSourceNode)[]) => {
  const t = ctx.currentTime
  for (const n of nodes) {
    try { n.start(t) } catch { /* already started */ }
  }
}

/**
 * Build a continuous texture generator for `type`, feeding `dest`.
 * The returned handle updates live with motion (0..1) + absolute midi centre.
 */
export function buildContinuous(ctx: BaseAudioContext, type: LayerType, dest: AudioNode, base: number, motion: number, midi: number): GenHandle {
  const g = () => ctx.createGain()
  const osc = (wave: OscillatorType) => { const o = ctx.createOscillator(); o.type = wave; return o }

  switch (type) {
    case 'wind': {
      const src = noiseSource(ctx)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
      const amp = g(); amp.gain.value = 0.5
      const lfoF = osc('sine'); const lfoFg = g()
      const lfoA = osc('sine'); const lfoAg = g(); lfoAg.gain.value = 0.28
      lfoF.connect(lfoFg).connect(bp.frequency)
      lfoA.connect(lfoAg).connect(amp.gain)
      src.connect(bp).connect(amp).connect(dest)
      const update = (m: number, md: number) => {
        bp.frequency.value = clamp(midiFreq(md), 90, 1500)
        bp.Q.value = 0.6 + m * 1.4
        lfoF.frequency.value = 0.03 + m * 0.22
        lfoFg.gain.value = 120 + m * 360
        lfoA.frequency.value = 0.04 + m * 0.12
      }
      update(motion, midi)
      startAll(ctx, [src, lfoF, lfoA])
      return { update, stop: () => { try { src.stop(); lfoF.stop(); lfoA.stop() } catch { /* noop */ } } }
    }
    case 'drone': {
      const o1 = osc('sawtooth'); const o2 = osc('sawtooth'); const o3 = osc('sine')
      const sum = g(); sum.gain.value = 0.3
      const g3 = g(); g3.gain.value = 0.5
      const vib = osc('sine'); const vibg = g()
      vib.connect(vibg); vibg.connect(o1.detune); vibg.connect(o2.detune)
      o1.connect(sum); o2.connect(sum); o3.connect(g3).connect(sum)
      sum.connect(dest)
      o2.detune.value = 7
      const update = (m: number, md: number) => {
        const f = midiFreq(md)
        o1.frequency.value = f; o2.frequency.value = f; o3.frequency.value = f / 2
        vib.frequency.value = 0.05 + m * 0.3
        vibg.gain.value = 3 + m * 12
      }
      update(motion, midi)
      startAll(ctx, [o1, o2, o3, vib])
      return { update, stop: () => { try { o1.stop(); o2.stop(); o3.stop(); vib.stop() } catch { /* noop */ } } }
    }
    case 'pad': {
      const os = [osc('triangle'), osc('triangle'), osc('sine')]
      const sum = g(); sum.gain.value = 0.24
      const vib = osc('sine'); const vibg = g()
      for (const o of os) { vib.connect(vibg).connect(o.detune); o.connect(sum) }
      sum.connect(dest)
      const update = (m: number, md: number) => {
        os[0].frequency.value = midiFreq(md)
        os[1].frequency.value = midiFreq(md + 7)
        os[2].frequency.value = midiFreq(md + 12)
        vib.frequency.value = 0.08 + m * 0.4
        vibg.gain.value = 2 + m * 9
      }
      update(motion, midi)
      startAll(ctx, [...os, vib])
      return { update, stop: () => { try { os.forEach((o) => o.stop()); vib.stop() } catch { /* noop */ } } }
    }
    case 'rain': {
      const src = noiseSource(ctx)
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
      const amp = g(); amp.gain.value = 0.22
      const trem = osc('sine'); const tremg = g(); tremg.gain.value = 0.12
      trem.connect(tremg).connect(amp.gain)
      src.connect(hp).connect(amp).connect(dest)
      const update = (m: number, md: number) => {
        hp.frequency.value = clamp(midiFreq(md) * 0.6 + 900, 700, 6000)
        trem.frequency.value = 4 + m * 12
      }
      update(motion, midi)
      startAll(ctx, [src, trem])
      return { update, stop: () => { try { src.stop(); trem.stop() } catch { /* noop */ } } }
    }
    case 'water': {
      const src = noiseSource(ctx)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4
      const amp = g(); amp.gain.value = 0.4
      // two incommensurate LFOs → pseudo-random bubbling on the band centre
      const l1 = osc('sine'); const l1g = g(); const l2 = osc('triangle'); const l2g = g()
      l1.connect(l1g).connect(bp.frequency); l2.connect(l2g).connect(bp.frequency)
      src.connect(bp).connect(amp).connect(dest)
      const update = (m: number, md: number) => {
        const c = clamp(midiFreq(md), 200, 2000)
        bp.frequency.value = c
        l1.frequency.value = 1.3 + m * 6; l1g.gain.value = c * 0.4
        l2.frequency.value = 2.7 + m * 9; l2g.gain.value = c * 0.3
        bp.Q.value = 3 + m * 6
      }
      update(motion, midi)
      startAll(ctx, [src, l1, l2])
      return { update, stop: () => { try { src.stop(); l1.stop(); l2.stop() } catch { /* noop */ } } }
    }
    case 'hum': {
      const o1 = osc('square'); const o2 = osc('sawtooth')
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3
      const amp = g(); amp.gain.value = 0.16
      const trem = osc('sine'); const tremg = g(); tremg.gain.value = 0.09
      o2.detune.value = 8
      trem.connect(tremg).connect(amp.gain)
      o1.connect(lp); o2.connect(lp); lp.connect(amp).connect(dest)
      const update = (m: number, md: number) => {
        o1.frequency.value = midiFreq(md); o2.frequency.value = midiFreq(md)
        trem.frequency.value = 1.5 + m * 8
        lp.frequency.value = 500 + m * 1400
      }
      update(motion, midi)
      startAll(ctx, [o1, o2, trem])
      return { update, stop: () => { try { o1.stop(); o2.stop(); trem.stop() } catch { /* noop */ } } }
    }
    case 'surge':
    default: {
      const o1 = osc('sawtooth'); const o2 = osc('sawtooth')
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6
      const amp = g(); amp.gain.value = 0.14
      const swell = osc('sine'); const swellCut = g(); const swellAmp = g(); swellAmp.gain.value = 0.1
      o2.detune.value = 11
      swell.connect(swellCut).connect(lp.frequency)
      swell.connect(swellAmp).connect(amp.gain)
      o1.connect(lp); o2.connect(lp); lp.connect(amp).connect(dest)
      const update = (m: number, md: number) => {
        o1.frequency.value = midiFreq(md); o2.frequency.value = midiFreq(md)
        lp.frequency.value = 700
        swell.frequency.value = 0.04 + m * 0.24
        swellCut.gain.value = 500
      }
      update(motion, midi)
      startAll(ctx, [o1, o2, swell])
      return { update, stop: () => { try { o1.stop(); o2.stop(); swell.stop() } catch { /* noop */ } } }
    }
  }
}

const PENTA = [0, 3, 5, 7, 10] // minor pentatonic

/** Pick a scale-quantised midi for a discrete event around `base`. */
export function eventMidi(base: number): number {
  const step = PENTA[Math.floor(Math.random() * PENTA.length)]
  const oct = 12 * Math.floor(Math.random() * 2) // base octave or one up
  return base + step + oct
}

/**
 * Fire a single discrete event (spark / bells) at `time` feeding `dest` (dry) and `send` (reverb).
 * Returns the time the voice is fully finished.
 */
export function spawnEvent(
  ctx: BaseAudioContext,
  type: LayerType,
  dest: AudioNode,
  time: number,
  midi: number,
  send?: AudioNode,
): number {
  const g = () => ctx.createGain()
  if (type === 'bells') {
    const partials = [1, 2.76, 5.4]
    const levels = [0.5, 0.28, 0.12]
    const decay = 1.6 + Math.random() * 1.2
    const f0 = midiFreq(midi)
    const out = g()
    out.connect(dest); if (send) out.connect(send)
    partials.forEach((ratio, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f0 * ratio
      const env = g(); env.gain.value = 0
      o.connect(env).connect(out)
      const peak = levels[i] * 0.5
      env.gain.setValueAtTime(0, time)
      env.gain.linearRampToValueAtTime(peak, time + 0.006)
      env.gain.exponentialRampToValueAtTime(0.0006, time + decay * (1 - i * 0.18))
      o.start(time); o.stop(time + decay + 0.05)
    })
    return time + decay + 0.1
  }
  // spark — a soft sine/triangle blip
  const decay = 0.4 + Math.random() * 0.9
  const o = ctx.createOscillator()
  o.type = Math.random() < 0.5 ? 'sine' : 'triangle'
  o.frequency.value = midiFreq(midi)
  const env = g(); env.gain.value = 0
  o.connect(env); env.connect(dest); if (send) env.connect(send)
  env.gain.setValueAtTime(0, time)
  env.gain.linearRampToValueAtTime(0.5, time + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0006, time + decay)
  o.start(time); o.stop(time + decay + 0.05)
  return time + decay + 0.1
}

/** discrete events per second for a given motion (density). */
export const eventRate = (motion: number) => 0.15 + motion * 2.2

/* ---------------- master colouring ---------------- */

export function makeReverbIR(ctx: BaseAudioContext, seconds = 3.4, decay = 0.62): AudioBuffer {
  const len = Math.max(256, Math.floor(ctx.sampleRate * seconds))
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  const tau = 0.1 + decay * seconds * 0.5
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t / tau)
    }
    const ramp = Math.floor(ctx.sampleRate * 0.006)
    for (let i = 0; i < ramp; i++) d[i] *= i / ramp
  }
  return ir
}

export interface LofiBus {
  input: GainNode
  out: GainNode
  setLofi: (on: boolean, immediate?: boolean) => void
}

/** input → [crusher] → lowpass → (dry + chorus) → out. 90s/Y2K colouring toggle. */
export function buildLofiChain(ctx: BaseAudioContext, crusher: AudioWorkletNode | null): LofiBus {
  const input = ctx.createGain()
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7400; lp.Q.value = 0.5
  const chDelay = ctx.createDelay(0.05); chDelay.delayTime.value = 0.021
  const chLfo = ctx.createOscillator(); chLfo.type = 'sine'; chLfo.frequency.value = 0.55
  const chLfoG = ctx.createGain(); chLfoG.gain.value = 0.006
  chLfo.connect(chLfoG).connect(chDelay.delayTime)
  try { chLfo.start() } catch { /* noop */ }
  const chWet = ctx.createGain(); chWet.gain.value = 0.3
  const out = ctx.createGain()

  const head: AudioNode = crusher ?? ctx.createGain()
  input.connect(head)
  head.connect(lp)
  lp.connect(out)
  lp.connect(chDelay).connect(chWet).connect(out)

  const setLofi = (on: boolean, immediate = false) => {
    const t = ctx.currentTime
    const set = (p: AudioParam, v: number) => { immediate ? (p.value = v) : p.setTargetAtTime(v, t, 0.05) }
    set(lp.frequency, on ? 7000 : 18500)
    set(chWet.gain, on ? 0.34 : 0.14)
    if (crusher) {
      const bits = crusher.parameters.get('bits')
      const red = crusher.parameters.get('reduction')
      const mix = crusher.parameters.get('mix')
      if (bits) set(bits, on ? 9 : 16)
      if (red) set(red, on ? 3 : 1)
      if (mix) set(mix, on ? 0.32 : 0)
    }
  }
  setLofi(true, true)
  return { input, out, setLofi }
}
