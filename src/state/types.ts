export type Mode = 'ambient' | 'sample' | 'synth' | 'keys' | 'fx' | 'seq' | 'export'
export type SoundSource = 'synth' | 'sample'
export type OscWave = 'sine' | 'triangle' | 'sawtooth' | 'square'
export type SynthTab = 'main' | 'osc' | 'env' | 'pitch'
export type FxId = 'filter' | 'dist' | 'crush' | 'chorus' | 'delay' | 'reverb' | 'eq'
export type SeqRate = 4 | 8 | 16 | 32

export interface OscParams {
  wave: OscWave
  semi: number // -24..24 semitones
  level: number // 0..1
  detune: number // cents -50..50
}

export interface AdsrParams {
  a: number // seconds
  d: number
  s: number // 0..1
  r: number
}

export interface PitchEnvParams {
  start: number // semitone offset at note start, -48..48
  end: number // semitone offset at env end
  time: number // seconds 0.01..2
  bend: number // 0..1 curve amount (0 = linear, 1 = very exponential)
}

export interface SynthParams {
  transpose: number // -24..24 master semitones
  o1: OscParams
  o2: OscParams
  noise: number // 0..1
  adsr: AdsrParams
  penv: PitchEnvParams
}

export interface SamplerParams {
  start: number // fraction 0..1
  end: number // fraction 0..1
  pitch: number // semitones -24..24
  speed: number // 0.25..4
  reverse: boolean
  fadeIn: number // seconds
  fadeOut: number // seconds
  gain: number // 0..2
  loop: boolean
}

export interface FxParams {
  filter: { on: boolean; type: 'lowpass' | 'highpass' | 'bandpass'; cutoff: number; res: number }
  dist: { on: boolean; drive: number; mix: number } // drive 0..100
  crush: { on: boolean; bits: number; rate: number; mix: number } // bits 1..16, rate 1..40
  chorus: { on: boolean; rate: number; depth: number; mix: number }
  delay: { on: boolean; time: number; feedback: number; mix: number }
  reverb: { on: boolean; size: number; decay: number; mix: number } // size 0..1, decay 0..1
  eq: { on: boolean; low: number; mid: number; high: number } // dB -18..18
}

export interface SeqParams {
  patterns: number[][][] // [pattern][row][step] 0|1
  offsets: number[] // per-row semitone offsets
  pattern: number // active pattern 0..3
  length: number // 1..16
  swing: number // 0..0.75
  gate: number // 0.05..1 fraction of step
  rate: SeqRate // steps per bar denominator
  root: number // midi root note
}

export interface ExportSettings {
  name: string
  rate: 44100 | 48000
  depth: 16 | 24
  channels: 1 | 2
  normalize: boolean
  source: 'sound' | 'seq'
}

/** Everything that defines the current sound — snapshotted for undo / A-B. */
export interface Patch {
  soundSource: SoundSource
  synth: SynthParams
  sampler: SamplerParams
  fx: FxParams
  seq: SeqParams
  sampleName: string
}

export interface Snapshot {
  patch: Patch
  buffer: AudioBuffer | null
}

export const defaultSynth = (): SynthParams => ({
  transpose: 0,
  o1: { wave: 'triangle', semi: 0, level: 0.8, detune: 0 },
  o2: { wave: 'sine', semi: -12, level: 0.35, detune: 6 },
  noise: 0,
  adsr: { a: 0.005, d: 0.22, s: 0.25, r: 0.18 },
  penv: { start: 0, end: 0, time: 0.18, bend: 0.5 },
})

export const defaultSampler = (): SamplerParams => ({
  start: 0,
  end: 1,
  pitch: 0,
  speed: 1,
  reverse: false,
  fadeIn: 0.002,
  fadeOut: 0.01,
  gain: 1,
  loop: false,
})

export const defaultFx = (): FxParams => ({
  filter: { on: true, type: 'lowpass', cutoff: 18500, res: 0.7 },
  dist: { on: false, drive: 20, mix: 0.5 },
  crush: { on: false, bits: 8, rate: 4, mix: 0.6 },
  chorus: { on: false, rate: 1.2, depth: 0.35, mix: 0.4 },
  delay: { on: false, time: 0.22, feedback: 0.32, mix: 0.25 },
  reverb: { on: false, size: 0.4, decay: 0.5, mix: 0.3 },
  eq: { on: false, low: 0, mid: 0, high: 0 },
})

const emptyPattern = () => Array.from({ length: 4 }, () => Array(16).fill(0) as number[])

export const defaultSeq = (): SeqParams => ({
  patterns: Array.from({ length: 4 }, emptyPattern),
  offsets: [12, 7, 0, -12],
  pattern: 0,
  length: 16,
  swing: 0,
  gate: 0.5,
  rate: 16,
  root: 60,
})

export const defaultPatch = (): Patch => ({
  soundSource: 'synth',
  synth: defaultSynth(),
  sampler: defaultSampler(),
  fx: defaultFx(),
  seq: defaultSeq(),
  sampleName: '',
})

export const clonePatch = (p: Patch): Patch => JSON.parse(JSON.stringify(p)) as Patch
