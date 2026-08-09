import { useStore } from '../state/store'
import type { KnobSpec } from './Knob'
import { Knob } from './Knob'
import { fmtHz, fmtPct, fmtSecs } from '../utils/misc'
import { midiName } from '../utils/notes'

const C = ['#f5c543', '#3e9be0', '#56be68', '#ee5a2c']

const BLANK: Omit<KnobSpec, 'onChange'> & { onChange: (v: number) => void } = {
  label: '--',
  color: '#3a3a36',
  value: 0,
  min: 0,
  max: 1,
  onChange: () => undefined,
  disabled: true,
}

export function KnobRow() {
  const st = useStore()
  const { mutatePatch, beginGesture, endGesture } = st
  const p = st.patch

  const patchKnob = (
    label: string,
    idx: number,
    value: number,
    min: number,
    max: number,
    write: (patch: typeof p, v: number) => void,
    extra?: Partial<KnobSpec>,
  ): KnobSpec => ({
    label,
    color: C[idx],
    value,
    min,
    max,
    onChange: (v) => mutatePatch((pp) => write(pp, v)),
    ...extra,
  })

  let knobs: KnobSpec[]

  if (st.mode === 'sample') {
    knobs = [
      patchKnob('START', 0, p.sampler.start, 0, 1, (pp, v) => { pp.sampler.start = Math.min(v, pp.sampler.end - 0.001) }, { format: (v) => `${(v * 100).toFixed(1)}%`, defaultValue: 0 }),
      patchKnob('END', 1, p.sampler.end, 0, 1, (pp, v) => { pp.sampler.end = Math.max(v, pp.sampler.start + 0.001) }, { format: (v) => `${(v * 100).toFixed(1)}%`, defaultValue: 1 }),
      patchKnob('PITCH', 2, p.sampler.pitch, -24, 24, (pp, v) => { pp.sampler.pitch = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: 0 }),
      patchKnob('SPEED', 3, p.sampler.speed, 0.25, 4, (pp, v) => { pp.sampler.speed = v }, { exp: true, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1 }),
    ]
  } else if (st.mode === 'synth' || st.mode === 'keys') {
    const tab = st.mode === 'keys' ? 'main' : st.synthTab
    if (tab === 'osc') {
      knobs = [
        patchKnob('O1 LVL', 0, p.synth.o1.level, 0, 1, (pp, v) => { pp.synth.o1.level = v }, { format: fmtPct, defaultValue: 0.8 }),
        patchKnob('O1 SEMI', 1, p.synth.o1.semi, -24, 24, (pp, v) => { pp.synth.o1.semi = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: 0 }),
        patchKnob('O2 LVL', 2, p.synth.o2.level, 0, 1, (pp, v) => { pp.synth.o2.level = v }, { format: fmtPct, defaultValue: 0.35 }),
        patchKnob('O2 SEMI', 3, p.synth.o2.semi, -24, 24, (pp, v) => { pp.synth.o2.semi = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: -12 }),
      ]
    } else if (tab === 'env') {
      knobs = [
        patchKnob('ATTACK', 0, p.synth.adsr.a, 0.001, 1.5, (pp, v) => { pp.synth.adsr.a = v }, { exp: true, format: fmtSecs, defaultValue: 0.005 }),
        patchKnob('DECAY', 1, p.synth.adsr.d, 0.005, 1.5, (pp, v) => { pp.synth.adsr.d = v }, { exp: true, format: fmtSecs, defaultValue: 0.22 }),
        patchKnob('SUSTAIN', 2, p.synth.adsr.s, 0, 1, (pp, v) => { pp.synth.adsr.s = v }, { format: fmtPct, defaultValue: 0.25 }),
        patchKnob('RELEASE', 3, p.synth.adsr.r, 0.008, 2, (pp, v) => { pp.synth.adsr.r = v }, { exp: true, format: fmtSecs, defaultValue: 0.18 }),
      ]
    } else if (tab === 'pitch') {
      knobs = [
        patchKnob('P.START', 0, p.synth.penv.start, -36, 36, (pp, v) => { pp.synth.penv.start = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: 0 }),
        patchKnob('P.END', 1, p.synth.penv.end, -36, 36, (pp, v) => { pp.synth.penv.end = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: 0 }),
        patchKnob('P.TIME', 2, p.synth.penv.time, 0.01, 2, (pp, v) => { pp.synth.penv.time = v }, { exp: true, format: fmtSecs, defaultValue: 0.18 }),
        patchKnob('BEND', 3, p.synth.penv.bend, 0, 1, (pp, v) => { pp.synth.penv.bend = v }, { format: fmtPct, defaultValue: 0.5 }),
      ]
    } else {
      knobs = [
        patchKnob('PITCH', 0, p.synth.transpose, -24, 24, (pp, v) => { pp.synth.transpose = v }, { step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}st`, defaultValue: 0 }),
        patchKnob('DECAY', 1, p.synth.adsr.d, 0.005, 1.5, (pp, v) => { pp.synth.adsr.d = v }, { exp: true, format: fmtSecs, defaultValue: 0.22 }),
        patchKnob('FILTER', 2, p.fx.filter.cutoff, 40, 20000, (pp, v) => { pp.fx.filter.cutoff = v; pp.fx.filter.on = true }, { exp: true, format: fmtHz, defaultValue: 18500 }),
        patchKnob('NOISE', 3, p.synth.noise, 0, 1, (pp, v) => { pp.synth.noise = v }, { format: fmtPct, defaultValue: 0 }),
      ]
    }
  } else if (st.mode === 'fx') {
    const id = st.selectedFx
    if (id === 'filter') {
      const typeIdx = ['lowpass', 'highpass', 'bandpass'].indexOf(p.fx.filter.type)
      knobs = [
        patchKnob('CUTOFF', 0, p.fx.filter.cutoff, 40, 20000, (pp, v) => { pp.fx.filter.cutoff = v }, { exp: true, format: fmtHz, defaultValue: 18500 }),
        patchKnob('RES', 1, p.fx.filter.res, 0.05, 12, (pp, v) => { pp.fx.filter.res = v }, { exp: true, format: (v) => v.toFixed(2), defaultValue: 0.7 }),
        patchKnob('TYPE', 2, typeIdx < 0 ? 0 : typeIdx, 0, 2, (pp, v) => { pp.fx.filter.type = (['lowpass', 'highpass', 'bandpass'] as const)[Math.round(v)] }, { step: 1, options: ['LP', 'HP', 'BP'] }),
        BLANK,
      ]
    } else if (id === 'dist') {
      knobs = [
        patchKnob('DRIVE', 0, p.fx.dist.drive, 0, 100, (pp, v) => { pp.fx.dist.drive = v }, { step: 1, format: (v) => String(Math.round(v)), defaultValue: 20 }),
        patchKnob('MIX', 1, p.fx.dist.mix, 0, 1, (pp, v) => { pp.fx.dist.mix = v }, { format: fmtPct, defaultValue: 0.5 }),
        BLANK,
        BLANK,
      ]
    } else if (id === 'crush') {
      knobs = [
        patchKnob('BITS', 0, p.fx.crush.bits, 1, 16, (pp, v) => { pp.fx.crush.bits = v }, { step: 1, format: (v) => `${Math.round(v)}bit`, defaultValue: 8 }),
        patchKnob('DOWN', 1, p.fx.crush.rate, 1, 40, (pp, v) => { pp.fx.crush.rate = v }, { step: 1, format: (v) => `÷${Math.round(v)}`, defaultValue: 4 }),
        patchKnob('MIX', 2, p.fx.crush.mix, 0, 1, (pp, v) => { pp.fx.crush.mix = v }, { format: fmtPct, defaultValue: 0.6 }),
        BLANK,
      ]
    } else if (id === 'chorus') {
      knobs = [
        patchKnob('RATE', 0, p.fx.chorus.rate, 0.05, 8, (pp, v) => { pp.fx.chorus.rate = v }, { exp: true, format: (v) => `${v.toFixed(2)}Hz`, defaultValue: 1.2 }),
        patchKnob('DEPTH', 1, p.fx.chorus.depth, 0, 1, (pp, v) => { pp.fx.chorus.depth = v }, { format: fmtPct, defaultValue: 0.35 }),
        patchKnob('MIX', 2, p.fx.chorus.mix, 0, 1, (pp, v) => { pp.fx.chorus.mix = v }, { format: fmtPct, defaultValue: 0.4 }),
        BLANK,
      ]
    } else if (id === 'delay') {
      knobs = [
        patchKnob('TIME', 0, p.fx.delay.time, 0.02, 1.2, (pp, v) => { pp.fx.delay.time = v }, { exp: true, format: fmtSecs, defaultValue: 0.22 }),
        patchKnob('FEEDBK', 1, p.fx.delay.feedback, 0, 0.92, (pp, v) => { pp.fx.delay.feedback = v }, { format: fmtPct, defaultValue: 0.32 }),
        patchKnob('MIX', 2, p.fx.delay.mix, 0, 1, (pp, v) => { pp.fx.delay.mix = v }, { format: fmtPct, defaultValue: 0.25 }),
        BLANK,
      ]
    } else if (id === 'reverb') {
      knobs = [
        patchKnob('SIZE', 0, p.fx.reverb.size, 0, 1, (pp, v) => { pp.fx.reverb.size = v }, { format: fmtPct, defaultValue: 0.4 }),
        patchKnob('DECAY', 1, p.fx.reverb.decay, 0, 1, (pp, v) => { pp.fx.reverb.decay = v }, { format: fmtPct, defaultValue: 0.5 }),
        patchKnob('MIX', 2, p.fx.reverb.mix, 0, 1, (pp, v) => { pp.fx.reverb.mix = v }, { format: fmtPct, defaultValue: 0.3 }),
        BLANK,
      ]
    } else {
      knobs = [
        patchKnob('LOW', 0, p.fx.eq.low, -18, 18, (pp, v) => { pp.fx.eq.low = v }, { step: 0.5, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`, defaultValue: 0 }),
        patchKnob('MID', 1, p.fx.eq.mid, -18, 18, (pp, v) => { pp.fx.eq.mid = v }, { step: 0.5, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`, defaultValue: 0 }),
        patchKnob('HIGH', 2, p.fx.eq.high, -18, 18, (pp, v) => { pp.fx.eq.high = v }, { step: 0.5, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`, defaultValue: 0 }),
        BLANK,
      ]
    }
  } else if (st.mode === 'seq') {
    const rateIdx = [4, 8, 16, 32].indexOf(p.seq.rate)
    knobs = [
      patchKnob('RATE', 0, rateIdx < 0 ? 2 : rateIdx, 0, 3, (pp, v) => { pp.seq.rate = ([4, 8, 16, 32] as const)[Math.round(v)] }, { step: 1, options: ['1/4', '1/8', '1/16', '1/32'] }),
      patchKnob('GATE', 1, p.seq.gate, 0.05, 1, (pp, v) => { pp.seq.gate = v }, { format: fmtPct, defaultValue: 0.5 }),
      patchKnob('SWING', 2, p.seq.swing, 0, 0.75, (pp, v) => { pp.seq.swing = v }, { format: fmtPct, defaultValue: 0 }),
      patchKnob('ROOT', 3, p.seq.root, 24, 96, (pp, v) => { pp.seq.root = v }, { step: 1, format: midiName, defaultValue: 60 }),
    ]
  } else {
    // export mode — the whole export ticket on knobs, hardware-style
    const es = st.exportSettings
    knobs = [
      {
        label: 'RATE', color: C[0], value: es.rate === 48000 ? 1 : 0, min: 0, max: 1, step: 1,
        options: ['44.1k', '48k'],
        onChange: (v) => st.setExportSettings({ rate: Math.round(v) === 1 ? 48000 : 44100 }),
      },
      {
        label: 'DEPTH', color: C[1], value: es.depth === 24 ? 1 : 0, min: 0, max: 1, step: 1,
        options: ['16bit', '24bit'],
        onChange: (v) => st.setExportSettings({ depth: Math.round(v) === 1 ? 24 : 16 }),
      },
      {
        label: 'CHAN', color: C[2], value: es.channels === 2 ? 1 : 0, min: 0, max: 1, step: 1,
        options: ['mono', 'stereo'],
        onChange: (v) => st.setExportSettings({ channels: Math.round(v) === 1 ? 2 : 1 }),
      },
      {
        label: 'NORM', color: C[3], value: es.normalize ? 1 : 0, min: 0, max: 1, step: 1,
        options: ['off', 'on'],
        onChange: (v) => st.setExportSettings({ normalize: Math.round(v) === 1 }),
      },
    ]
  }

  const isPatchMode = st.mode !== 'export'

  return (
    <div className="knob-deck">
      {knobs.map((k, i) => (
        <Knob
          key={`${st.mode}-${st.mode === 'synth' ? st.synthTab : ''}-${st.mode === 'fx' ? st.selectedFx : ''}-${i}`}
          {...k}
          onGestureStart={isPatchMode && !k.disabled ? beginGesture : undefined}
          onGestureEnd={isPatchMode && !k.disabled ? endGesture : undefined}
        />
      ))}
    </div>
  )
}
