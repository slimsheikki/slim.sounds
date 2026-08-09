import type { FxParams, Patch, SeqParams } from '../state/types'
import { EffectsChain } from './EffectsChain'
import { getCtx } from './context'
import { SamplerVoice, SynthVoice, type Voice } from './voices'
import { clamp } from '../utils/misc'

export const stepDurSec = (bpm: number, rate: number) => (60 / bpm) * (4 / rate)

export interface SeqContext {
  seq: SeqParams
  bpm: number
  patch: Patch
  buffer: AudioBuffer | null
}

/** How long a one-shot synth note is held before release (percussive-friendly). */
export const synthHold = (p: Patch) => Math.max(0.12, p.synth.adsr.a * 1.2 + p.synth.adsr.d * 0.9)

/**
 * Live audio engine — owns the AudioContext graph:
 * voices → effects chain → master → limiter → analyser → speakers
 */
class Engine {
  chain: EffectsChain | null = null
  analyser: AnalyserNode | null = null
  externalIn: GainNode | null = null
  private master: GainNode | null = null
  private held = new Map<string, Voice>()
  private shots = new Set<Voice>()
  private lastSampler: SamplerVoice | null = null
  private playbackVoice: Voice | null = null
  private playbackEndsAt = 0
  private volume = 0.85

  // sequencer
  private seqTimer: number | null = null
  private seqStep = 0
  private seqNextTime = 0
  private pendingSteps: { t: number; step: number }[] = []
  playheadStep = -1
  seqRunning = false

  private levelData: Uint8Array | null = null

  ensure() {
    const ctx = getCtx()
    if (!this.chain) {
      this.chain = new EffectsChain(ctx, false)
      this.master = ctx.createGain()
      this.master.gain.value = this.volume
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -3
      limiter.knee.value = 4
      limiter.ratio.value = 14
      limiter.attack.value = 0.002
      limiter.release.value = 0.12
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.75
      this.externalIn = ctx.createGain() // ambient engine (and future sources) tap in here
      this.chain.output.connect(this.master)
      this.externalIn.connect(this.master)
      this.master.connect(limiter)
      limiter.connect(this.analyser)
      this.analyser.connect(ctx.destination)
    }
    return { ctx, input: this.chain.input }
  }

  /** Shared bus for external sound sources (ambient engine) — post-source, pre-volume/limiter. */
  getExternalIn(): GainNode {
    this.ensure()
    return this.externalIn!
  }

  updateFx(fx: FxParams) {
    if (this.chain) this.chain.update(fx)
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master) this.master.gain.setTargetAtTime(v, getCtx().currentTime, 0.02)
  }

  get activeVoices() {
    return this.held.size + this.shots.size + (this.playbackVoice ? 1 : 0)
  }

  private prune() {
    const now = getCtx().currentTime
    for (const v of this.shots) {
      if (v instanceof SamplerVoice && v.progress(now) === null) this.shots.delete(v)
    }
    if (this.shots.size > 20) {
      const first = this.shots.values().next().value
      if (first) {
        first.kill()
        this.shots.delete(first)
      }
    }
  }

  private spawn(patch: Patch, buffer: AudioBuffer | null, midi: number, vel: number, t: number, loopOverride?: boolean): Voice | null {
    const { ctx, input } = this.ensure()
    void ctx
    if (patch.soundSource === 'sample' && buffer) {
      const v = new SamplerVoice(getCtx(), input, buffer, patch.sampler, patch.synth.penv, midi, vel, t, loopOverride)
      this.lastSampler = v
      return v
    }
    if (patch.soundSource === 'sample' && !buffer) return null
    return new SynthVoice(getCtx(), input, patch.synth, midi, vel, t)
  }

  /** keyboard / piano note on-off (held) */
  noteOn(key: string, patch: Patch, buffer: AudioBuffer | null, midi: number, vel: number) {
    this.noteOffKey(key)
    const { ctx } = this.ensure()
    const v = this.spawn(patch, buffer, clamp(midi, 0, 127), vel, ctx.currentTime, false)
    if (v) this.held.set(key, v)
    this.prune()
  }

  noteOffKey(key: string) {
    const v = this.held.get(key)
    if (v) {
      v.release()
      this.held.delete(key)
    }
  }

  allNotesOff() {
    for (const v of this.held.values()) v.release()
    this.held.clear()
  }

  /** fire-and-forget trigger (sequencer, preset preview) */
  trigger(patch: Patch, buffer: AudioBuffer | null, midi: number, vel: number, t: number, gateDur: number) {
    const v = this.spawn(patch, buffer, clamp(midi, 0, 127), vel, t, false)
    if (!v) return
    if (v instanceof SynthVoice) v.release(t + gateDur)
    this.shots.add(v)
    this.prune()
  }

  /** transport PLAY for the current sound; returns whether something started */
  playCurrent(patch: Patch, buffer: AudioBuffer | null): boolean {
    const { ctx } = this.ensure()
    this.stopPlayback()
    if (patch.soundSource === 'sample') {
      if (!buffer) return false
      const v = new SamplerVoice(ctx, this.chain!.input, buffer, patch.sampler, patch.synth.penv, 60, 1, ctx.currentTime)
      this.lastSampler = v
      this.playbackVoice = v
      return true
    }
    const v = this.spawn(patch, buffer, patch.seq.root, 1, ctx.currentTime, false)
    if (!v) return false
    v.release(ctx.currentTime + synthHold(patch))
    this.playbackEndsAt = ctx.currentTime + synthHold(patch) + patch.synth.adsr.r + 0.1
    this.playbackVoice = v
    return true
  }

  stopPlayback() {
    if (this.playbackVoice) {
      this.playbackVoice.release()
      this.playbackVoice = null
    }
  }

  /** playhead in original sample coordinates, or null */
  samplePlayhead(): number | null {
    if (!this.lastSampler) return null
    const p = this.lastSampler.progress(getCtx().currentTime)
    if (p === null && this.playbackVoice === this.lastSampler) this.playbackVoice = null
    return p
  }

  playbackActive(): boolean {
    if (!this.playbackVoice) return false
    if (this.playbackVoice instanceof SamplerVoice) {
      return this.playbackVoice.progress(getCtx().currentTime) !== null
    }
    return getCtx().currentTime < this.playbackEndsAt
  }

  /* ---------------- sequencer ---------------- */

  startSeq(get: () => SeqContext) {
    this.stopSeq()
    const { ctx } = this.ensure()
    this.seqStep = 0
    this.seqNextTime = ctx.currentTime + 0.06
    this.pendingSteps = []
    this.seqRunning = true
    this.playheadStep = -1
    const tick = () => {
      const c = get()
      const dur = stepDurSec(c.bpm, c.seq.rate)
      const horizon = getCtx().currentTime + 0.16
      while (this.seqNextTime < horizon) {
        const len = clamp(c.seq.length, 1, 16)
        const stepIdx = this.seqStep % len
        const swingOff = stepIdx % 2 === 1 ? c.seq.swing * dur * 0.5 : 0
        const t = this.seqNextTime + swingOff
        const grid = c.seq.patterns[c.seq.pattern]
        for (let r = 0; r < grid.length; r++) {
          if (grid[r][stepIdx]) {
            this.trigger(c.patch, c.buffer, c.seq.root + c.seq.offsets[r], 0.92, t, Math.max(0.03, dur * c.seq.gate))
          }
        }
        this.pendingSteps.push({ t, step: stepIdx })
        this.seqStep++
        this.seqNextTime += dur
      }
      const now = getCtx().currentTime
      while (this.pendingSteps.length && this.pendingSteps[0].t <= now) {
        this.playheadStep = this.pendingSteps.shift()!.step
      }
    }
    tick()
    this.seqTimer = window.setInterval(tick, 25)
  }

  stopSeq() {
    if (this.seqTimer !== null) {
      window.clearInterval(this.seqTimer)
      this.seqTimer = null
    }
    this.seqRunning = false
    this.playheadStep = -1
    this.pendingSteps = []
  }

  stopEverything() {
    this.stopSeq()
    this.stopPlayback()
    this.allNotesOff()
    for (const v of this.shots) v.release()
    this.shots.clear()
  }

  /** output level 0..1 (rms-ish) for meters */
  getLevel(): number {
    if (!this.analyser) return 0
    if (!this.levelData || this.levelData.length !== this.analyser.fftSize) {
      this.levelData = new Uint8Array(this.analyser.fftSize)
    }
    this.analyser.getByteTimeDomainData(this.levelData)
    let sum = 0
    for (let i = 0; i < this.levelData.length; i += 4) {
      const s = (this.levelData[i] - 128) / 128
      sum += s * s
    }
    return Math.min(1, Math.sqrt(sum / (this.levelData.length / 4)) * 2.2)
  }
}

export const engine = new Engine()

export async function decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
  const ctx = getCtx()
  const ab = await file.arrayBuffer()
  return ctx.decodeAudioData(ab)
}
