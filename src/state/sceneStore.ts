import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  cloneScene,
  defaultScene,
  LAYER_DEFS,
  makeTrack,
  SCENE_MAX,
  SCENE_MIN,
  SCENE_PRESETS,
  type LayerType,
  type Scene,
  type Track,
} from './ambientTypes'
import { ambientEngine } from '../audio/AmbientEngine'
import { clamp } from '../utils/misc'

const HISTORY_MAX = 48
const MAX_TRACKS = 9

interface SceneState {
  scene: Scene
  selectedId: string | null
  past: Scene[]
  future: Scene[]
  gesture: Scene | null
  activePreset: string | null

  select: (id: string | null) => void
  pushHistory: () => void
  beginGesture: () => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  addTrack: (type: LayerType) => void
  removeTrack: (id: string) => void
  updateTrack: (id: string, patch: Partial<Track>) => void
  moveClip: (id: string, start: number) => void
  resizeClip: (id: string, start: number, len: number) => void
  toggleMute: (id: string) => void
  setDuration: (d: number) => void
  toggleLoop: () => void
  toggleLofi: () => void
  mutateScene: () => void
  applyScenePreset: (id: string) => void
  loadScene: (s: Scene) => void
}

const commit = (set: (p: Partial<SceneState>) => void, get: () => SceneState, scene: Scene) => {
  set({ scene })
  void get
}

export const useSceneStore = create<SceneState>()(
  subscribeWithSelector((set, get) => ({
    scene: defaultScene(),
    selectedId: null,
    past: [],
    future: [],
    gesture: null,
    activePreset: 'forest-dawn',

    select: (id) => set({ selectedId: id }),

    pushHistory: () => set((st) => ({ past: [...st.past.slice(-HISTORY_MAX + 1), cloneScene(st.scene)], future: [] })),

    beginGesture: () => { if (!get().gesture) set({ gesture: cloneScene(get().scene) }) },
    endGesture: () => {
      const g = get().gesture
      if (g) set((st) => ({ past: [...st.past.slice(-HISTORY_MAX + 1), g], future: [], gesture: null }))
    },

    undo: () => {
      const { past, scene } = get()
      if (!past.length) return
      set({ past: past.slice(0, -1), future: [...get().future, cloneScene(scene)], scene: past[past.length - 1], activePreset: null })
    },
    redo: () => {
      const { future, scene } = get()
      if (!future.length) return
      set({ future: future.slice(0, -1), past: [...get().past, cloneScene(scene)], scene: future[future.length - 1], activePreset: null })
    },

    addTrack: (type) => {
      const st = get()
      if (st.scene.tracks.length >= MAX_TRACKS) return
      st.pushHistory()
      const track = makeTrack(type, st.scene)
      const scene = { ...st.scene, tracks: [...st.scene.tracks, track] }
      set({ scene, selectedId: track.id, activePreset: null })
      ambientEngine.preview(track)
    },

    removeTrack: (id) => {
      const st = get()
      st.pushHistory()
      set({
        scene: { ...st.scene, tracks: st.scene.tracks.filter((t) => t.id !== id) },
        selectedId: st.selectedId === id ? null : st.selectedId,
        activePreset: null,
      })
    },

    updateTrack: (id, patch) => {
      const st = get()
      commit(set, get, {
        ...st.scene,
        tracks: st.scene.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })
    },

    moveClip: (id, start) => {
      const st = get()
      const dur = st.scene.duration
      set({
        scene: {
          ...st.scene,
          tracks: st.scene.tracks.map((t) => {
            if (t.id !== id) return t
            const len = Math.min(t.clip.len, dur)
            return { ...t, clip: { start: clamp(start, 0, dur - len), len } }
          }),
        },
      })
    },

    resizeClip: (id, start, len) => {
      const st = get()
      const dur = st.scene.duration
      set({
        scene: {
          ...st.scene,
          tracks: st.scene.tracks.map((t) => {
            if (t.id !== id) return t
            const s = clamp(start, 0, dur - 0.5)
            const l = clamp(len, 0.5, dur - s)
            return { ...t, clip: { start: s, len: l } }
          }),
        },
      })
    },

    toggleMute: (id) => {
      const st = get()
      st.pushHistory()
      set({ scene: { ...st.scene, tracks: st.scene.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)) } })
    },

    setDuration: (d) => {
      const st = get()
      const duration = clamp(Math.round(d), SCENE_MIN, SCENE_MAX)
      set({
        scene: {
          ...st.scene,
          duration,
          tracks: st.scene.tracks.map((t) => {
            const start = Math.min(t.clip.start, duration - 0.5)
            const len = Math.min(t.clip.len, duration - start)
            // keep full-scene clips full when the scene grows/shrinks
            const wasFull = t.clip.start <= 0.05 && t.clip.start + t.clip.len >= st.scene.duration - 0.05
            return wasFull ? { ...t, clip: { start: 0, len: duration } } : { ...t, clip: { start, len } }
          }),
        },
      })
    },

    toggleLoop: () => set((st) => ({ scene: { ...st.scene, loop: !st.scene.loop } })),
    toggleLofi: () => set((st) => ({ scene: { ...st.scene, lofi: !st.scene.lofi } })),

    mutateScene: () => {
      const st = get()
      st.pushHistory()
      const jitter = (v: number, spread = 0.28) => clamp(v + (Math.random() * 2 - 1) * spread, 0, 1)
      const maybe = (p: number) => Math.random() < p
      const tracks = st.scene.tracks.map((t) => {
        const nt: Track = { ...t, clip: { ...t.clip } }
        nt.tone = jitter(t.tone)
        nt.motion = jitter(t.motion, 0.32)
        nt.space = jitter(t.space, 0.3)
        if (maybe(0.4)) nt.pitch = clamp(t.pitch + (maybe(0.5) ? 1 : -1) * [2, 3, 5, 7][Math.floor(Math.random() * 4)], -24, 24)
        if (!LAYER_DEFS[t.type].continuous || !(t.clip.start <= 0.05 && t.clip.start + t.clip.len >= st.scene.duration - 0.05)) {
          const dur = st.scene.duration
          const start = clamp(t.clip.start + (Math.random() * 2 - 1) * dur * 0.2, 0, dur - 1)
          const len = clamp(t.clip.len + (Math.random() * 2 - 1) * dur * 0.2, 1, dur - start)
          nt.clip = { start, len }
        }
        return nt
      })
      set({ scene: { ...st.scene, tracks }, activePreset: null })
    },

    applyScenePreset: (id) => {
      const preset = SCENE_PRESETS.find((p) => p.id === id)
      if (!preset) return
      get().pushHistory()
      set({ scene: preset.build(), activePreset: id, selectedId: null })
    },

    loadScene: (s) => set({ scene: s, past: [], future: [], selectedId: null }),
  })),
)

/* keep the live engine in sync while it is running */
useSceneStore.subscribe(
  (s) => s.scene,
  (scene) => { if (ambientEngine.running) ambientEngine.sync(scene) },
)

/* persistence */
const KEY = 'slim.sounds.scene.v1'

export function loadPersistedScene() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { scene?: Scene; activePreset?: string | null }
    if (data.scene && Array.isArray(data.scene.tracks)) {
      useSceneStore.setState({ scene: data.scene, activePreset: data.activePreset ?? null })
    }
  } catch { /* ignore */ }
}

let persistTimer: number | null = null
useSceneStore.subscribe(
  (s) => [s.scene, s.activePreset] as const,
  ([scene, activePreset]) => {
    if (persistTimer !== null) window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify({ scene, activePreset })) } catch { /* noop */ }
    }, 400)
  },
  { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] },
)

export const selectedTrack = (): Track | null => {
  const st = useSceneStore.getState()
  return st.scene.tracks.find((t) => t.id === st.selectedId) ?? null
}
