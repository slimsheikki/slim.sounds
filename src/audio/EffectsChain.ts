import type { FxParams } from '../state/types'
import { ensureCrusher } from './context'

const TC = 0.016 // smoothing time constant for param changes

function setP(p: AudioParam, v: number, t: number, immediate: boolean) {
  if (immediate) {
    p.cancelScheduledValues(0)
    p.value = v
  } else {
    p.setTargetAtTime(v, t, TC)
  }
}

function distCurve(drive: number): Float32Array {
  const n = 1024
  const curve = new Float32Array(n)
  const k = 1 + drive / 6
  const norm = Math.tanh(k)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * k) / norm
  }
  return curve
}

/**
 * The master effects chain:
 * input → filter → distortion → bitcrusher → chorus → delay → reverb → EQ → output
 * Works on both live and offline contexts.
 */
export class EffectsChain {
  readonly input: GainNode
  readonly output: GainNode
  readonly ready: Promise<void>

  private ctx: BaseAudioContext
  private offline: boolean

  private filter: BiquadFilterNode
  private shaper: WaveShaperNode
  private distDry: GainNode
  private distWet: GainNode
  private distSum: GainNode
  private crusher: AudioWorkletNode | null = null
  private crushIn: GainNode
  private crushOut: GainNode
  private chDelay: DelayNode
  private chLfo: OscillatorNode
  private chLfoGain: GainNode
  private chDry: GainNode
  private chWet: GainNode
  private chSum: GainNode
  private dlNode: DelayNode
  private dlFb: GainNode
  private dlDry: GainNode
  private dlWet: GainNode
  private dlSum: GainNode
  private rvConv: ConvolverNode
  private rvDry: GainNode
  private rvWet: GainNode
  private rvSum: GainNode
  private eqLow: BiquadFilterNode
  private eqMid: BiquadFilterNode
  private eqHigh: BiquadFilterNode

  private lastDrive = -1
  private irKey = ''
  private irTimer: number | null = null

  constructor(ctx: BaseAudioContext, offline = false) {
    this.ctx = ctx
    this.offline = offline
    const g = () => ctx.createGain()

    this.input = g()
    this.output = g()

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 18500

    this.shaper = ctx.createWaveShaper()
    this.shaper.oversample = '4x'
    this.distDry = g()
    this.distWet = g()
    this.distSum = g()

    this.crushIn = g()
    this.crushOut = g()

    this.chDelay = ctx.createDelay(0.1)
    this.chDelay.delayTime.value = 0.018
    this.chLfo = ctx.createOscillator()
    this.chLfo.frequency.value = 1.2
    this.chLfoGain = g()
    this.chLfoGain.gain.value = 0
    this.chDry = g()
    this.chWet = g()
    this.chSum = g()

    this.dlNode = ctx.createDelay(2.5)
    this.dlFb = g()
    this.dlDry = g()
    this.dlWet = g()
    this.dlSum = g()

    this.rvConv = ctx.createConvolver()
    this.rvDry = g()
    this.rvWet = g()
    this.rvSum = g()

    this.eqLow = ctx.createBiquadFilter()
    this.eqLow.type = 'lowshelf'
    this.eqLow.frequency.value = 220
    this.eqMid = ctx.createBiquadFilter()
    this.eqMid.type = 'peaking'
    this.eqMid.frequency.value = 1100
    this.eqMid.Q.value = 0.8
    this.eqHigh = ctx.createBiquadFilter()
    this.eqHigh.type = 'highshelf'
    this.eqHigh.frequency.value = 4200

    // wiring
    this.input.connect(this.filter)
    this.filter.connect(this.distDry)
    this.filter.connect(this.shaper)
    this.shaper.connect(this.distWet)
    this.distDry.connect(this.distSum)
    this.distWet.connect(this.distSum)

    this.distSum.connect(this.crushIn)
    // crusher inserted async; fall back to straight wire
    this.crushIn.connect(this.crushOut)

    this.crushOut.connect(this.chDry)
    this.crushOut.connect(this.chDelay)
    this.chDelay.connect(this.chWet)
    this.chLfo.connect(this.chLfoGain)
    this.chLfoGain.connect(this.chDelay.delayTime)
    this.chLfo.start()
    this.chDry.connect(this.chSum)
    this.chWet.connect(this.chSum)

    this.chSum.connect(this.dlDry)
    this.chSum.connect(this.dlNode)
    this.dlNode.connect(this.dlFb)
    this.dlFb.connect(this.dlNode)
    this.dlNode.connect(this.dlWet)
    this.dlDry.connect(this.dlSum)
    this.dlWet.connect(this.dlSum)

    this.dlSum.connect(this.rvDry)
    this.dlSum.connect(this.rvConv)
    this.rvConv.connect(this.rvWet)
    this.rvDry.connect(this.rvSum)
    this.rvWet.connect(this.rvSum)

    this.rvSum.connect(this.eqLow)
    this.eqLow.connect(this.eqMid)
    this.eqMid.connect(this.eqHigh)
    this.eqHigh.connect(this.output)

    this.ready = ensureCrusher(ctx).then((ok) => {
      if (!ok) return
      try {
        this.crusher = new AudioWorkletNode(ctx, 'slim-crusher', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        })
        this.crushIn.disconnect()
        this.crushIn.connect(this.crusher)
        this.crusher.connect(this.crushOut)
      } catch {
        this.crusher = null
      }
    })
  }

  update(fx: FxParams, immediate = false) {
    const t = this.ctx.currentTime
    const im = immediate || this.offline

    // FILTER
    const f = fx.filter
    if (f.on) {
      this.filter.type = f.type
      setP(this.filter.frequency, f.cutoff, t, im)
      setP(this.filter.Q, f.res, t, im)
    } else {
      this.filter.type = 'lowpass'
      setP(this.filter.frequency, 20000, t, im)
      setP(this.filter.Q, 0.0001, t, im)
    }

    // DIST
    const d = fx.dist
    if (d.drive !== this.lastDrive) {
      this.shaper.curve = distCurve(d.drive)
      this.lastDrive = d.drive
    }
    const dmix = d.on ? d.mix : 0
    setP(this.distWet.gain, dmix, t, im)
    setP(this.distDry.gain, 1 - dmix, t, im)

    // CRUSH
    if (this.crusher) {
      const bits = this.crusher.parameters.get('bits')
      const red = this.crusher.parameters.get('reduction')
      const mix = this.crusher.parameters.get('mix')
      if (bits) setP(bits, fx.crush.bits, t, im)
      if (red) setP(red, fx.crush.rate, t, im)
      if (mix) setP(mix, fx.crush.on ? fx.crush.mix : 0, t, im)
    }

    // CHORUS
    const c = fx.chorus
    setP(this.chLfo.frequency, c.rate, t, im)
    setP(this.chLfoGain.gain, c.on ? c.depth * 0.008 : 0, t, im)
    const cmix = c.on ? c.mix : 0
    setP(this.chWet.gain, cmix, t, im)
    setP(this.chDry.gain, 1 - cmix * 0.5, t, im)

    // DELAY
    const dl = fx.delay
    setP(this.dlNode.delayTime, dl.time, t, im)
    setP(this.dlFb.gain, dl.on ? Math.min(0.92, dl.feedback) : 0, t, im)
    setP(this.dlWet.gain, dl.on ? dl.mix : 0, t, im)
    setP(this.dlDry.gain, 1, t, im)

    // REVERB
    const rv = fx.reverb
    const key = `${rv.size.toFixed(2)}|${rv.decay.toFixed(2)}`
    if (rv.on && key !== this.irKey) {
      this.irKey = key
      if (this.offline) {
        this.rvConv.buffer = this.makeIR(rv.size, rv.decay)
      } else {
        if (this.irTimer !== null) window.clearTimeout(this.irTimer)
        this.irTimer = window.setTimeout(() => {
          this.rvConv.buffer = this.makeIR(rv.size, rv.decay)
        }, 90)
      }
    }
    setP(this.rvWet.gain, rv.on ? rv.mix : 0, t, im)
    setP(this.rvDry.gain, 1, t, im)

    // EQ
    const eq = fx.eq
    setP(this.eqLow.gain, eq.on ? eq.low : 0, t, im)
    setP(this.eqMid.gain, eq.on ? eq.mid : 0, t, im)
    setP(this.eqHigh.gain, eq.on ? eq.high : 0, t, im)
  }

  private makeIR(size: number, decay: number): AudioBuffer {
    const dur = 0.18 + size * 3.4
    const len = Math.max(256, Math.floor(this.ctx.sampleRate * dur))
    const ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate)
    const tau = 0.04 + decay * dur * 0.45
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        const tSec = i / this.ctx.sampleRate
        d[i] = (Math.random() * 2 - 1) * Math.exp(-tSec / tau)
      }
      // soft early attack so it doesn't click
      const ramp = Math.min(len, Math.floor(this.ctx.sampleRate * 0.004))
      for (let i = 0; i < ramp; i++) d[i] *= i / ramp
    }
    return ir
  }

  /** Extra seconds of tail this chain needs after the source stops. */
  static tailSeconds(fx: FxParams): number {
    let tail = 0.25
    if (fx.delay.on && fx.delay.mix > 0.01) {
      const fb = Math.min(0.9, fx.delay.feedback)
      tail = Math.max(tail, Math.min(5, fx.delay.time * (1 + 3 * fb) + 0.4))
    }
    if (fx.reverb.on && fx.reverb.mix > 0.01) tail = Math.max(tail, 0.3 + fx.reverb.size * 3.4)
    return tail
  }
}
