import type { PitchEnvParams, SamplerParams, SynthParams } from '../state/types'
import { midiFreq } from '../utils/notes'
import { getNoiseBuffer, reversedBuffer } from './context'
import { clamp, lerp } from '../utils/misc'

export interface Voice {
  readonly midi: number
  readonly startedAt: number
  /** trigger the release stage */
  release(when?: number): void
  /** immediate silence + cleanup */
  kill(): void
}

/** Schedule the pitch envelope (in cents) on a ConstantSource that feeds detune params. */
function schedulePitchEnv(offset: AudioParam, penv: PitchEnvParams, t0: number) {
  const s = penv.start * 100
  const e = penv.end * 100
  offset.setValueAtTime(s, t0)
  if (Math.abs(s - e) < 1) {
    offset.setValueAtTime(e, t0)
    return
  }
  const time = Math.max(0.01, penv.time)
  if (penv.bend <= 0.05) {
    offset.linearRampToValueAtTime(e, t0 + time)
  } else {
    // curved swoop — approaches the target fast then eases in
    const tau = Math.max(0.006, (time * (1.05 - penv.bend)) / 3)
    offset.setTargetAtTime(e, t0, tau)
  }
}

export class SynthVoice implements Voice {
  readonly midi: number
  readonly startedAt: number
  private ctx: BaseAudioContext
  private amp: GainNode
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = []
  private penvSrc: ConstantSourceNode
  private p: SynthParams
  private vel: number
  private released = false

  constructor(ctx: BaseAudioContext, dest: AudioNode, p: SynthParams, midi: number, vel: number, t0: number) {
    this.ctx = ctx
    this.midi = midi
    this.startedAt = t0
    this.p = p
    this.vel = vel

    this.amp = ctx.createGain()
    this.amp.gain.value = 0
    this.amp.connect(dest)

    this.penvSrc = ctx.createConstantSource()
    this.penvSrc.offset.value = 0
    schedulePitchEnv(this.penvSrc.offset, p.penv, t0)
    this.penvSrc.start(t0)

    const baseMidi = midi + p.transpose
    const oscs: { wave: OscillatorNode['type']; semi: number; level: number; detune: number }[] = []
    if (p.o1.level > 0.001) oscs.push({ wave: p.o1.wave, semi: p.o1.semi, level: p.o1.level, detune: p.o1.detune })
    if (p.o2.level > 0.001) oscs.push({ wave: p.o2.wave, semi: p.o2.semi, level: p.o2.level, detune: p.o2.detune })

    for (const o of oscs) {
      const osc = ctx.createOscillator()
      osc.type = o.wave
      osc.frequency.value = midiFreq(clamp(baseMidi + o.semi, 0, 127))
      osc.detune.value = o.detune
      this.penvSrc.connect(osc.detune)
      const g = ctx.createGain()
      g.gain.value = o.level * 0.5
      osc.connect(g)
      g.connect(this.amp)
      osc.start(t0)
      this.sources.push(osc)
    }

    if (p.noise > 0.001) {
      const src = ctx.createBufferSource()
      src.buffer = getNoiseBuffer(ctx)
      src.loop = true
      if (src.detune) this.penvSrc.connect(src.detune)
      const g = ctx.createGain()
      g.gain.value = p.noise * 0.5
      src.connect(g)
      g.connect(this.amp)
      src.start(t0)
      this.sources.push(src)
    }

    // ADSR attack + decay
    const { a, d, s } = p.adsr
    const g = this.amp.gain
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(vel, t0 + Math.max(0.0015, a))
    g.linearRampToValueAtTime(vel * s, t0 + Math.max(0.0015, a) + Math.max(0.005, d))
  }

  /** analytic envelope value so release can start from the true level on any browser */
  private envValueAt(t: number): number {
    const { a, d, s } = this.p.adsr
    const at = Math.max(0.0015, a)
    const dt = Math.max(0.005, d)
    const dtFromStart = t - this.startedAt
    if (dtFromStart <= 0) return 0
    if (dtFromStart < at) return (this.vel * dtFromStart) / at
    if (dtFromStart < at + dt) return lerp(this.vel, this.vel * this.p.adsr.s, (dtFromStart - at) / dt)
    return this.vel * s
  }

  release(when?: number) {
    if (this.released) return
    this.released = true
    const t = Math.max(when ?? this.ctx.currentTime, this.ctx.currentTime)
    const r = Math.max(0.008, this.p.adsr.r)
    const g = this.amp.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(this.envValueAt(t), t)
    g.setTargetAtTime(0, t, r / 4)
    const stopAt = t + r + 0.25
    for (const s of this.sources) s.stop(stopAt)
    this.penvSrc.stop(stopAt)
    if (this.ctx instanceof AudioContext) {
      window.setTimeout(() => this.kill(), (stopAt - this.ctx.currentTime) * 1000 + 80)
    }
  }

  kill() {
    try {
      for (const s of this.sources) s.stop()
      this.penvSrc.stop()
    } catch {
      /* already stopped */
    }
    try {
      this.amp.disconnect()
    } catch { /* noop */ }
  }
}

export interface SamplerVoiceInfo {
  t0: number
  outDur: number
  startFrac: number
  endFrac: number
  reverse: boolean
  loop: boolean
}

export class SamplerVoice implements Voice {
  readonly midi: number
  readonly startedAt: number
  readonly info: SamplerVoiceInfo
  private ctx: BaseAudioContext
  private src: AudioBufferSourceNode
  private amp: GainNode
  private penvSrc: ConstantSourceNode
  private gainLevel: number
  private done = false

  constructor(
    ctx: BaseAudioContext,
    dest: AudioNode,
    buffer: AudioBuffer,
    sp: SamplerParams,
    penv: PitchEnvParams,
    midi: number,
    vel: number,
    t0: number,
    loopOverride?: boolean,
  ) {
    this.ctx = ctx
    this.midi = midi
    this.startedAt = t0

    const s = clamp(Math.min(sp.start, sp.end), 0, 1)
    const e = clamp(Math.max(sp.start, sp.end, s + 0.002), 0, 1)
    const dur = buffer.duration
    const playBuf = sp.reverse ? reversedBuffer(buffer) : buffer
    const offset = sp.reverse ? (1 - e) * dur : s * dur
    const regionDur = Math.max(0.003, (e - s) * dur)
    const rate = clamp(sp.speed * Math.pow(2, (midi - 60 + sp.pitch) / 12), 0.03, 16)
    const outDur = regionDur / rate
    const loop = loopOverride ?? sp.loop

    this.src = ctx.createBufferSource()
    this.src.buffer = playBuf
    this.src.playbackRate.value = rate
    this.penvSrc = ctx.createConstantSource()
    this.penvSrc.offset.value = 0
    schedulePitchEnv(this.penvSrc.offset, penv, t0)
    this.penvSrc.start(t0)
    if (this.src.detune) this.penvSrc.connect(this.src.detune)

    this.amp = ctx.createGain()
    this.gainLevel = sp.gain * vel
    this.src.connect(this.amp)
    this.amp.connect(dest)

    const g = this.amp.gain
    const fi = clamp(sp.fadeIn, 0.0015, outDur * 0.5)
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(this.gainLevel, t0 + fi)

    if (loop) {
      this.src.loop = true
      this.src.loopStart = offset
      this.src.loopEnd = offset + regionDur
      this.src.start(t0, offset)
    } else {
      const fo = clamp(sp.fadeOut, 0.003, outDur * 0.6)
      g.setValueAtTime(this.gainLevel, Math.max(t0 + fi, t0 + outDur - fo))
      g.linearRampToValueAtTime(0, t0 + outDur)
      this.src.start(t0, offset, regionDur + 0.002)
      this.src.stop(t0 + outDur + 0.05)
    }

    this.info = { t0, outDur, startFrac: s, endFrac: e, reverse: sp.reverse, loop }
    this.src.onended = () => {
      this.done = true
      try {
        this.amp.disconnect()
        this.penvSrc.stop()
      } catch { /* noop */ }
    }
  }

  /** Playhead position in original-buffer coordinates (0..1), or null when finished. */
  progress(now: number): number | null {
    if (this.done) return null
    const { t0, outDur, startFrac, endFrac, reverse, loop } = this.info
    let dt = now - t0
    if (dt < 0) return null
    if (loop) dt = dt % outDur
    else if (dt > outDur) return null
    const frac = dt / outDur
    return reverse ? endFrac - frac * (endFrac - startFrac) : startFrac + frac * (endFrac - startFrac)
  }

  release(when?: number) {
    const t = Math.max(when ?? this.ctx.currentTime, this.ctx.currentTime)
    const g = this.amp.gain
    g.cancelScheduledValues(t)
    g.setTargetAtTime(0, t, 0.02)
    this.src.stop(t + 0.12)
  }

  kill() {
    this.done = true
    try {
      this.src.stop()
    } catch { /* noop */ }
    try {
      this.amp.disconnect()
    } catch { /* noop */ }
  }
}
