export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const midiName = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`

export const midiFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12)

export const clampMidi = (m: number) => Math.max(12, Math.min(115, Math.round(m)))
