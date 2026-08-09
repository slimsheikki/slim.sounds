/** Ambient scene model — the generative timeline (layers = tracks with looping clips). */

export type LayerType =
  | 'wind' | 'drone' | 'pad' | 'rain' | 'water' | 'hum' | 'spark' | 'bells' | 'surge'

export interface LayerDef {
  type: LayerType
  name: string
  color: string
  /** sustained texture (region-gated gain) vs. discrete scattered events */
  continuous: boolean
  /** base MIDI note the generator centres on */
  base: number
  blurb: string
}

export const LAYER_DEFS: Record<LayerType, LayerDef> = {
  wind:  { type: 'wind',  name: 'WIND',  color: '#6cc0f0', continuous: true,  base: 60, blurb: 'airy filtered noise, slow sweep' },
  drone: { type: 'drone', name: 'DRONE', color: '#ee5a2c', continuous: true,  base: 34, blurb: 'low detuned bed, the foundation' },
  pad:   { type: 'pad',   name: 'PAD',   color: '#56be68', continuous: true,  base: 50, blurb: 'warm sustained chord, dreamy' },
  rain:  { type: 'rain',  name: 'RAIN',  color: '#3e9be0', continuous: true,  base: 72, blurb: 'shimmering high hiss' },
  water: { type: 'water', name: 'WATER', color: '#3ec6b5', continuous: true,  base: 55, blurb: 'bubbling band-passed motion' },
  hum:   { type: 'hum',   name: 'HUM',   color: '#f0a63a', continuous: true,  base: 40, blurb: 'retro machine tremolo' },
  spark: { type: 'spark', name: 'SPARK', color: '#f5c543', continuous: false, base: 74, blurb: 'sparse pentatonic blips' },
  bells: { type: 'bells', name: 'BELLS', color: '#ffd76a', continuous: false, base: 67, blurb: 'metallic FM chimes, Y2K' },
  surge: { type: 'surge', name: 'SURGE', color: '#e8794a', continuous: true,  base: 45, blurb: 'sci-fi swell, rising & falling' },
}

export const LAYER_ORDER: LayerType[] = ['wind', 'drone', 'pad', 'rain', 'water', 'hum', 'surge', 'spark', 'bells']

export interface Clip {
  start: number // seconds from scene origin
  len: number   // seconds
}

export interface Track {
  id: string
  type: LayerType
  name: string
  color: string
  clip: Clip
  level: number  // 0..1
  tone: number   // 0..1 → brightness (filter cutoff)
  motion: number // 0..1 → LFO speed / event density
  space: number  // 0..1 → reverb send
  pitch: number  // semitone offset from the layer's base
  muted: boolean
}

export interface Scene {
  duration: number // seconds — the loop length
  loop: boolean    // repeat forever
  lofi: boolean    // 90s / Y2K master colouring
  tracks: Track[]
  name: string
}

export const SCENE_MIN = 6
export const SCENE_MAX = 60

let idN = 0
export const nextTrackId = () => `trk_${Date.now().toString(36)}_${idN++}`

export function makeTrack(type: LayerType, scene: Scene): Track {
  const def = LAYER_DEFS[type]
  // continuous layers span the whole scene by default; discrete ones sit in the middle third
  const clip: Clip = def.continuous
    ? { start: 0, len: scene.duration }
    : { start: Math.round(scene.duration * 0.12), len: Math.round(scene.duration * 0.76) }
  const perType: Partial<Record<LayerType, Partial<Track>>> = {
    drone: { level: 0.62, tone: 0.32, motion: 0.28, space: 0.4 },
    wind:  { level: 0.5, tone: 0.55, motion: 0.5, space: 0.55 },
    pad:   { level: 0.55, tone: 0.42, motion: 0.3, space: 0.62 },
    rain:  { level: 0.4, tone: 0.7, motion: 0.55, space: 0.4 },
    water: { level: 0.45, tone: 0.5, motion: 0.6, space: 0.5 },
    hum:   { level: 0.5, tone: 0.35, motion: 0.4, space: 0.35 },
    surge: { level: 0.5, tone: 0.45, motion: 0.35, space: 0.6 },
    spark: { level: 0.6, tone: 0.6, motion: 0.35, space: 0.66 },
    bells: { level: 0.55, tone: 0.55, motion: 0.3, space: 0.7 },
  }
  return {
    id: nextTrackId(),
    type,
    name: def.name,
    color: def.color,
    clip,
    level: 0.6,
    tone: 0.5,
    motion: 0.4,
    space: 0.5,
    pitch: 0,
    muted: false,
    ...perType[type],
  }
}

export const cloneScene = (s: Scene): Scene => ({
  ...s,
  tracks: s.tracks.map((t) => ({ ...t, clip: { ...t.clip } })),
})

/* ---------------- scene presets (game-ambience starting points) ---------------- */

export interface ScenePreset {
  id: string
  name: string
  blurb: string
  build: () => Scene
}

const base = (name: string, duration: number): Scene => ({ duration, loop: true, lofi: true, tracks: [], name })

function seed(scene: Scene, specs: [LayerType, Partial<Track>][]): Scene {
  for (const [type, over] of specs) {
    const t = makeTrack(type, scene)
    Object.assign(t, over)
    if (over.clip) t.clip = { ...t.clip, ...over.clip }
    scene.tracks.push(t)
  }
  return scene
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'forest-dawn', name: 'FOREST DAWN', blurb: 'soft wind, warm pad, birds of light',
    build: () => seed(base('forest dawn', 24), [
      ['wind', { level: 0.5, tone: 0.6, motion: 0.5, space: 0.6 }],
      ['pad', { pitch: 0, level: 0.5, tone: 0.5, space: 0.66 }],
      ['spark', { motion: 0.45, pitch: 0, space: 0.7, clip: { start: 4, len: 16 } }],
    ]),
  },
  {
    id: 'space-station', name: 'SPACE STATION', blurb: 'low drone hum, distant surges',
    build: () => seed(base('space station', 28), [
      ['drone', { level: 0.6, tone: 0.3, motion: 0.22 }],
      ['hum', { level: 0.42, tone: 0.34, motion: 0.5 }],
      ['surge', { level: 0.4, space: 0.7, clip: { start: 6, len: 18 } }],
      ['bells', { motion: 0.22, space: 0.75, clip: { start: 10, len: 14 } }],
    ]),
  },
  {
    id: 'rainy-alley', name: 'RAINY ALLEY', blurb: 'rain, neon hum, water drips',
    build: () => seed(base('rainy alley', 22), [
      ['rain', { level: 0.5, tone: 0.72, motion: 0.5 }],
      ['drone', { level: 0.4, tone: 0.28, pitch: 3 }],
      ['water', { level: 0.4, motion: 0.6, clip: { start: 3, len: 16 } }],
      ['hum', { level: 0.34, tone: 0.4, space: 0.4 }],
    ]),
  },
  {
    id: 'crystal-cave', name: 'CRYSTAL CAVE', blurb: 'deep pad, dripping bells, echoes',
    build: () => seed(base('crystal cave', 30), [
      ['pad', { pitch: -5, level: 0.5, tone: 0.38, space: 0.72 }],
      ['drone', { level: 0.42, pitch: -5, tone: 0.26 }],
      ['bells', { motion: 0.35, space: 0.8, pitch: 0, clip: { start: 2, len: 26 } }],
      ['water', { level: 0.3, motion: 0.4, space: 0.6, clip: { start: 8, len: 14 } }],
    ]),
  },
  {
    id: 'underwater', name: 'UNDERWATER', blurb: 'muffled drone, bubbles, slow surge',
    build: () => seed(base('underwater', 26), [
      ['drone', { level: 0.55, tone: 0.2, pitch: -2 }],
      ['water', { level: 0.5, motion: 0.7, tone: 0.4 }],
      ['surge', { level: 0.36, tone: 0.3, space: 0.66 }],
    ]),
  },
  {
    id: 'menu-hum', name: 'MENU LOOP', blurb: 'clean pad + sparkle, title-screen calm',
    build: () => seed(base('menu loop', 16), [
      ['pad', { level: 0.55, tone: 0.55, space: 0.6 }],
      ['wind', { level: 0.3, tone: 0.6, motion: 0.4 }],
      ['spark', { motion: 0.4, space: 0.7 }],
    ]),
  },
  {
    id: 'ancient-ruins', name: 'ANCIENT RUINS', blurb: 'wind over a vast low drone',
    build: () => seed(base('ancient ruins', 32), [
      ['wind', { level: 0.55, tone: 0.5, motion: 0.6, space: 0.6 }],
      ['drone', { level: 0.6, tone: 0.24, pitch: -7 }],
      ['surge', { level: 0.34, space: 0.7, clip: { start: 12, len: 18 } }],
      ['bells', { motion: 0.18, space: 0.78, clip: { start: 16, len: 14 } }],
    ]),
  },
  {
    id: 'solar-field', name: 'SOLAR FIELD', blurb: 'bright pad, warm hum, gentle sparks',
    build: () => seed(base('solar field', 20), [
      ['pad', { level: 0.5, tone: 0.62, pitch: 5, space: 0.6 }],
      ['hum', { level: 0.36, tone: 0.44 }],
      ['spark', { motion: 0.5, pitch: 5, space: 0.66 }],
      ['wind', { level: 0.3, tone: 0.66, motion: 0.55 }],
    ]),
  },
]

export function defaultScene(): Scene {
  return SCENE_PRESETS[0].build()
}
