import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { engine } from '../audio/Engine'
import { MiniDrag } from './MiniDrag'

export function StepSeq() {
  const seq = useStore((s) => s.patch.seq)
  const bpm = useStore((s) => s.bpm)
  const setBpm = useStore((s) => s.setBpm)
  const seqPlaying = useStore((s) => s.seqPlaying)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)
  const setMode = useStore((s) => s.setMode)

  const [playhead, setPlayhead] = useState(-1)
  const paint = useRef<{ value: number } | null>(null)
  const taps = useRef<number[]>([])

  useEffect(() => {
    if (!seqPlaying) {
      setPlayhead(-1)
      return
    }
    let raf = 0
    const tick = () => {
      setPlayhead(engine.playheadStep)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seqPlaying])

  const grid = seq.patterns[seq.pattern]

  const setCell = (r: number, c: number, v: number) => {
    mutatePatch((p) => {
      p.seq.patterns[p.seq.pattern][r][c] = v
    })
  }

  const tapTempo = () => {
    const now = performance.now()
    taps.current = taps.current.filter((t) => now - t < 3000)
    taps.current.push(now)
    if (taps.current.length >= 2) {
      const iv: number[] = []
      for (let i = 1; i < taps.current.length; i++) iv.push(taps.current[i] - taps.current[i - 1])
      const avg = iv.reduce((a, b) => a + b, 0) / iv.length
      setBpm(60000 / avg)
    }
  }

  return (
    <div className="seq-row">
      <div className="bpm-block">
        <MiniDrag
          className="bpm-box"
          value={bpm}
          min={40}
          max={240}
          step={1}
          format={(v) => v.toFixed(0)}
          onChange={setBpm}
          travel={220}
        />
        <span className="bpm-lab">BPM</span>
        <button className="tap-btn" onClick={tapTempo}>TAP</button>
      </div>
      <div className="step-grid" onPointerUp={() => { if (paint.current) { paint.current = null; endGesture() } }}>
        {Array.from({ length: 16 }, (_, c) => (
          <div
            key={c}
            className={`step-col${c % 4 === 0 && c > 0 ? ' group-gap' : ''}${playhead === c ? ' playing' : ''}`}
          >
            <span className="step-num">{c + 1}</span>
            {Array.from({ length: 4 }, (_, r) => {
              const on = grid[r][c] === 1
              const off = c >= seq.length
              return (
                <div
                  key={r}
                  className={`step-cell${on ? ` on-${r}` : ''}${off ? ' off-range' : ''}`}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    beginGesture()
                    const v = on ? 0 : 1
                    paint.current = { value: v }
                    setCell(r, c, v)
                    setMode('seq')
                  }}
                  onPointerEnter={(e) => {
                    if (paint.current && e.buttons > 0) setCell(r, c, paint.current.value)
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="pat-block">
        <div className="pat-line">
          <span>PATTERN</span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <button className="arrow-btn" onClick={() => mutatePatch((p) => { p.seq.pattern = (p.seq.pattern + 3) % 4 })}>‹</button>
            <b>{String(seq.pattern + 1).padStart(2, '0')}</b>
            <button className="arrow-btn" onClick={() => mutatePatch((p) => { p.seq.pattern = (p.seq.pattern + 1) % 4 })}>›</button>
          </span>
        </div>
        <div className="pat-line">
          <span>LENGTH</span>
          <MiniDrag
            value={seq.length}
            min={1}
            max={16}
            step={1}
            onChange={(v) => mutatePatch((p) => { p.seq.length = v })}
            onGestureStart={beginGesture}
            onGestureEnd={endGesture}
            travel={120}
          />
        </div>
        <div className="pat-line">
          <span>SWING</span>
          <MiniDrag
            value={Math.round(seq.swing * 100)}
            min={0}
            max={75}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => mutatePatch((p) => { p.seq.swing = v / 100 })}
            onGestureStart={beginGesture}
            onGestureEnd={endGesture}
            travel={120}
          />
        </div>
      </div>
    </div>
  )
}
