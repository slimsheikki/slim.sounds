import { useEffect, useRef } from 'react'
import { engine } from '../audio/Engine'
import { IconSun } from './icons'

/** The little solar widget in the rail — fills with the sound you make. */
export function Energy() {
  const barRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let smooth = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const lvl = engine.getLevel()
      smooth = Math.max(lvl, smooth * 0.94)
      const el = barRef.current
      if (el) {
        const lit = Math.round(smooth * el.children.length)
        for (let i = 0; i < el.children.length; i++) {
          const cls = i < lit ? (i >= el.children.length - 2 ? 'on hot' : 'on') : ''
          if ((el.children[i] as HTMLElement).className !== cls) (el.children[i] as HTMLElement).className = cls
        }
      }
      if (wrapRef.current) {
        wrapRef.current.classList.toggle('lit', smooth > 0.02)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="energy" ref={wrapRef}>
      <div className="energy-head">
        <span className="energy-sun"><IconSun size={12} /></span>
        SOLAR
      </div>
      <div className="energy-bar" ref={barRef}>
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="energy-note">running on daylight</div>
    </div>
  )
}

/** Compact meter used near the piano — same idea, smaller. */
export function EnergyMini() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let smooth = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const lvl = engine.getLevel()
      smooth = Math.max(lvl, smooth * 0.9)
      const el = ref.current
      if (!el) return
      const n = el.children.length
      for (let i = 0; i < n; i++) {
        const child = el.children[i] as HTMLElement
        const threshold = (i + 1) / n
        const on = smooth >= threshold * 0.85
        const h = 30 + Math.min(1, smooth / threshold) * 60
        child.className = on ? 'on' : ''
        child.style.height = `${on ? h : 30}%`
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div>
      <div className="voice-line" style={{ marginBottom: 4 }}>
        <span>SUN</span>
      </div>
      <div className="cpu-bars" ref={ref}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    </div>
  )
}
