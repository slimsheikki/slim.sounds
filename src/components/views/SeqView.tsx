import { useStore } from '../../state/store'
import { midiName } from '../../utils/notes'
import { MiniDrag } from '../MiniDrag'

const ROW_COLORS = ['#f5c543', '#3e9be0', '#56be68', '#ee5a2c']

export function SeqView() {
  const seq = useStore((s) => s.patch.seq)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)

  return (
    <div className="seqv">
      <div className="subtabs" style={{ paddingBottom: 2 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-faint)', alignSelf: 'center' }}>
          EACH ROW FIRES THE CURRENT SOUND AT ITS OWN PITCH — PAINT STEPS BELOW, PRESS PLAY
        </span>
      </div>
      <div className="seqv-rows">
        {seq.offsets.map((off, r) => (
          <div className="seqv-row" key={r}>
            <span className="dot" style={{ background: ROW_COLORS[r] }} />
            <span className="nm">ROW {r + 1}</span>
            <MiniDrag
              className="strip-drag"
              value={off}
              min={-24}
              max={24}
              step={1}
              format={(v) => `${v > 0 ? '+' : ''}${v}st`}
              onChange={(v) => mutatePatch((p) => { p.seq.offsets[r] = v })}
              onGestureStart={beginGesture}
              onGestureEnd={endGesture}
            />
            <span className="note">{midiName(seq.root + off)}</span>
            <span style={{ flex: 1 }} />
            <button
              className="chip-btn"
              onClick={() => mutatePatch((p) => { p.seq.patterns[p.seq.pattern][r] = Array(16).fill(0) }, true)}
            >
              CLEAR
            </button>
          </div>
        ))}
      </div>
      <div className="seqv-foot">
        <span style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.14em' }}>ROOT</span>
        <MiniDrag
          className="strip-drag"
          value={seq.root}
          min={24}
          max={96}
          step={1}
          format={(v) => midiName(v)}
          onChange={(v) => mutatePatch((p) => { p.seq.root = v })}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <span style={{ flex: 1 }} />
        <button
          className="chip-btn"
          onClick={() => mutatePatch((p) => { p.seq.patterns[p.seq.pattern] = Array.from({ length: 4 }, () => Array(16).fill(0)) }, true)}
          style={{ color: 'var(--coral)' }}
        >
          CLEAR PATTERN
        </button>
      </div>
    </div>
  )
}
