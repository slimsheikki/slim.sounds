import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  clonePatch,
  defaultPatch,
  type ExportSettings,
  type FxId,
  type Mode,
  type Patch,
  type Snapshot,
  type SynthTab,
} from './types'
import { engine } from '../audio/Engine'
import { decodeAudioFile } from '../audio/Engine'
import { ambientEngine } from '../audio/AmbientEngine'
import { startRecording, type RecorderHandles } from '../audio/Recorder'
import { cropBuffer, normalizeBuffer } from '../audio/context'
import { renderCurrent } from '../audio/render'
import { renderScene } from '../audio/ambientRender'
import { encodeWav } from '../audio/WavEncoder'
import { buildPreset } from '../audio/presets'
import { useSceneStore } from './sceneStore'
import { clamp, downloadBlob, sanitizeFilename } from '../utils/misc'

const HISTORY_MAX = 64

interface AppState {
  mode: Mode
  synthTab: SynthTab
  selectedFx: FxId
  patch: Patch
  buffer: AudioBuffer | null
  bpm: number
  octave: number
  velocity: number
  volume: number
  playing: boolean
  seqPlaying: boolean
  scenePlaying: boolean
  recording: boolean
  recHandles: RecorderHandles | null
  exporting: boolean
  dragOver: boolean
  presetsOpen: boolean
  activePresetId: string | null
  toast: string | null
  held: number[]
  abSlot: 'A' | 'B'
  abSlots: { A: Snapshot | null; B: Snapshot | null }
  exportSettings: ExportSettings
  past: Snapshot[]
  future: Snapshot[]
  gesture: Snapshot | null
  keySelection: string | null
  shiftHeld: boolean

  // actions
  setMode: (m: Mode) => void
  setSynthTab: (t: SynthTab) => void
  setSelectedFx: (f: FxId) => void
  mutatePatch: (fn: (p: Patch) => void, withHistory?: boolean) => void
  snapshot: () => Snapshot
  pushHistory: () => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  applySnapshot: (s: Snapshot) => void
  switchAB: (slot: 'A' | 'B') => void
  copyAB: () => void
  applyPreset: (id: string) => void
  mutateSound: () => void
  setBpm: (bpm: number) => void
  setOctave: (o: number) => void
  setVelocity: (v: number) => void
  setVolume: (v: number) => void
  toggleLoop: () => void
  noteOn: (code: string, midi: number) => void
  noteOff: (code: string) => void
  play: () => void
  stop: () => void
  toggleSeqPlay: () => void
  toggleScenePlay: () => void
  exportScene: () => Promise<void>
  startRec: () => Promise<void>
  stopRec: (cancel?: boolean) => Promise<void>
  importFile: (file: File) => Promise<void>
  setBuffer: (buf: AudioBuffer | null, name: string) => void
  sampleOp: (op: 'crop' | 'normalize' | 'reverse' | 'clear') => void
  setExportSettings: (s: Partial<ExportSettings>) => void
  exportWav: () => Promise<void>
  setToast: (t: string | null) => void
  setDragOver: (d: boolean) => void
  setPresetsOpen: (o: boolean) => void
  setKeySelection: (c: string | null) => void
  setShiftHeld: (s: boolean) => void
  heldAdd: (midi: number) => void
  heldRemove: (midi: number) => void
}

let toastTimer: number | null = null

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    mode: 'ambient',
    synthTab: 'main',
    selectedFx: 'filter',
    patch: defaultPatch(),
    buffer: null,
    bpm: 120,
    octave: 4,
    velocity: 0.9,
    volume: 0.85,
    playing: false,
    seqPlaying: false,
    scenePlaying: false,
    recording: false,
    recHandles: null,
    exporting: false,
    dragOver: false,
    presetsOpen: false,
    activePresetId: null,
    toast: null,
    held: [],
    abSlot: 'A',
    abSlots: { A: null, B: null },
    exportSettings: { name: 'solar_sfx_01', rate: 48000, depth: 24, channels: 1, normalize: true, source: 'sound' },
    past: [],
    future: [],
    gesture: null,
    keySelection: null,
    shiftHeld: false,

    setMode: (m) => set({ mode: m, presetsOpen: false }),
    setSynthTab: (t) => set({ synthTab: t }),
    setSelectedFx: (f) => set({ selectedFx: f }),

    snapshot: () => ({ patch: clonePatch(get().patch), buffer: get().buffer }),

    mutatePatch: (fn, withHistory = false) => {
      if (withHistory) get().pushHistory()
      const p = clonePatch(get().patch)
      fn(p)
      set({ patch: p })
    },

    pushHistory: () => {
      const s = get().snapshot()
      set((st) => ({ past: [...st.past.slice(-HISTORY_MAX + 1), s], future: [] }))
    },

    beginGesture: () => {
      if (!get().gesture) set({ gesture: get().snapshot() })
    },

    endGesture: () => {
      const g = get().gesture
      if (g) {
        set((st) => ({ past: [...st.past.slice(-HISTORY_MAX + 1), g], future: [], gesture: null }))
      }
    },

    applySnapshot: (s) => {
      set({ patch: clonePatch(s.patch), buffer: s.buffer })
      engine.updateFx(s.patch.fx)
    },

    undo: () => {
      const { past, future } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      const cur = get().snapshot()
      set({ past: past.slice(0, -1), future: [...future, cur] })
      get().applySnapshot(prev)
    },

    redo: () => {
      const { past, future } = get()
      if (!future.length) return
      const next = future[future.length - 1]
      const cur = get().snapshot()
      set({ future: future.slice(0, -1), past: [...past, cur] })
      get().applySnapshot(next)
    },

    switchAB: (slot) => {
      const cur = get().abSlot
      if (slot === cur) return
      const slots = { ...get().abSlots, [cur]: get().snapshot() }
      const target = slots[slot]
      set({ abSlot: slot, abSlots: slots })
      if (target) get().applySnapshot(target)
      get().setToast(`SOUND ${slot}`)
    },

    copyAB: () => {
      const cur = get().abSlot
      const other = cur === 'A' ? 'B' : 'A'
      set({ abSlots: { ...get().abSlots, [other]: get().snapshot() } })
      get().setToast(`COPIED ${cur} → ${other}`)
    },

    applyPreset: (id) => {
      const p = buildPreset(id)
      if (!p) return
      get().pushHistory()
      set({ patch: p, activePresetId: id })
      engine.updateFx(p.fx)
      // instant preview
      engine.trigger(p, get().buffer, p.seq.root, 0.95, 0, 0.22)
    },

    mutateSound: () => {
      if (get().mode === 'ambient') {
        useSceneStore.getState().mutateScene()
        get().setToast('SCENE MUTATED')
        return
      }
      get().pushHistory()
      const st = get()
      const p = clonePatch(st.patch)
      const jitter = (cur: number, lo: number, hi: number, spread = 0.25) =>
        clamp(cur + (Math.random() * 2 - 1) * spread * (hi - lo), lo, hi)
      const maybe = (prob: number) => Math.random() < prob

      const target = st.mode === 'fx' ? 'fx' : p.soundSource === 'sample' && st.mode === 'sample' ? 'sample' : 'synth'

      if (target === 'sample') {
        const sp = p.sampler
        sp.pitch = Math.round(jitter(sp.pitch, -12, 12, 0.35))
        sp.speed = jitter(sp.speed, 0.4, 2.2, 0.3)
        if (maybe(0.3)) sp.reverse = !sp.reverse
        sp.start = jitter(sp.start, 0, Math.max(0, sp.end - 0.05), 0.12)
        sp.end = jitter(sp.end, Math.min(1, sp.start + 0.05), 1, 0.12)
      } else if (target === 'fx') {
        const fx = p.fx
        if (maybe(0.5)) fx.dist = { ...fx.dist, on: true, drive: jitter(fx.dist.drive, 0, 60, 0.3), mix: jitter(fx.dist.mix, 0.1, 0.8, 0.3) }
        if (maybe(0.4)) fx.delay = { ...fx.delay, on: maybe(0.8), time: jitter(fx.delay.time, 0.05, 0.6, 0.3), feedback: jitter(fx.delay.feedback, 0.1, 0.7, 0.3), mix: jitter(fx.delay.mix, 0.1, 0.5, 0.3) }
        if (maybe(0.4)) fx.reverb = { ...fx.reverb, on: maybe(0.7), size: jitter(fx.reverb.size, 0.1, 0.9, 0.3), mix: jitter(fx.reverb.mix, 0.1, 0.6, 0.3) }
        if (maybe(0.4)) fx.crush = { ...fx.crush, on: maybe(0.5), bits: Math.round(jitter(fx.crush.bits, 3, 12, 0.4)), rate: Math.round(jitter(fx.crush.rate, 1, 16, 0.4)), mix: jitter(fx.crush.mix, 0.2, 0.8, 0.3) }
        fx.filter = { ...fx.filter, cutoff: jitter(fx.filter.cutoff, 500, 16000, 0.3), res: jitter(fx.filter.res, 0.3, 6, 0.25) }
      } else {
        const sy = p.synth
        sy.o1.semi = Math.round(jitter(sy.o1.semi, -12, 12, 0.3))
        if (maybe(0.4)) sy.o1.wave = (['sine', 'triangle', 'sawtooth', 'square'] as const)[Math.floor(Math.random() * 4)]
        sy.o2.level = jitter(sy.o2.level, 0, 0.8, 0.35)
        sy.o2.semi = Math.round(jitter(sy.o2.semi, -24, 24, 0.3))
        sy.noise = clamp(jitter(sy.noise, 0, 0.7, 0.3), 0, 1)
        sy.adsr.d = jitter(sy.adsr.d, 0.05, 0.8, 0.35)
        sy.adsr.r = jitter(sy.adsr.r, 0.03, 0.6, 0.3)
        sy.penv.start = Math.round(jitter(sy.penv.start, -24, 26, 0.4))
        sy.penv.end = Math.round(jitter(sy.penv.end, -24, 14, 0.4))
        sy.penv.time = jitter(sy.penv.time, 0.03, 0.8, 0.35)
        sy.penv.bend = jitter(sy.penv.bend, 0, 1, 0.3)
        p.fx.filter.cutoff = jitter(p.fx.filter.cutoff, 500, 16000, 0.25)
        if (maybe(0.25)) p.fx.dist = { ...p.fx.dist, on: true, drive: jitter(p.fx.dist.drive, 5, 40, 0.4), mix: jitter(p.fx.dist.mix, 0.2, 0.6, 0.4) }
      }

      set({ patch: p, activePresetId: null })
      engine.updateFx(p.fx)
      engine.trigger(p, st.buffer, p.seq.root, 0.95, 0, 0.22)
    },

    setBpm: (bpm) => set({ bpm: clamp(Math.round(bpm), 40, 240) }),
    setOctave: (o) => set({ octave: clamp(Math.round(o), 1, 7) }),
    setVelocity: (v) => set({ velocity: clamp(v, 0.05, 1) }),
    setVolume: (v) => {
      set({ volume: clamp(v, 0, 1) })
      engine.setVolume(clamp(v, 0, 1))
    },

    toggleLoop: () => get().mutatePatch((p) => { p.sampler.loop = !p.sampler.loop }),

    noteOn: (code, midi) => {
      const st = get()
      engine.noteOn(code, st.patch, st.buffer, midi, st.velocity)
      st.heldAdd(midi)
    },

    noteOff: (code) => {
      engine.noteOffKey(code)
    },

    heldAdd: (midi) => set((st) => ({ held: st.held.includes(midi) ? st.held : [...st.held, midi] })),
    heldRemove: (midi) => set((st) => ({ held: st.held.filter((m) => m !== midi) })),

    play: () => {
      const st = get()
      if (st.mode === 'ambient') {
        st.toggleScenePlay()
        return
      }
      if (st.mode === 'seq') {
        st.toggleSeqPlay()
        return
      }
      const ok = engine.playCurrent(st.patch, st.buffer)
      if (ok) set({ playing: true })
      else if (st.patch.soundSource === 'sample') get().setToast('NO SAMPLE — RECORD OR DROP AUDIO')
    },

    stop: () => {
      engine.stopEverything()
      ambientEngine.stop()
      set({ playing: false, seqPlaying: false, scenePlaying: false, held: [] })
    },

    toggleScenePlay: () => {
      const st = get()
      if (st.scenePlaying) {
        ambientEngine.stop()
        set({ scenePlaying: false })
        return
      }
      const scene = useSceneStore.getState().scene
      if (!scene.tracks.length) {
        get().setToast('ADD A LAYER FIRST')
        return
      }
      ambientEngine.start(() => useSceneStore.getState().scene)
      set({ scenePlaying: true })
    },

    exportScene: async () => {
      const st = get()
      if (st.exporting) return
      const scene = useSceneStore.getState().scene
      if (!scene.tracks.length) {
        get().setToast('EMPTY SCENE — ADD LAYERS')
        return
      }
      set({ exporting: true })
      get().setToast('RENDERING LOOP…')
      try {
        const rendered = await renderScene(scene, st.exportSettings)
        if (!rendered) throw new Error('render failed')
        const blob = encodeWav(rendered, st.exportSettings.depth)
        const base = sanitizeFilename(scene.name || st.exportSettings.name)
        const fname = `${base}_loop.wav`
        downloadBlob(blob, fname)
        get().setToast(`EXPORTED ${fname.toUpperCase()} ☀`)
      } catch {
        get().setToast('EXPORT FAILED')
      } finally {
        set({ exporting: false })
      }
    },

    toggleSeqPlay: () => {
      const st = get()
      if (st.seqPlaying) {
        engine.stopSeq()
        set({ seqPlaying: false })
      } else {
        engine.startSeq(() => {
          const s = get()
          return { seq: s.patch.seq, bpm: s.bpm, patch: s.patch, buffer: s.buffer }
        })
        set({ seqPlaying: true })
      }
    },

    startRec: async () => {
      const st = get()
      if (st.recording) return
      try {
        const handles = await startRecording(30, () => void get().stopRec())
        set({ recording: true, recHandles: handles })
      } catch {
        get().setToast('MICROPHONE ACCESS DENIED')
      }
    },

    stopRec: async (cancel = false) => {
      const { recHandles } = get()
      if (!recHandles) return
      set({ recording: false, recHandles: null })
      if (cancel) {
        recHandles.cancel()
        return
      }
      const buf = await recHandles.stop()
      if (buf && buf.duration > 0.05) {
        get().pushHistory()
        get().setBuffer(buf, 'recording')
        set({ mode: 'sample' })
        get().setToast('CAPTURED — NOW TWIST IT')
      } else {
        get().setToast('NOTHING CAPTURED')
      }
    },

    importFile: async (file) => {
      try {
        const buf = await decodeAudioFile(file)
        get().pushHistory()
        const name = file.name.replace(/\.[^.]+$/, '')
        get().setBuffer(buf, name)
        set({ mode: 'sample' })
        get().setToast(`LOADED ${name.toUpperCase().slice(0, 24)}`)
      } catch {
        get().setToast('COULD NOT DECODE AUDIO')
      }
    },

    setBuffer: (buf, name) => {
      const p = clonePatch(get().patch)
      p.soundSource = buf ? 'sample' : 'synth'
      p.sampler.start = 0
      p.sampler.end = 1
      p.sampleName = buf ? name : ''
      set({ buffer: buf, patch: p, activePresetId: null })
    },

    sampleOp: (op) => {
      const st = get()
      if (op === 'clear') {
        get().pushHistory()
        get().setBuffer(null, '')
        get().setToast('SAMPLE CLEARED')
        return
      }
      if (!st.buffer) return
      if (op === 'reverse') {
        get().mutatePatch((p) => { p.sampler.reverse = !p.sampler.reverse }, true)
        return
      }
      get().pushHistory()
      if (op === 'crop') {
        const { start, end } = st.patch.sampler
        if (Math.abs(end - start) < 0.005) return
        const buf = cropBuffer(st.buffer, Math.min(start, end), Math.max(start, end))
        const p = clonePatch(get().patch)
        p.sampler.start = 0
        p.sampler.end = 1
        set({ buffer: buf, patch: p })
        get().setToast('CROPPED TO REGION')
      } else if (op === 'normalize') {
        set({ buffer: normalizeBuffer(st.buffer) })
        get().setToast('NORMALIZED')
      }
    },

    setExportSettings: (s) => set({ exportSettings: { ...get().exportSettings, ...s } }),

    exportWav: async () => {
      const st = get()
      if (st.exporting) return
      if (st.patch.soundSource === 'sample' && !st.buffer) {
        get().setToast('NO SAMPLE TO EXPORT')
        return
      }
      set({ exporting: true })
      try {
        const rendered = await renderCurrent(clonePatch(st.patch), st.buffer, st.exportSettings, st.bpm)
        if (!rendered) throw new Error('render failed')
        const blob = encodeWav(rendered, st.exportSettings.depth)
        const fname = `${sanitizeFilename(st.exportSettings.name)}.wav`
        downloadBlob(blob, fname)
        get().setToast(`EXPORTED ${fname.toUpperCase()} ☀`)
      } catch {
        get().setToast('EXPORT FAILED')
      } finally {
        set({ exporting: false })
      }
    },

    setToast: (t) => {
      if (toastTimer !== null) window.clearTimeout(toastTimer)
      set({ toast: t })
      if (t !== null) {
        toastTimer = window.setTimeout(() => set({ toast: null }), 2600)
      }
    },

    setDragOver: (d) => set({ dragOver: d }),
    setPresetsOpen: (o) => set({ presetsOpen: o }),
    setKeySelection: (c) => set({ keySelection: c }),
    setShiftHeld: (s) => set({ shiftHeld: s }),
  })),
)

/* keep the live FX chain + persistence in sync */
useStore.subscribe(
  (s) => s.patch.fx,
  (fx) => engine.updateFx(fx),
)

const PERSIST_KEY = 'slim.sounds.patch.v1'

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { patch?: Patch; bpm?: number; exportSettings?: ExportSettings }
    if (data.patch) {
      const base = defaultPatch()
      const merged: Patch = {
        ...base,
        ...data.patch,
        soundSource: 'synth', // audio buffers don't persist
        synth: { ...base.synth, ...data.patch.synth },
        sampler: { ...base.sampler, ...data.patch.sampler },
        fx: { ...base.fx, ...data.patch.fx },
        seq: { ...base.seq, ...data.patch.seq },
      }
      useStore.setState({ patch: merged })
    }
    if (data.bpm) useStore.setState({ bpm: data.bpm })
    if (data.exportSettings) {
      useStore.setState({ exportSettings: { ...useStore.getState().exportSettings, ...data.exportSettings } })
    }
  } catch {
    /* ignore corrupt persistence */
  }
}

let persistTimer: number | null = null
useStore.subscribe(
  (s) => [s.patch, s.bpm, s.exportSettings] as const,
  ([patch, bpm, exportSettings]) => {
    if (persistTimer !== null) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify({ patch, bpm, exportSettings }))
      } catch {
        /* storage full or unavailable */
      }
    }, 400)
  },
  { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] },
)
