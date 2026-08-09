import { useEffect, useRef } from 'react'
import { useStore } from '../../state/store'
import { engine } from '../../audio/Engine'
import { MiniDrag } from '../MiniDrag'
import { clamp } from '../../utils/misc'
import { IconRec, IconImport } from '../icons'
import { openImportDialog } from '../../utils/importPicker'

const INK = '#e9e2cc'
const SUN = '#ffc940'
const SKY = '#55aae8'
const LEAF = '#62c46f'

interface PeakCache {
  key: string
  buf: AudioBuffer | null
  mins: Float32Array
  maxs: Float32Array
}

function computePeaks(buf: AudioBuffer, w: number, v0: number, v1: number): PeakCache {
  const data = buf.getChannelData(0)
  const i0 = Math.floor(v0 * buf.length)
  const i1 = Math.max(i0 + 1, Math.ceil(v1 * buf.length))
  const span = i1 - i0
  const mins = new Float32Array(w)
  const maxs = new Float32Array(w)
  const perPx = span / w
  const stride = Math.max(1, Math.floor(perPx / 260))
  for (let x = 0; x < w; x++) {
    const s0 = i0 + Math.floor(x * perPx)
    const s1 = Math.min(i1, s0 + Math.max(1, Math.ceil(perPx)))
    let mn = Infinity
    let mx = -Infinity
    for (let i = s0; i < s1; i += stride) {
      const v = data[i]
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    if (mn === Infinity) {
      mn = 0
      mx = 0
    }
    mins[x] = mn
    maxs[x] = mx
  }
  return { key: '', buf: null, mins, maxs }
}

export function SampleView() {
  const buffer = useStore((s) => s.buffer)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useRef({ start: 0, end: 1 })
  const peaks = useRef<PeakCache | null>(null)
  const dragRef = useRef<{ kind: 'start' | 'end' | 'region' | 'select'; grabOffset: number } | null>(null)

  const sampler = useStore((s) => s.patch.sampler)
  const startRec = useStore((s) => s.startRec)
  const sampleOp = useStore((s) => s.sampleOp)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)

  /* ---------------- draw loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !buffer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width < 4) return
      if (canvas.width !== Math.round(rect.width * dpr)) {
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const w = Math.floor(canvas.width / dpr)
      const h = Math.floor(canvas.height / dpr)
      if (w < 4) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const st = useStore.getState()
      const sp = st.patch.sampler
      const v = view.current
      const key = `${v.start.toFixed(5)}|${v.end.toFixed(5)}|${w}`
      if (!peaks.current || peaks.current.key !== key || peaks.current.buf !== buffer) {
        peaks.current = computePeaks(buffer, w, v.start, v.end)
        peaks.current.key = key
        peaks.current.buf = buffer
      }

      const mid = h / 2
      const amp = h / 2 - 8
      const xOf = (frac: number) => ((frac - v.start) / (v.end - v.start)) * w
      const s = Math.min(sp.start, sp.end)
      const e = Math.max(sp.start, sp.end)
      const xs = xOf(s)
      const xe = xOf(e)

      // center line
      ctx.strokeStyle = '#2a2d20'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(w, mid)
      ctx.stroke()

      // waveform columns
      const { mins, maxs } = peaks.current
      for (let x = 0; x < w; x++) {
        const inRegion = x >= xs && x <= xe
        ctx.fillStyle = INK
        ctx.globalAlpha = inRegion ? 0.92 : 0.22
        const y0 = mid - maxs[x] * amp
        const y1 = mid - mins[x] * amp
        ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0))
      }
      ctx.globalAlpha = 1

      // fades
      const durSec = buffer.duration * (e - s)
      if (durSec > 0.001) {
        const fiFrac = clamp(sp.fadeIn / buffer.duration, 0, e - s)
        const foFrac = clamp(sp.fadeOut / buffer.duration, 0, e - s)
        ctx.strokeStyle = LEAF
        ctx.globalAlpha = 0.7
        ctx.lineWidth = 1
        if (fiFrac > 0.0004) {
          ctx.beginPath()
          ctx.moveTo(sp.reverse ? xe : xs, mid)
          ctx.lineTo(sp.reverse ? xOf(e - fiFrac) : xOf(s + fiFrac), 6)
          ctx.stroke()
        }
        if (foFrac > 0.0004) {
          ctx.beginPath()
          ctx.moveTo(sp.reverse ? xs : xe, mid)
          ctx.lineTo(sp.reverse ? xOf(s + foFrac) : xOf(e - foFrac), 6)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // selection box
      ctx.strokeStyle = SUN
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.strokeRect(xs, 5, Math.max(1, xe - xs), h - 10)
      ctx.setLineDash([])
      // marker lines + handles
      ctx.fillStyle = SUN
      ctx.fillRect(xs - 3, 2, 7, 7)
      ctx.strokeStyle = SUN
      ctx.beginPath()
      ctx.moveTo(xs + 0.5, 5)
      ctx.lineTo(xs + 0.5, h - 5)
      ctx.stroke()
      ctx.fillStyle = SKY
      ctx.fillRect(xe - 3, h - 9, 7, 7)
      ctx.strokeStyle = SKY
      ctx.beginPath()
      ctx.moveTo(xe + 0.5, 5)
      ctx.lineTo(xe + 0.5, h - 5)
      ctx.stroke()

      // playhead
      const ph = engine.samplePlayhead()
      if (ph !== null && ph >= v.start && ph <= v.end) {
        const xp = xOf(ph)
        ctx.strokeStyle = '#f5f0dd'
        ctx.shadowColor = '#f5f0dd'
        ctx.shadowBlur = 6
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(xp, 3)
        ctx.lineTo(xp, h - 3)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // zoom indicator
      if (v.start > 0.0001 || v.end < 0.9999) {
        ctx.fillStyle = '#3a382a'
        ctx.fillRect(0, h - 2, w, 2)
        ctx.fillStyle = SUN
        ctx.fillRect(v.start * w, h - 2, Math.max(2, (v.end - v.start) * w), 2)
      }
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [buffer])

  /* ---------------- pointer interaction ---------------- */
  const fracAt = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const rel = clamp((clientX - rect.left) / rect.width, 0, 1)
    return view.current.start + rel * (view.current.end - view.current.start)
  }
  const pxOf = (frac: number) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return ((frac - view.current.start) / (view.current.end - view.current.start)) * rect.width
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!buffer) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const st = useStore.getState().patch.sampler
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const s = Math.min(st.start, st.end)
    const en = Math.max(st.start, st.end)
    const xs = pxOf(s)
    const xe = pxOf(en)
    beginGesture()
    if (Math.abs(x - xs) < 9) {
      dragRef.current = { kind: 'start', grabOffset: 0 }
    } else if (Math.abs(x - xe) < 9) {
      dragRef.current = { kind: 'end', grabOffset: 0 }
    } else if (x > xs && x < xe) {
      dragRef.current = { kind: 'region', grabOffset: fracAt(e.clientX) - s }
    } else {
      const f = fracAt(e.clientX)
      mutatePatch((p) => {
        p.sampler.start = f
        p.sampler.end = f
      })
      dragRef.current = { kind: 'select', grabOffset: 0 }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !buffer) return
    const f = clamp(fracAt(e.clientX), 0, 1)
    mutatePatch((p) => {
      const sp = p.sampler
      if (d.kind === 'start') sp.start = clamp(f, 0, sp.end - 0.001)
      else if (d.kind === 'end') sp.end = clamp(f, sp.start + 0.001, 1)
      else if (d.kind === 'select') sp.end = clamp(f, sp.start + 0.001, 1)
      else {
        const width = Math.abs(sp.end - sp.start)
        const ns = clamp(f - d.grabOffset, 0, 1 - width)
        sp.start = ns
        sp.end = ns + width
      }
    })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    endGesture()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !buffer) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const rel = clamp((e.clientX - rect.left) / rect.width, 0, 1)
      const v = view.current
      const span = v.end - v.start
      const center = v.start + rel * span
      const factor = e.deltaY > 0 ? 1.28 : 0.78
      const newSpan = clamp(span * factor, 0.002, 1)
      let ns = center - rel * newSpan
      let ne = ns + newSpan
      if (ns < 0) { ne -= ns; ns = 0 }
      if (ne > 1) { ns -= ne - 1; ne = 1 }
      view.current = { start: clamp(ns, 0, 1), end: clamp(ne, 0, 1) }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [buffer])

  if (!buffer) {
    return (
      <div className="empty-sample">
        <span className="big">NO SAMPLE</span>
        <span className="hint">RECORD SOMETHING · DROP AUDIO ANYWHERE · OR IMPORT A FILE</span>
        <div className="empty-actions">
          <button className="chip-btn" onClick={() => void startRec()} style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}>
            <IconRec size={8} /> REC
          </button>
          <button className="chip-btn" onClick={openImportDialog}>
            <IconImport size={10} /> IMPORT
          </button>
        </div>
        <span className="hint" style={{ marginTop: 6 }}>a clap, a “clack”, a hit on a mug — anything grows into a game sound</span>
      </div>
    )
  }

  return (
    <>
      <div className="wave-wrap">
        <canvas
          ref={canvasRef}
          className="wave-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => { view.current = { start: 0, end: 1 } }}
        />
      </div>
      <div className="sample-tools">
        <button className="chip-btn" onClick={() => sampleOp('crop')} title="crop to region">CROP</button>
        <button className="chip-btn" onClick={() => sampleOp('normalize')} title="normalize">NORM</button>
        <button className={`chip-btn${sampler.reverse ? ' lit' : ''}`} onClick={() => sampleOp('reverse')} title="reverse playback">REV</button>
        <button
          className={`chip-btn${sampler.loop ? ' leaf-lit' : ''}`}
          onClick={() => mutatePatch((p) => { p.sampler.loop = !p.sampler.loop }, true)}
          title="loop region"
        >
          LOOP
        </button>
        <MiniDrag
          className="chip-btn chip-drag"
          value={Math.round(sampler.fadeIn * 1000)}
          min={0}
          max={2000}
          step={5}
          format={(v) => `IN ${v}ms`}
          onChange={(v) => mutatePatch((p) => { p.sampler.fadeIn = v / 1000 })}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <MiniDrag
          className="chip-btn chip-drag"
          value={Math.round(sampler.fadeOut * 1000)}
          min={0}
          max={2000}
          step={5}
          format={(v) => `OUT ${v}ms`}
          onChange={(v) => mutatePatch((p) => { p.sampler.fadeOut = v / 1000 })}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
        <span className="tools-gap" />
        <button className="chip-btn" onClick={() => { view.current = { start: 0, end: 1 } }} title="zoom to fit (wheel zooms)">FIT</button>
        <button className="chip-btn" onClick={() => sampleOp('clear')} style={{ color: 'var(--coral)' }}>CLEAR</button>
      </div>
    </>
  )
}
