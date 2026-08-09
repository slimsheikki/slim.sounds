import { useState } from 'react'
import { useStore } from '../../state/store'
import { KEYBOARD_ROWS, useKeysStore } from '../../state/keyboardStore'
import { midiName } from '../../utils/notes'

export function KeysView() {
  const mapping = useKeysStore((s) => s.mapping)
  const presets = useKeysStore((s) => s.presets)
  const setKey = useKeysStore((s) => s.setKey)
  const clearKey = useKeysStore((s) => s.clearKey)
  const resetMapping = useKeysStore((s) => s.resetMapping)
  const savePreset = useKeysStore((s) => s.savePreset)
  const loadPreset = useKeysStore((s) => s.loadPreset)
  const deletePreset = useKeysStore((s) => s.deletePreset)

  const selected = useStore((s) => s.keySelection)
  const setKeySelection = useStore((s) => s.setKeySelection)
  const [presetName, setPresetName] = useState('')
  const [chosenPreset, setChosenPreset] = useState('')

  const selMidi = selected ? mapping[selected] : undefined
  const presetNames = Object.keys(presets)

  const nudge = (amt: number) => {
    if (!selected) return
    const base = mapping[selected] ?? 60
    setKey(selected, Math.max(12, Math.min(108, base + amt)))
  }

  return (
    <div className="keysv">
      <div className="kbd-map">
        {KEYBOARD_ROWS.map((row, i) => (
          <div className="kbd-row" key={i}>
            {row.map((k) => {
              const midi = mapping[k.code]
              return (
                <div
                  key={k.code}
                  className={`kbd-key${midi !== undefined ? ' mapped' : ''}${selected === k.code ? ' sel' : ''}`}
                  onClick={() => setKeySelection(selected === k.code ? null : k.code)}
                >
                  <span>{k.label}</span>
                  {midi !== undefined && <span className="note">{midiName(midi)}</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="keys-side">
        <div className="keys-box">
          <h4>ASSIGN</h4>
          {selected ? (
            <>
              <div className="assign-note">
                <span style={{ fontSize: 11, color: 'var(--screen-ink)' }}>[{KEYBOARD_ROWS.flat().find((k) => k.code === selected)?.label ?? selected}]</span>
                <b>{selMidi !== undefined ? midiName(selMidi) : '--'}</b>
              </div>
              <div className="keys-actions">
                <button className="chip-btn" onClick={() => nudge(-12)}>-OCT</button>
                <button className="chip-btn" onClick={() => nudge(-1)}>-1</button>
                <button className="chip-btn" onClick={() => nudge(1)}>+1</button>
                <button className="chip-btn" onClick={() => nudge(12)}>+OCT</button>
                <button className="chip-btn" style={{ color: 'var(--coral)' }} onClick={() => selected && clearKey(selected)}>CLEAR</button>
              </div>
              <span className="keys-hint">
                or <em>click a piano key below</em> to bind it directly
              </span>
            </>
          ) : (
            <span className="keys-hint">
              click a key above — or just <em>press it</em> — then choose the note it should play
            </span>
          )}
        </div>
        <div className="keys-box">
          <h4>LAYOUTS</h4>
          <div className="keys-actions">
            <button className="chip-btn" onClick={resetMapping}>DEFAULT</button>
            <button
              className="chip-btn"
              onClick={() => {
                const name = presetName.trim() || `layout ${presetNames.length + 1}`
                savePreset(name)
                setPresetName('')
                setChosenPreset(name)
              }}
            >
              SAVE
            </button>
          </div>
          <input
            className="keys-input"
            placeholder="layout name…"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
          {presetNames.length > 0 && (
            <>
              <select className="keys-select" value={chosenPreset} onChange={(e) => setChosenPreset(e.target.value)}>
                <option value="">— saved layouts —</option>
                {presetNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div className="keys-actions">
                <button className="chip-btn" disabled={!chosenPreset} onClick={() => chosenPreset && loadPreset(chosenPreset)}>LOAD</button>
                <button className="chip-btn" disabled={!chosenPreset} style={{ color: 'var(--coral)' }} onClick={() => { if (chosenPreset) { deletePreset(chosenPreset); setChosenPreset('') } }}>DELETE</button>
              </div>
            </>
          )}
        </div>
        <div className="keys-box">
          <h4>SHORTCUTS</h4>
          <span className="keys-hint">
            <em>space</em> play · <em>R</em> rec · <em>M</em> mutate · <em>1–6</em> modes · <em>Z/X</em> octave · <em>⌘Z</em> undo · <em>⇧A/⇧B</em> compare
          </span>
        </div>
      </div>
    </div>
  )
}
