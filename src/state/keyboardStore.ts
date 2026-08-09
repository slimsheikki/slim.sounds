import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Ableton-style default: home row = white keys, top row = black keys. C4 on A. */
export const DEFAULT_MAPPING: Record<string, number> = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63, KeyD: 64, KeyF: 65, KeyT: 66,
  KeyG: 67, KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72, KeyO: 73,
  KeyL: 74, KeyP: 75, Semicolon: 76, Quote: 77,
}

interface KeysState {
  mapping: Record<string, number>
  presets: Record<string, Record<string, number>>
  setKey: (code: string, midi: number) => void
  clearKey: (code: string) => void
  resetMapping: () => void
  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void
}

export const useKeysStore = create<KeysState>()(
  persist(
    (set, get) => ({
      mapping: { ...DEFAULT_MAPPING },
      presets: {},
      setKey: (code, midi) => set({ mapping: { ...get().mapping, [code]: midi } }),
      clearKey: (code) => {
        const m = { ...get().mapping }
        delete m[code]
        set({ mapping: m })
      },
      resetMapping: () => set({ mapping: { ...DEFAULT_MAPPING } }),
      savePreset: (name) => set({ presets: { ...get().presets, [name]: { ...get().mapping } } }),
      loadPreset: (name) => {
        const p = get().presets[name]
        if (p) set({ mapping: { ...p } })
      },
      deletePreset: (name) => {
        const ps = { ...get().presets }
        delete ps[name]
        set({ presets: ps })
      },
    }),
    { name: 'slim.sounds.keys.v1' },
  ),
)

/** Rows of the visual laptop keyboard (event.code values). */
export const KEYBOARD_ROWS: { code: string; label: string; w?: number }[][] = [
  [
    { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' },
    { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' },
    { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' }, { code: 'Digit9', label: '9' },
    { code: 'Digit0', label: '0' },
  ],
  [
    { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
  ],
  [
    { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
  ],
  [
    { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' }, { code: 'Comma', label: ',' }, { code: 'Period', label: '.' },
  ],
]
