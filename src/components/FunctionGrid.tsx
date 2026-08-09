import { useStore } from '../state/store'
import { openImportDialog } from '../utils/importPicker'
import { IconCopy, IconImport, IconMutate, IconPreset, IconRec, IconRedo, IconUndo } from './icons'

export function FunctionGrid() {
  const recording = useStore((s) => s.recording)
  const startRec = useStore((s) => s.startRec)
  const stopRec = useStore((s) => s.stopRec)
  const presetsOpen = useStore((s) => s.presetsOpen)
  const setPresetsOpen = useStore((s) => s.setPresetsOpen)
  const mutateSound = useStore((s) => s.mutateSound)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const abSlot = useStore((s) => s.abSlot)
  const switchAB = useStore((s) => s.switchAB)
  const copyAB = useStore((s) => s.copyAB)

  return (
    <div className="fn-grid">
      <button
        className={`fn-btn${recording ? ' rec-lit lit' : ''}`}
        onClick={() => void (recording ? stopRec() : startRec())}
        title="record from microphone (R)"
      >
        <span className="dot" />
        <IconRec size={13} />
        RECORD
      </button>
      <button className="fn-btn" onClick={openImportDialog} title="import an audio file — or drop one anywhere">
        <IconImport />
        IMPORT
      </button>
      <button className={`fn-btn${presetsOpen ? ' lit' : ''}`} onClick={() => setPresetsOpen(!presetsOpen)} title="SFX starting points">
        <span className="dot" />
        <IconPreset />
        PRESETS
      </button>
      <button className="fn-btn" onClick={mutateSound} title="smart-randomize the sound (M)">
        <IconMutate />
        MUTATE
      </button>
      <button className="fn-btn" onClick={undo} disabled={!canUndo} title="undo (ctrl/cmd+Z)">
        <IconUndo />
        UNDO
      </button>
      <button className="fn-btn" onClick={redo} disabled={!canRedo} title="redo (ctrl/cmd+shift+Z)">
        <IconRedo />
        REDO
      </button>
      <button
        className="fn-btn"
        onClick={() => switchAB(abSlot === 'A' ? 'B' : 'A')}
        title="flip between sound A and sound B (shift+A / shift+B)"
      >
        <span className="big">{abSlot}<span style={{ color: 'var(--ink-faint)', fontSize: 10 }}>/{abSlot === 'A' ? 'B' : 'A'}</span></span>
        COMPARE
      </button>
      <button className="fn-btn" onClick={copyAB} title={`copy sound ${abSlot} onto ${abSlot === 'A' ? 'B' : 'A'}`}>
        <IconCopy />
        COPY {abSlot}→{abSlot === 'A' ? 'B' : 'A'}
      </button>
    </div>
  )
}
