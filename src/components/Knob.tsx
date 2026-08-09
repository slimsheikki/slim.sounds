import { useCallback, useEffect, useRef } from 'react'
import { clamp, expToNorm, normToExp } from '../utils/misc'

export interface KnobSpec {
  label: string
  color: string
  value: number
  min: number
  max: number
  step?: number
  exp?: boolean
  format?: (v: number) => string
  defaultValue?: number
  onChange: (v: number) => void
  /** stepped selector — value is an index into options */
  options?: string[]
  disabled?: boolean
}

interface KnobProps extends KnobSpec {
  size?: number
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

const SWEEP = 270 // degrees
const START_ANGLE = -225 // pointing down-left

export function Knob(props: KnobProps) {
  const {
    label, color, value, min, max, step, exp, format, defaultValue,
    onChange, options, disabled, size = 84, onGestureStart, onGestureEnd,
  } = props

  const drag = useRef<{ startY: number; startNorm: number; fine: boolean } | null>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  const toNorm = useCallback(
    (v: number) => (exp ? expToNorm(clamp(v, min, max), min, max) : (clamp(v, min, max) - min) / (max - min || 1)),
    [exp, min, max],
  )
  const fromNorm = useCallback(
    (n: number) => {
      let v = exp ? normToExp(clamp(n, 0, 1), min, max) : min + clamp(n, 0, 1) * (max - min)
      if (step) v = Math.round(v / step) * step
      return clamp(v, min, max)
    },
    [exp, min, max, step],
  )

  const norm = toNorm(value)

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startNorm: toNorm(propsRef.current.value), fine: e.shiftKey }
    onGestureStart?.()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const fine = e.shiftKey || drag.current.fine
    const dy = drag.current.startY - e.clientY
    const next = drag.current.startNorm + dy * 0.0062 * (fine ? 0.12 : 1)
    propsRef.current.onChange(fromNorm(next))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch { /* noop */ }
    onGestureEnd?.()
  }

  const wheelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = wheelRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const p = propsRef.current
      if (p.disabled) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const amt = (e.shiftKey ? 0.004 : 0.028) * dir
      p.onGestureStart?.()
      p.onChange(fromNorm(toNorm(p.value) + amt))
      p.onGestureEnd?.()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [fromNorm, toNorm])

  const onDoubleClick = () => {
    if (disabled || defaultValue === undefined) return
    onGestureStart?.()
    onChange(defaultValue)
    onGestureEnd?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    let delta = 0
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -1
    else return
    e.preventDefault()
    e.stopPropagation()
    const amt = (e.shiftKey ? 0.005 : 0.03) * delta
    const stepAmt = step && !exp ? (step / (max - min || 1)) * delta : amt
    onGestureStart?.()
    onChange(fromNorm(norm + (step && !exp && !e.shiftKey ? stepAmt : amt)))
    onGestureEnd?.()
  }

  const display = options
    ? options[clamp(Math.round(value), 0, options.length - 1)] ?? '--'
    : format
      ? format(value)
      : value.toFixed(2)

  // geometry
  const gradId = `cap-${label.replace(/\W+/g, '')}`
  const r = 33
  const cx = 50
  const cy = 50
  const angle = START_ANGLE + SWEEP * norm
  const rad = (a: number) => (a * Math.PI) / 180
  const arcPoint = (a: number, radius: number) => [cx + radius * Math.cos(rad(a)), cy + radius * Math.sin(rad(a))]
  const [ax, ay] = arcPoint(START_ANGLE, 44)
  const [bx, by] = arcPoint(angle, 44)
  const largeArc = SWEEP * norm > 180 ? 1 : 0
  const [px, py] = arcPoint(angle, r - 8)
  const [px2, py2] = arcPoint(angle, r - 22)

  // dotted track
  const dots = []
  for (let i = 0; i <= 20; i++) {
    const a = START_ANGLE + (SWEEP * i) / 20
    const [dx, dy] = arcPoint(a, 44)
    dots.push(<circle key={i} cx={dx} cy={dy} r={1.1} fill="#33322a" />)
  }

  return (
    <div
      className={`knob${disabled ? ' disabled' : ''}`}
      ref={wheelRef}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={display}
      onKeyDown={onKeyDown}
    >
      <span className="knob-label" style={{ color }}>{label}</span>
      <span className="knob-value">{disabled ? '--' : display}</span>
      <svg
        className="knob-svg"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <radialGradient id={gradId} cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#3a3a33" />
            <stop offset="55%" stopColor="#23231e" />
            <stop offset="100%" stopColor="#101010" />
          </radialGradient>
        </defs>
        {dots}
        {!disabled && (
          <path
            d={`M ${ax} ${ay} A 44 44 0 ${largeArc} 1 ${bx} ${by}`}
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.95"
          />
        )}
        <circle cx={cx} cy={cy + 2} r={r} fill="#000" opacity="0.55" />
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gradId})`} stroke="#000" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={r - 1.5} fill="none" stroke="#ffffff14" strokeWidth="1" />
        {!disabled && (
          <line x1={px2} y1={py2} x2={px} y2={py} stroke={color} strokeWidth="3.4" strokeLinecap="round" />
        )}
      </svg>
    </div>
  )
}
