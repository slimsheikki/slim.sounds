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
  /** cosmetic: near-black utility cap with a cream notch (volume/swing style) */
  utility?: boolean
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

const SWEEP = 270 // degrees
const START_ANGLE = -225 // pointing down-left

/** mix a hex color toward another (t = 0..1) */
function mixHex(hex: string, target: string, t: number): string {
  const parse = (s: string): [number, number, number] => {
    let x = s.replace('#', '')
    if (x.length === 3) x = x.split('').map((c) => c + c).join('')
    return [parseInt(x.slice(0, 2), 16) || 0, parseInt(x.slice(2, 4), 16) || 0, parseInt(x.slice(4, 6), 16) || 0]
  }
  const a = parse(hex)
  const b = parse(target)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
}

export function Knob(props: KnobProps) {
  const {
    label, color, value, min, max, step, exp, format, defaultValue,
    onChange, options, disabled, size = 84, utility, onGestureStart, onGestureEnd,
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

  // geometry — solid colored glossy dome in a recessed well, dark notch indicator
  const cap = utility ? '#232320' : color
  const capHi = mixHex(cap, '#ffffff', utility ? 0.16 : 0.18) // broad soft highlight, upper-left
  const capLo = mixHex(cap, '#000000', utility ? 0.45 : 0.28) // darker lower rim
  const capEdge = mixHex(cap, '#000000', utility ? 0.65 : 0.5) // thin edge ring
  const notchColor = utility ? '#efe9d8' : '#1a1a18'
  const idBase = `${label.replace(/\W+/g, '')}-${cap.replace('#', '')}`
  const gradId = `cap-${idBase}`
  const rimId = `rim-${idBase}`
  const wellId = `well-${idBase}`
  const shadId = `shad-${idBase}`
  const r = 33
  const cx = 50
  const cy = 50
  const angle = START_ANGLE + SWEEP * norm
  const rad = (a: number) => (a * Math.PI) / 180
  const arcPoint = (a: number, radius: number) => [cx + radius * Math.cos(rad(a)), cy + radius * Math.sin(rad(a))]
  const [nx1, ny1] = arcPoint(angle, 8) // notch: near-center …
  const [nx2, ny2] = arcPoint(angle, 29) // … to the cap edge

  // tick ring — small gray dots circling ~300°, outside the well
  const dots = []
  for (let i = 0; i < 26; i++) {
    const a = -240 + (300 * i) / 25
    const [dx, dy] = arcPoint(a, 45)
    dots.push(<circle key={i} cx={dx} cy={dy} r={1.25} fill="#3a3a36" />)
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
          {/* dome: broad soft highlight upper-left → base color → clearly darker lower rim */}
          <radialGradient id={gradId} cx="35%" cy="30%" r="66%">
            <stop offset="0%" stopColor={capHi} />
            <stop offset="16%" stopColor={capHi} />
            <stop offset="52%" stopColor={cap} />
            <stop offset="100%" stopColor={capLo} />
          </radialGradient>
          {/* rim vignette — guarantees the edge rounds off at small scale */}
          <radialGradient id={rimId} cx="50%" cy="52%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="74%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
          </radialGradient>
          <linearGradient id={wellId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#030303" />
            <stop offset="100%" stopColor="#1a1a18" />
          </linearGradient>
          <filter id={shadId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
        </defs>
        {dots}
        {/* recessed near-black well */}
        <circle cx={cx} cy={cy} r={37.5} fill={`url(#${wellId})`} stroke="#000" strokeWidth="1" />
        {/* soft blurred shadow under the cap's lower edge — the dome floats in its socket */}
        <circle cx={cx} cy={cy + 3} r={r - 0.5} fill="#000" opacity="0.6" filter={`url(#${shadId})`} />
        {/* solid colored glossy dome */}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${gradId})`} stroke={capEdge} strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r={r} fill={`url(#${rimId})`} />
        {!disabled && (
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke={notchColor} strokeWidth="4.6" strokeLinecap="round" />
        )}
      </svg>
    </div>
  )
}
