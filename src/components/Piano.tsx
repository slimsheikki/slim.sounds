import { useMemo, useRef } from 'react'
import { useStore } from '../state/store'
import { useKeysStore, KEYBOARD_ROWS } from '../state/keyboardStore'
import { isBlack, midiName } from '../utils/notes'
import { MiniDrag } from './MiniDrag'
import { EnergyMini } from './Energy'

const KEY_LABELS: Record<string, string> = Object.fromEntries(
  KEYBOARD_ROWS.flat().map((k) => [k.code, k.label]),
)

export function Piano() {
  const octave = useStore((s) => s.octave)
  const setOctave = useStore((s) => s.setOctave)
  const velocity = useStore((s) => s.velocity)
  const setVelocity = useStore((s) => s.setVelocity)
  const held = useStore((s) => s.held)
  const noteOn = useStore((s) => s.noteOn)
  const noteOff = useStore((s) => s.noteOff)
  const heldRemove = useStore((s) => s.heldRemove)
  const mode = useStore((s) => s.mode)
  const keySelection = useStore((s) => s.keySelection)
  const setToast = useStore((s) => s.setToast)
  const mapping = useKeysStore((s) => s.mapping)
  const setKey = useKeysStore((s) => s.setKey)

  const pointerNotes = useRef(new Map<number, number>())

  const base = (octave + 1) * 12 // C at displayed octave
  const octOffset = (octave - 4) * 12
  const keys = useMemo(() => Array.from({ length: 25 }, (_, i) => base + i), [base])
  const whites = keys.filter((m) => !isBlack(m))

  // reverse map: which laptop key plays this piano key (accounting for octave shift)
  const labelFor = (midi: number): string | null => {
    for (const [code, m] of Object.entries(mapping)) {
      if (m + octOffset === midi) return KEY_LABELS[code] ?? null
    }
    return null
  }

  const down = (midi: number, pointerId: number) => {
    if (mode === 'keys' && keySelection) {
      setKey(keySelection, midi - octOffset)
      setToast(`${KEY_LABELS[keySelection] ?? keySelection} → ${midiName(midi - octOffset)}`)
    }
    pointerNotes.current.set(pointerId, midi)
    noteOn(`ptr${pointerId}`, midi)
  }

  const up = (pointerId: number) => {
    const midi = pointerNotes.current.get(pointerId)
    if (midi === undefined) return
    pointerNotes.current.delete(pointerId)
    noteOff(`ptr${pointerId}`)
    heldRemove(midi)
  }

  // one narrow (~60% width) cosmetic utility key sits at the far left of the keybed
  const whiteW = 100 / (whites.length + 0.6)
  const utilW = whiteW * 0.6

  // cosmetic voice LEDs on fixed pitch classes (left octave only): C# / F# / A#
  const DOT_CLASS: Record<number, string> = { 1: 'key-dot-sky', 6: 'key-dot-leaf', 10: 'key-dot-amber' }

  return (
    <div className="piano-row">
      <div className="oct-block">
        <span className="oct-label">OCTAVE</span>
        <div className="oct-ctrl">
          <button className="oct-btn" onClick={() => setOctave(octave - 1)} title="octave down (Z)">‹</button>
          <b>{octave}</b>
          <button className="oct-btn" onClick={() => setOctave(octave + 1)} title="octave up (X)">›</button>
        </div>
        <div className="vel-line">
          <span>VEL</span>
          <MiniDrag
            value={Math.round(velocity * 100)}
            min={5}
            max={100}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => setVelocity(v / 100)}
          />
        </div>
      </div>

      <div
        className="piano"
        onPointerUp={(e) => up(e.pointerId)}
        onPointerCancel={(e) => up(e.pointerId)}
        onPointerLeave={(e) => up(e.pointerId)}
      >
        <div className="piano-util" style={{ width: `calc(${utilW}% - 2px)` }} aria-hidden="true" />
        {whites.map((m, i) => (
          <div
            key={m}
            className={`piano-white${held.includes(m) ? ' held' : ''}`}
            style={{ left: `${utilW + i * whiteW}%`, width: `calc(${whiteW}% - 2px)` }}
            onPointerDown={(e) => {
              e.preventDefault()
              down(m, e.pointerId)
            }}
            onPointerEnter={(e) => {
              if (e.buttons > 0) {
                up(e.pointerId)
                down(m, e.pointerId)
              }
            }}
          >
            {m % 12 === 0 && <span className="key-c-tag">{midiName(m)}</span>}
            {labelFor(m) && <span className="key-tag">{labelFor(m)}</span>}
          </div>
        ))}
        {keys.filter(isBlack).map((m) => {
          // position black key between its neighboring whites
          const whiteIndex = whites.filter((w) => w < m).length
          const left = utilW + whiteIndex * whiteW - whiteW * 0.3
          const dotCls = m - base < 12 ? DOT_CLASS[m % 12] : undefined
          return (
            <div
              key={m}
              className={`piano-black${held.includes(m) ? ' held' : ''}`}
              style={{ left: `${left}%`, width: `${whiteW * 0.6}%` }}
              onPointerDown={(e) => {
                e.preventDefault()
                down(m, e.pointerId)
              }}
              onPointerEnter={(e) => {
                if (e.buttons > 0) {
                  up(e.pointerId)
                  down(m, e.pointerId)
                }
              }}
            >
              {dotCls && <span className={`key-dot ${dotCls}`} />}
              {labelFor(m) && <span className="key-tag">{labelFor(m)}</span>}
            </div>
          )
        })}
      </div>

      <div className="voice-block">
        <VoiceCount />
        <EnergyMini />
      </div>
    </div>
  )
}

function VoiceCount() {
  const held = useStore((s) => s.held)
  return (
    <div className="voice-line">
      <span>VOICE</span>
      <b>{String(held.length).padStart(2, '0')}</b>
    </div>
  )
}
