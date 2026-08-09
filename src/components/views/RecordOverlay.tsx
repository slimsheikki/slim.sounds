import { useEffect, useRef } from 'react'
import { useStore } from '../../state/store'

export function RecordOverlay() {
  const recHandles = useStore((s) => s.recHandles)
  const stopRec = useStore((s) => s.stopRec)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !recHandles) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const w = rect.width
    const h = rect.height

    const analyser = recHandles.analyser
    const data = new Uint8Array(analyser.fftSize)
    const history: number[] = []
    const started = performance.now()
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (let i = 0; i < data.length; i += 2) {
        peak = Math.max(peak, Math.abs((data[i] - 128) / 128))
      }
      history.push(peak)
      const maxBars = Math.floor(w / 3)
      if (history.length > maxBars) history.splice(0, history.length - maxBars)

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#e85c4a'
      for (let i = 0; i < history.length; i++) {
        const v = history[i]
        const bh = Math.max(1.5, v * (h - 8))
        ctx.globalAlpha = 0.35 + v * 0.65
        ctx.fillRect(i * 3, (h - bh) / 2, 2, bh)
      }
      ctx.globalAlpha = 1

      if (timerRef.current) {
        const secs = (performance.now() - started) / 1000
        const mm = Math.floor(secs / 60)
        const ss = (secs % 60).toFixed(1).padStart(4, '0')
        timerRef.current.textContent = `${mm}:${ss}`
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [recHandles])

  return (
    <div className="rec-overlay">
      <div className="rec-head"><i />RECORDING</div>
      <div className="rec-timer" ref={timerRef}>0:00.0</div>
      <canvas ref={canvasRef} className="rec-canvas" />
      <div className="rec-actions">
        <button className="chip-btn lit" onClick={() => void stopRec()} style={{ padding: '6px 18px' }}>KEEP IT</button>
        <button className="chip-btn" onClick={() => void stopRec(true)} style={{ padding: '6px 14px', color: 'var(--coral)' }}>DISCARD</button>
      </div>
      <div className="rec-hint">R OR SPACE STOPS AND KEEPS · ESC DISCARDS · 30s MAX</div>
    </div>
  )
}
