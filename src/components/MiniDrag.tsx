import { useRef } from 'react'
import { clamp } from '../utils/misc'

interface MiniDragProps {
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
  onGestureStart?: () => void
  onGestureEnd?: () => void
  className?: string
  /** pixels of drag for full range */
  travel?: number
}

/** A small draggable numeric readout (vertical drag + wheel). */
export function MiniDrag({ value, min, max, step = 1, format, onChange, onGestureStart, onGestureEnd, className = 'mini-drag', travel = 160 }: MiniDragProps) {
  const drag = useRef<{ y: number; v: number } | null>(null)
  const vRef = useRef(value)
  vRef.current = value

  const apply = (raw: number) => {
    const stepped = Math.round(raw / step) * step
    onChange(clamp(stepped, min, max))
  }

  return (
    <span
      className={className}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        drag.current = { y: e.clientY, v: vRef.current }
        onGestureStart?.()
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dy = drag.current.y - e.clientY
        const range = max - min
        apply(drag.current.v + (dy / travel) * range * (e.shiftKey ? 0.1 : 1))
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        drag.current = null
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
        onGestureEnd?.()
      }}
      onWheel={(e) => {
        const dir = e.deltaY > 0 ? -1 : 1
        onGestureStart?.()
        apply(vRef.current + dir * step)
        onGestureEnd?.()
      }}
    >
      {format ? format(value) : String(value)}
    </span>
  )
}
