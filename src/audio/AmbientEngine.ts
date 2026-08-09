/** Live generative ambient engine — persistent layer graph + a lookahead scheduler that loops the scene forever. */
import type { LayerType, Scene, Track } from '../state/ambientTypes'
import { LAYER_DEFS } from '../state/ambientTypes'
import { engine } from './Engine'
import { getCtx, ensureCrusher } from './context'
import {
  buildContinuous,
  buildLofiChain,
  eventMidi,
  eventRate,
  makeReverbIR,
  spawnEvent,
  toneCutoff,
  type GenHandle,
  type LofiBus,
} from './ambientVoices'
import { clamp } from '../utils/misc'

interface TrackNodes {
  id: string
  type: LayerType
  continuous: boolean
  base: number
  tone: BiquadFilterNode
  gain: GainNode
  send: GainNode
  gen: GenHandle | null
  level: number
  alwaysOn: boolean
}

const isAlwaysOn = (t: Track, duration: number) =>
  t.clip.start <= 0.05 && t.clip.start + t.clip.len >= duration - 0.05

class AmbientEngine {
  private ctx: AudioContext | null = null
  private lofi: LofiBus | null = null
  private reverb: ConvolverNode | null = null
  private reverbReturn: GainNode | null = null
  private dryBus: GainNode | null = null
  private nodes = new Map<string, TrackNodes>()
  private crusher: AudioWorkletNode | null = null

  private timer: number | null = null
  private startTime = 0
  private dur = 24
  private nextCycle = 0
  running = false

  // held preview voices played from the piano (independent of the scene loop)
  private previews = new Map<string, { gen: GenHandle | null; tone: BiquadFilterNode; gain: GainNode; send: GainNode }>()

  private ensure() {
    if (this.ctx) return this.ctx
    const ctx = getCtx()
    this.ctx = ctx
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = makeReverbIR(ctx)
    this.reverbReturn = ctx.createGain(); this.reverbReturn.gain.value = 0.9
    this.dryBus = ctx.createGain()
    this.lofi = buildLofiChain(ctx, null)
    this.reverb.connect(this.reverbReturn).connect(this.lofi.input)
    this.dryBus.connect(this.lofi.input)
    this.lofi.out.connect(engine.getExternalIn())
    // splice the bitcrusher in once its worklet is ready
    void ensureCrusher(ctx).then((ok) => {
      if (!ok || !this.ctx || !this.lofi) return
      try {
        this.crusher = new AudioWorkletNode(this.ctx, 'slim-crusher', { outputChannelCount: [2] })
        this.rebuildLofi()
      } catch { this.crusher = null }
    })
    return ctx
  }

  private rebuildLofi() {
    if (!this.ctx || !this.lofi || !this.reverbReturn || !this.dryBus) return
    try { this.lofi.out.disconnect() } catch { /* noop */ }
    const next = buildLofiChain(this.ctx, this.crusher)
    // re-point sources at the new chain
    try { this.reverbReturn.disconnect() } catch { /* noop */ }
    try { this.dryBus.disconnect() } catch { /* noop */ }
    this.reverbReturn.connect(next.input)
    this.dryBus.connect(next.input)
    next.out.connect(engine.getExternalIn())
    this.lofi = next
    this.lofi.setLofi(this.lastLofi, true)
  }

  private lastLofi = true

  private ensureTrack(t: Track): TrackNodes {
    let n = this.nodes.get(t.id)
    const ctx = this.ctx!
    if (!n) {
      const def = LAYER_DEFS[t.type]
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6
      const gain = ctx.createGain(); gain.gain.value = 0
      const send = ctx.createGain(); send.gain.value = 0
      tone.connect(gain)
      gain.connect(this.dryBus!)
      gain.connect(send)
      send.connect(this.reverb!)
      const gen = def.continuous ? buildContinuous(ctx, t.type, tone, def.base, t.motion, def.base + t.pitch) : null
      n = { id: t.id, type: t.type, continuous: def.continuous, base: def.base, tone, gain, send, gen, level: t.level, alwaysOn: false }
      this.nodes.set(t.id, n)
    }
    return n
  }

  /** Reconcile the live graph with the scene (create/update/remove tracks). */
  sync(scene: Scene) {
    const ctx = this.ensure()
    this.lastLofi = scene.lofi
    this.lofi?.setLofi(scene.lofi)

    const seen = new Set<string>()
    for (const t of scene.tracks) {
      seen.add(t.id)
      const n = this.ensureTrack(t)
      const md = n.base + t.pitch
      n.gen?.update(t.motion, md)
      n.tone.frequency.setTargetAtTime(toneCutoff(t.tone), ctx.currentTime, 0.04)
      n.level = t.muted ? 0 : t.level
      n.alwaysOn = isAlwaysOn(t, scene.duration)
      n.send.gain.setTargetAtTime(t.muted ? 0 : t.space, ctx.currentTime, 0.04)

      const target =
        n.continuous
          ? (this.running && n.alwaysOn ? n.level : this.running ? undefined : 0)
          : (this.running ? n.level : 0)
      if (target !== undefined) n.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08)
    }
    // drop removed tracks
    for (const [id, n] of this.nodes) {
      if (!seen.has(id)) {
        try { n.gen?.stop(); n.tone.disconnect(); n.gain.disconnect(); n.send.disconnect() } catch { /* noop */ }
        this.nodes.delete(id)
      }
    }
  }

  start(getScene: () => Scene) {
    const ctx = this.ensure()
    const scene = getScene()
    this.running = true
    this.dur = scene.duration
    this.startTime = ctx.currentTime + 0.12
    this.nextCycle = 0
    this.sync(scene)
    const tick = () => {
      const s = getScene()
      const now = ctx.currentTime
      if (Math.abs(s.duration - this.dur) > 0.001) {
        this.dur = s.duration
        this.startTime = now + 0.06
        this.nextCycle = 0
      }
      const horizon = now + 0.6
      let guard = 0
      while (this.startTime + this.nextCycle * this.dur < horizon && guard++ < 64) {
        this.scheduleCycle(this.nextCycle, s, now)
        this.nextCycle++
      }
    }
    tick()
    this.timer = window.setInterval(tick, 60)
  }

  private scheduleCycle(cycle: number, scene: Scene, now: number) {
    const ctx = this.ctx!
    const T = this.startTime + cycle * this.dur
    for (const t of scene.tracks) {
      const n = this.nodes.get(t.id)
      if (!n || t.muted) continue
      const rs = T + t.clip.start
      const re = Math.min(T + this.dur, rs + t.clip.len)
      if (re <= now) continue
      if (n.continuous) {
        if (n.alwaysOn) continue // held open by sync()
        const g = n.gain.gain
        const fade = clamp(Math.min(1.2, t.clip.len * 0.3), 0.05, Math.max(0.05, t.clip.len / 2))
        const s0 = Math.max(now, rs)
        g.setValueAtTime(g.value, Math.max(now, rs - 0.01))
        g.linearRampToValueAtTime(n.level, s0 + fade)
        g.setValueAtTime(n.level, Math.max(s0 + fade, re - fade))
        g.linearRampToValueAtTime(0, re)
      } else {
        const span = re - rs
        const count = Math.round(span * eventRate(t.motion))
        for (let i = 0; i < count; i++) {
          const time = rs + Math.random() * Math.max(0.05, span - 0.15)
          if (time > now + 0.01) spawnEvent(ctx, t.type, n.tone, time, eventMidi(n.base + t.pitch))
        }
      }
    }
  }

  /** brief audition of one layer while stopped (preset / click preview). */
  preview(track: Track) {
    if (this.running) return
    const ctx = this.ensure()
    this.sync({ duration: this.dur, loop: true, lofi: this.lastLofi, name: '', tracks: [track] })
    const n = this.nodes.get(track.id)
    if (!n) return
    const now = ctx.currentTime
    if (n.continuous) {
      const g = n.gain.gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(0, now)
      g.linearRampToValueAtTime(track.level, now + 0.15)
      g.setValueAtTime(track.level, now + 1.2)
      g.linearRampToValueAtTime(0, now + 1.7)
    } else {
      n.gain.gain.setValueAtTime(track.level, now)
      for (let i = 0; i < 4; i++) {
        spawnEvent(ctx, track.type, n.tone, now + 0.05 + i * 0.28 + Math.random() * 0.1, eventMidi(n.base + track.pitch))
      }
    }
  }

  /** Play the given layer's voice at a pitch while a piano key is held. */
  noteOn(key: string, track: Track, midi: number) {
    const ctx = this.ensure()
    this.noteOff(key)
    const def = LAYER_DEFS[track.type]
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6
    tone.frequency.value = toneCutoff(track.tone)
    const gain = ctx.createGain(); gain.gain.value = 0
    const send = ctx.createGain(); send.gain.value = track.space
    tone.connect(gain); gain.connect(this.dryBus!); gain.connect(send); send.connect(this.reverb!)
    const now = ctx.currentTime
    if (def.continuous) {
      const gen = buildContinuous(ctx, track.type, tone, def.base, track.motion, midi)
      const atk = track.type === 'pad' || track.type === 'drone' || track.type === 'surge' ? 0.3 : 0.12
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(track.level, now + atk)
      this.previews.set(key, { gen, tone, gain, send })
    } else {
      spawnEvent(ctx, track.type, tone, now + 0.01, midi)
      gain.gain.setValueAtTime(track.level, now)
      this.previews.set(key, { gen: null, tone, gain, send })
      window.setTimeout(() => this.noteOff(key), 2800)
    }
  }

  noteOff(key: string) {
    const p = this.previews.get(key)
    if (!p || !this.ctx) return
    this.previews.delete(key)
    const now = this.ctx.currentTime
    if (p.gen) {
      p.gain.gain.cancelScheduledValues(now)
      p.gain.gain.setTargetAtTime(0, now, 0.18)
      const { gen, tone, gain, send } = p
      window.setTimeout(() => {
        gen.stop()
        try { tone.disconnect(); gain.disconnect(); send.disconnect() } catch { /* noop */ }
      }, 1000)
    } else {
      const { tone, gain, send } = p
      window.setTimeout(() => { try { tone.disconnect(); gain.disconnect(); send.disconnect() } catch { /* noop */ } }, 200)
    }
  }

  private killPreviews() {
    for (const key of [...this.previews.keys()]) this.noteOff(key)
  }

  stop() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null }
    this.running = false
    this.killPreviews()
    const ctx = this.ctx
    if (!ctx) return
    for (const n of this.nodes.values()) {
      n.gain.gain.cancelScheduledValues(ctx.currentTime)
      n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
    }
  }

  /** playhead position 0..1 across the scene loop, or -1 when stopped. */
  phase(): number {
    if (!this.running || !this.ctx) return -1
    const dt = this.ctx.currentTime - this.startTime
    if (dt < 0) return 0
    return (dt % this.dur) / this.dur
  }
}

export const ambientEngine = new AmbientEngine()
