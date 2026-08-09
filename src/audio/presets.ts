import type { Patch } from '../state/types'
import { defaultPatch } from '../state/types'

export interface SfxPreset {
  id: string
  name: string
  cat: 'UI' | 'MOVE' | 'COMBAT' | 'GAME' | 'SOLAR'
  build: (p: Patch) => void
}

/** Starting points, not finished sounds — every one is meant to be twisted. */
export const PRESETS: SfxPreset[] = [
  // ---------- UI ----------
  {
    id: 'ui-click', name: 'UI CLICK', cat: 'UI',
    build: (p) => {
      p.synth.transpose = 12
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.7, detune: 0 }
      p.synth.o2.level = 0
      p.synth.adsr = { a: 0.001, d: 0.05, s: 0, r: 0.03 }
      p.synth.penv = { start: 16, end: 0, time: 0.035, bend: 0.7 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 9000, res: 1.2 }
    },
  },
  {
    id: 'ui-confirm', name: 'UI CONFIRM', cat: 'UI',
    build: (p) => {
      p.synth.o1 = { wave: 'triangle', semi: 12, level: 0.8, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 24, level: 0.3, detune: 4 }
      p.synth.adsr = { a: 0.002, d: 0.14, s: 0, r: 0.09 }
      p.synth.penv = { start: 0, end: 7, time: 0.09, bend: 0.3 }
      p.fx.delay = { on: true, time: 0.11, feedback: 0.2, mix: 0.16 }
    },
  },
  {
    id: 'ui-error', name: 'UI ERROR', cat: 'UI',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.75, detune: 0 }
      p.synth.o2 = { wave: 'square', semi: -6, level: 0.5, detune: 8 }
      p.synth.adsr = { a: 0.003, d: 0.2, s: 0, r: 0.08 }
      p.synth.penv = { start: 0, end: -4, time: 0.16, bend: 0 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 3400, res: 2 }
      p.fx.dist = { on: true, drive: 24, mix: 0.4 }
    },
  },
  {
    id: 'menu-hover', name: 'MENU HOVER', cat: 'UI',
    build: (p) => {
      p.synth.transpose = 19
      p.synth.o1 = { wave: 'sine', semi: 0, level: 0.6, detune: 0 }
      p.synth.o2.level = 0
      p.synth.adsr = { a: 0.002, d: 0.06, s: 0, r: 0.05 }
      p.synth.penv = { start: 4, end: 0, time: 0.05, bend: 0.4 }
    },
  },
  {
    id: 'menu-open', name: 'MENU OPEN', cat: 'UI',
    build: (p) => {
      p.synth.o1 = { wave: 'triangle', semi: 7, level: 0.7, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 19, level: 0.25, detune: 0 }
      p.synth.adsr = { a: 0.01, d: 0.22, s: 0, r: 0.16 }
      p.synth.penv = { start: -12, end: 0, time: 0.13, bend: 0.35 }
      p.fx.chorus = { on: true, rate: 1.6, depth: 0.4, mix: 0.35 }
    },
  },
  {
    id: 'menu-close', name: 'MENU CLOSE', cat: 'UI',
    build: (p) => {
      p.synth.o1 = { wave: 'triangle', semi: 7, level: 0.7, detune: 0 }
      p.synth.o2.level = 0
      p.synth.adsr = { a: 0.004, d: 0.18, s: 0, r: 0.1 }
      p.synth.penv = { start: 0, end: -12, time: 0.15, bend: 0.3 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 7000, res: 0.8 }
    },
  },

  // ---------- MOVEMENT ----------
  {
    id: 'jump', name: 'JUMP', cat: 'MOVE',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.75, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: -12, level: 0.35, detune: 0 }
      p.synth.adsr = { a: 0.002, d: 0.18, s: 0, r: 0.07 }
      p.synth.penv = { start: -5, end: 10, time: 0.15, bend: 0.35 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 6200, res: 1.6 }
    },
  },
  {
    id: 'dash', name: 'DASH', cat: 'MOVE',
    build: (p) => {
      p.synth.o1 = { wave: 'sawtooth', semi: 0, level: 0.3, detune: 0 }
      p.synth.o2.level = 0
      p.synth.noise = 0.65
      p.synth.adsr = { a: 0.01, d: 0.24, s: 0, r: 0.1 }
      p.synth.penv = { start: 7, end: -4, time: 0.22, bend: 0.4 }
      p.fx.filter = { on: true, type: 'bandpass', cutoff: 1800, res: 3 }
      p.fx.chorus = { on: true, rate: 3, depth: 0.5, mix: 0.4 }
    },
  },
  {
    id: 'land', name: 'LAND', cat: 'MOVE',
    build: (p) => {
      p.synth.o1 = { wave: 'sine', semi: -12, level: 0.9, detune: 0 }
      p.synth.o2.level = 0
      p.synth.noise = 0.3
      p.synth.adsr = { a: 0.001, d: 0.13, s: 0, r: 0.06 }
      p.synth.penv = { start: 2, end: -12, time: 0.1, bend: 0.5 }
      p.fx.dist = { on: true, drive: 16, mix: 0.3 }
      p.fx.eq = { on: true, low: 5, mid: 0, high: -2 }
    },
  },
  {
    id: 'whoosh', name: 'WHOOSH', cat: 'MOVE',
    build: (p) => {
      p.synth.o1.level = 0
      p.synth.o2.level = 0
      p.synth.noise = 1
      p.synth.adsr = { a: 0.05, d: 0.32, s: 0, r: 0.14 }
      p.synth.penv = { start: 22, end: -14, time: 0.3, bend: 0.25 }
      p.fx.filter = { on: true, type: 'bandpass', cutoff: 950, res: 2.4 }
      p.fx.reverb = { on: true, size: 0.25, decay: 0.4, mix: 0.2 }
    },
  },
  {
    id: 'slide', name: 'SLIDE', cat: 'MOVE',
    build: (p) => {
      p.synth.o1.level = 0
      p.synth.o2.level = 0
      p.synth.noise = 0.55
      p.synth.adsr = { a: 0.03, d: 0.3, s: 0.35, r: 0.2 }
      p.synth.penv = { start: 0, end: -6, time: 0.5, bend: 0.1 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 2400, res: 1.2 }
      p.fx.chorus = { on: true, rate: 0.8, depth: 0.5, mix: 0.45 }
    },
  },

  // ---------- COMBAT ----------
  {
    id: 'laser', name: 'LASER', cat: 'COMBAT',
    build: (p) => {
      p.synth.o1 = { wave: 'sawtooth', semi: 12, level: 0.8, detune: 0 }
      p.synth.o2 = { wave: 'square', semi: 24, level: 0.3, detune: 10 }
      p.synth.adsr = { a: 0.001, d: 0.16, s: 0, r: 0.06 }
      p.synth.penv = { start: 26, end: -8, time: 0.17, bend: 0.65 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 12000, res: 3.5 }
      p.fx.dist = { on: true, drive: 34, mix: 0.45 }
    },
  },
  {
    id: 'impact', name: 'IMPACT', cat: 'COMBAT',
    build: (p) => {
      p.synth.o1 = { wave: 'sine', semi: -24, level: 1, detune: 0 }
      p.synth.o2.level = 0
      p.synth.noise = 0.5
      p.synth.adsr = { a: 0.001, d: 0.16, s: 0, r: 0.09 }
      p.synth.penv = { start: 4, end: -16, time: 0.09, bend: 0.6 }
      p.fx.dist = { on: true, drive: 42, mix: 0.5 }
      p.fx.eq = { on: true, low: 7, mid: -2, high: 0 }
    },
  },
  {
    id: 'hit', name: 'HIT', cat: 'COMBAT',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.8, detune: 0 }
      p.synth.o2.level = 0
      p.synth.noise = 0.35
      p.synth.adsr = { a: 0.001, d: 0.07, s: 0, r: 0.04 }
      p.synth.penv = { start: 5, end: -7, time: 0.06, bend: 0.5 }
      p.fx.crush = { on: true, bits: 6, rate: 6, mix: 0.5 }
    },
  },
  {
    id: 'charge', name: 'CHARGE', cat: 'COMBAT',
    build: (p) => {
      p.synth.o1 = { wave: 'sawtooth', semi: 0, level: 0.7, detune: 0 }
      p.synth.o2 = { wave: 'sawtooth', semi: 0, level: 0.5, detune: 14 }
      p.synth.adsr = { a: 0.3, d: 0.25, s: 0.75, r: 0.25 }
      p.synth.penv = { start: -24, end: 12, time: 0.85, bend: 0.15 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 7500, res: 2.4 }
      p.fx.chorus = { on: true, rate: 2.4, depth: 0.35, mix: 0.3 }
    },
  },
  {
    id: 'explosion', name: 'EXPLOSION', cat: 'COMBAT',
    build: (p) => {
      p.synth.o1 = { wave: 'sine', semi: -24, level: 0.7, detune: 0 }
      p.synth.o2.level = 0
      p.synth.noise = 1
      p.synth.adsr = { a: 0.002, d: 0.55, s: 0, r: 0.35 }
      p.synth.penv = { start: -2, end: -20, time: 0.5, bend: 0.3 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 5200, res: 0.9 }
      p.fx.dist = { on: true, drive: 55, mix: 0.6 }
      p.fx.reverb = { on: true, size: 0.55, decay: 0.6, mix: 0.4 }
    },
  },

  // ---------- GAMEPLAY ----------
  {
    id: 'pickup', name: 'PICKUP', cat: 'GAME',
    build: (p) => {
      p.synth.o1 = { wave: 'triangle', semi: 12, level: 0.8, detune: 0 }
      p.synth.o2.level = 0
      p.synth.adsr = { a: 0.001, d: 0.11, s: 0, r: 0.07 }
      p.synth.penv = { start: 0, end: 12, time: 0.09, bend: 0.5 }
      p.fx.delay = { on: true, time: 0.12, feedback: 0.24, mix: 0.18 }
    },
  },
  {
    id: 'coin', name: 'COIN', cat: 'GAME',
    build: (p) => {
      p.synth.transpose = 12
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.6, detune: 0 }
      p.synth.o2 = { wave: 'square', semi: 5, level: 0.45, detune: 0 }
      p.synth.adsr = { a: 0.001, d: 0.28, s: 0, r: 0.12 }
      p.synth.penv = { start: 0, end: 5, time: 0.045, bend: 0.95 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 10500, res: 1 }
    },
  },
  {
    id: 'powerup', name: 'POWERUP', cat: 'GAME',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.7, detune: 0 }
      p.synth.o2 = { wave: 'triangle', semi: 12, level: 0.4, detune: 6 }
      p.synth.adsr = { a: 0.01, d: 0.45, s: 0.2, r: 0.25 }
      p.synth.penv = { start: -12, end: 12, time: 0.5, bend: 0.15 }
      p.fx.chorus = { on: true, rate: 2, depth: 0.4, mix: 0.35 }
      p.fx.delay = { on: true, time: 0.16, feedback: 0.3, mix: 0.22 }
    },
  },
  {
    id: 'level-up', name: 'LEVEL UP', cat: 'GAME',
    build: (p) => {
      p.synth.o1 = { wave: 'triangle', semi: 0, level: 0.8, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 7, level: 0.5, detune: 0 }
      p.synth.adsr = { a: 0.005, d: 0.5, s: 0.15, r: 0.5 }
      p.synth.penv = { start: 0, end: 19, time: 0.4, bend: 0.25 }
      p.fx.reverb = { on: true, size: 0.4, decay: 0.5, mix: 0.3 }
      p.fx.delay = { on: true, time: 0.22, feedback: 0.35, mix: 0.25 }
    },
  },
  {
    id: 'achievement', name: 'ACHIEVEMENT', cat: 'GAME',
    build: (p) => {
      p.synth.o1 = { wave: 'sine', semi: 0, level: 0.8, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 12, level: 0.5, detune: 3 }
      p.synth.adsr = { a: 0.01, d: 0.55, s: 0.25, r: 0.6 }
      p.synth.penv = { start: 0, end: 7, time: 0.3, bend: 0.4 }
      p.fx.reverb = { on: true, size: 0.55, decay: 0.55, mix: 0.35 }
      p.fx.chorus = { on: true, rate: 1.1, depth: 0.35, mix: 0.3 }
    },
  },

  // ---------- SOLAR ----------
  {
    id: 'solar-charge', name: 'SOLAR CHARGE', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1 = { wave: 'sawtooth', semi: 0, level: 0.45, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 12, level: 0.5, detune: 5 }
      p.synth.adsr = { a: 0.12, d: 0.3, s: 0.6, r: 0.4 }
      p.synth.penv = { start: -7, end: 14, time: 0.7, bend: 0.25 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 8200, res: 2 }
      p.fx.chorus = { on: true, rate: 1.4, depth: 0.5, mix: 0.4 }
    },
  },
  {
    id: 'energy-pulse', name: 'ENERGY PULSE', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: 0, level: 0.75, detune: 0 }
      p.synth.o2.level = 0
      p.synth.adsr = { a: 0.002, d: 0.09, s: 0, r: 0.06 }
      p.synth.penv = { start: 2, end: -2, time: 0.08, bend: 0 }
      p.fx.delay = { on: true, time: 0.16, feedback: 0.45, mix: 0.38 }
      p.fx.crush = { on: true, bits: 8, rate: 3, mix: 0.3 }
    },
  },
  {
    id: 'eco-machine', name: 'ECO MACHINE', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1 = { wave: 'square', semi: -12, level: 0.6, detune: 0 }
      p.synth.o2 = { wave: 'triangle', semi: -5, level: 0.4, detune: 8 }
      p.synth.adsr = { a: 0.004, d: 0.1, s: 0.3, r: 0.08 }
      p.synth.penv = { start: 0, end: 0, time: 0.1, bend: 0 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 3600, res: 2.2 }
      p.fx.delay = { on: true, time: 0.19, feedback: 0.4, mix: 0.3 }
      p.seq.patterns[p.seq.pattern] = [
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      ]
    },
  },
  {
    id: 'plant-growth', name: 'PLANT GROWTH', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1 = { wave: 'sine', semi: 0, level: 0.8, detune: 0 }
      p.synth.o2 = { wave: 'sine', semi: 16, level: 0.3, detune: 7 }
      p.synth.adsr = { a: 0.2, d: 0.6, s: 0.4, r: 0.8 }
      p.synth.penv = { start: -5, end: 3, time: 0.9, bend: 0.2 }
      p.fx.reverb = { on: true, size: 0.5, decay: 0.6, mix: 0.4 }
      p.fx.chorus = { on: true, rate: 0.7, depth: 0.5, mix: 0.4 }
    },
  },
  {
    id: 'wind-burst', name: 'WIND BURST', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1.level = 0
      p.synth.o2.level = 0
      p.synth.noise = 0.9
      p.synth.adsr = { a: 0.06, d: 0.5, s: 0, r: 0.25 }
      p.synth.penv = { start: 10, end: -16, time: 0.5, bend: 0.2 }
      p.fx.filter = { on: true, type: 'bandpass', cutoff: 1250, res: 1.4 }
      p.fx.reverb = { on: true, size: 0.35, decay: 0.5, mix: 0.3 }
    },
  },
  {
    id: 'solar-beam', name: 'SOLAR BEAM', cat: 'SOLAR',
    build: (p) => {
      p.synth.o1 = { wave: 'sawtooth', semi: 0, level: 0.7, detune: 0 }
      p.synth.o2 = { wave: 'sawtooth', semi: 12, level: 0.45, detune: 12 }
      p.synth.adsr = { a: 0.004, d: 0.3, s: 0.5, r: 0.2 }
      p.synth.penv = { start: 24, end: 0, time: 0.28, bend: 0.55 }
      p.fx.filter = { on: true, type: 'lowpass', cutoff: 9200, res: 3 }
      p.fx.dist = { on: true, drive: 28, mix: 0.35 }
      p.fx.delay = { on: true, time: 0.2, feedback: 0.3, mix: 0.22 }
    },
  },
]

export function buildPreset(id: string): Patch | null {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) return null
  const patch = defaultPatch()
  patch.soundSource = 'synth'
  preset.build(patch)
  return patch
}
