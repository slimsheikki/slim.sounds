import { useEffect, useRef } from 'react'
import { engine } from '../audio/Engine'

/** Minimal live oscilloscope reading the master analyser. */
export function Scope({ width = 96, height = 44, color = '#edede8' }: { width?: number; height?: number; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    let raf = 0
    let data: Uint8Array | null = null

    const draw = () => {
      raf = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, width, height)
      const an = engine.analyser
      ctx.lineWidth = 1.2
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      if (an) {
        if (!data || data.length !== an.fftSize) data = new Uint8Array(an.fftSize)
        an.getByteTimeDomainData(data)
        const n = 256
        const start = 0
        for (let i = 0; i < n; i++) {
          const v = (data[start + Math.floor((i * (data.length - start)) / n)] - 128) / 128
          const x = (i / (n - 1)) * width
          const y = height / 2 - v * (height / 2 - 3)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      } else {
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
      }
      ctx.stroke()
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [width, height, color])

  return <canvas ref={ref} className="scope-box" style={{ width, height }} />
}

/** Vertical LED level meter. */
export function Meter({ segments = 14 }: { segments?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let smooth = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const lvl = engine.getLevel()
      smooth = Math.max(lvl, smooth * 0.86)
      const litCount = Math.round(smooth * segments)
      const kids = el.children
      // column-reverse layout: DOM child i sits i segments up from the bottom
      for (let i = 0; i < kids.length; i++) {
        const on = i < litCount
        const cls = on ? (i >= segments - 2 ? 'on hot' : i >= segments - 5 ? 'on mid' : 'on') : ''
        if ((kids[i] as HTMLElement).className !== cls) (kids[i] as HTMLElement).className = cls
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [segments])

  return (
    <div className="meter" ref={ref}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}
