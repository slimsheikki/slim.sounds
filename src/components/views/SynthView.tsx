import { useRef } from 'react'
import { useStore } from '../../state/store'
import type { OscWave } from '../../state/types'
import { clamp, fmtSecs } from '../../utils/misc'
import { WaveGlyph } from '../icons'
import { MiniDrag } from '../MiniDrag'
import { Scope } from '../Scope'

const LEAF = '#56be68'
const SUN = '#f5c543'
const SKY = '#3e9be0'

const A_MAX = 1.5
const D_MAX = 1.5
const R_MAX = 2
const HOLD = 0.18
const P_RANGE = 36 // ± semitones shown
const T_MAX = 2

/* ---------------- ADSR editor ---------------- */

function EnvelopeEditor() {
  const adsr = useStore((s) => s.patch.synth.adsr)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ pt: 1 | 2 | 4; total: number } | null>(null)

  const W = 300
  const H = 130
  const PAD = 8

  const total = Math.max(0.05, adsr.a + adsr.d + HOLD + adsr.r)
  const x1 = PAD + (adsr.a / total) * (W - 2 * PAD)
  const x2 = PAD + ((adsr.a + adsr.d) / total) * (W - 2 * PAD)
  const x3 = PAD + ((adsr.a + adsr.d + HOLD) / total) * (W - 2 * PAD)
  const x4 = W - PAD
  const yTop = PAD
  const yBot = H - PAD
  const ys = yBot - adsr.s * (yBot - yTop)

  const norm = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const { x, y } = norm(e)
    const tAt = ((x * W - PAD) / (W - 2 * PAD)) * d.total
    mutatePatch((p) => {
      const a = p.synth.adsr
      if (d.pt === 1) a.a = clamp(tAt, 0.001, A_MAX)
      else if (d.pt === 2) {
        a.d = clamp(tAt - a.a, 0.005, D_MAX)
        a.s = clamp(1 - (y * H - yTop) / (yBot - yTop), 0, 1)
      } else {
        a.r = clamp(tAt - (a.a + a.d + HOLD), 0.008, R_MAX)
      }
    })
  }

  const grab = (pt: 1 | 2 | 4) => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { pt, total }
    beginGesture()
  }
  const release = (e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    endGesture()
  }

  const pts: { x: number; y: number; pt: 1 | 2 | 4; color: string }[] = [
    { x: x1, y: yTop, pt: 1, color: SUN },
    { x: x2, y: ys, pt: 2, color: LEAF },
    { x: x4, y: yBot, pt: 4, color: SKY },
  ]

  return (
    <>
      <div className="env-editor">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerMove={onMove} onPointerUp={release} onPointerCancel={release}>
          <defs>
            <linearGradient id="envfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LEAF} stopOpacity="0.35" />
              <stop offset="100%" stopColor={LEAF} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={PAD} x2={W - PAD} y1={yTop + f * (yBot - yTop)} y2={yTop + f * (yBot - yTop)} stroke="#202020" strokeWidth="1" />
          ))}
          <path d={`M ${PAD} ${yBot} L ${x1} ${yTop} L ${x2} ${ys} L ${x3} ${ys} L ${x4} ${yBot} Z`} fill="url(#envfill)" />
          <path d={`M ${PAD} ${yBot} L ${x1} ${yTop} L ${x2} ${ys} L ${x3} ${ys} L ${x4} ${yBot}`} fill="none" stroke={LEAF} strokeWidth="2" strokeLinejoin="round" />
          <line x1={x3} y1={ys} x2={x3} y2={yBot} stroke="#2a2a28" strokeDasharray="3 3" />
          {pts.map((p) => (
            <g key={p.pt} className="env-pt" onPointerDown={grab(p.pt)}>
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              <circle cx={p.x} cy={p.y} r="5" fill="#0a0a0a" stroke={p.color} strokeWidth="2" />
            </g>
          ))}
        </svg>
      </div>
      <div className="env-caption">
        <span>A <b>{fmtSecs(adsr.a)}</b></span>
        <span>D <b>{fmtSecs(adsr.d)}</b></span>
        <span>S <b>{Math.round(adsr.s * 100)}%</b></span>
        <span>R <b>{fmtSecs(adsr.r)}</b></span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>drag the points · knobs work too</span>
      </div>
    </>
  )
}

/* ---------------- pitch envelope editor ---------------- */

export function pitchCurvePoints(start: number, end: number, time: number, bend: number, W: number, H: number, PAD: number): string {
  const yOf = (st: number) => H / 2 - (clamp(st, -P_RANGE, P_RANGE) / P_RANGE) * (H / 2 - PAD)
  const xEnd = PAD + (clamp(time, 0.01, T_MAX) / T_MAX) * (W - 2 * PAD)
  const pts: string[] = []
  const n = 42
  const tau = Math.max(0.006, (time * (1.05 - bend)) / 3)
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * time
    const v = bend <= 0.05 ? start + (end - start) * (i / n) : end + (start - end) * Math.exp(-t / tau)
    pts.push(`${PAD + (i / n) * (xEnd - PAD)},${yOf(v)}`)
  }
  pts.push(`${W - PAD},${yOf(end)}`)
  return pts.join(' ')
}

function PitchEnvEditor() {
  const penv = useStore((s) => s.patch.synth.penv)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<'start' | 'end' | 'bend' | null>(null)

  const W = 300
  const H = 130
  const PAD = 8

  const yOf = (st: number) => H / 2 - (clamp(st, -P_RANGE, P_RANGE) / P_RANGE) * (H / 2 - PAD)
  const xEnd = PAD + (clamp(penv.time, 0.01, T_MAX) / T_MAX) * (W - 2 * PAD)

  const norm = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const { x, y } = norm(e)
    const st = clamp(Math.round(((H / 2 - y * H) / (H / 2 - PAD)) * P_RANGE), -P_RANGE, P_RANGE)
    mutatePatch((p) => {
      const pe = p.synth.penv
      if (drag.current === 'start') pe.start = st
      else if (drag.current === 'end') {
        pe.end = st
        pe.time = clamp(((x * W - PAD) / (W - 2 * PAD)) * T_MAX, 0.01, T_MAX)
      } else {
        pe.bend = clamp(1 - y, 0, 1)
      }
    })
  }

  const grab = (which: 'start' | 'end' | 'bend') => (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = which
    beginGesture()
  }
  const release = (e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    endGesture()
  }

  const midT = penv.time * 0.35
  const tau = Math.max(0.006, (penv.time * (1.05 - penv.bend)) / 3)
  const midV = penv.bend <= 0.05 ? penv.start + (penv.end - penv.start) * 0.35 : penv.end + (penv.start - penv.end) * Math.exp(-midT / tau)
  const midX = PAD + 0.35 * (xEnd - PAD)

  return (
    <>
      <div className="env-editor">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerMove={onMove} onPointerUp={release} onPointerCancel={release}>
          <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="#202020" strokeWidth="1" />
          {[12, 24].map((st) => (
            <g key={st}>
              <line x1={PAD} x2={W - PAD} y1={yOf(st)} y2={yOf(st)} stroke="#1c1c1b" strokeWidth="1" />
              <line x1={PAD} x2={W - PAD} y1={yOf(-st)} y2={yOf(-st)} stroke="#1c1c1b" strokeWidth="1" />
              <text x={W - PAD - 2} y={yOf(st) - 2} fill="#4a4a46" fontSize="7" textAnchor="end">+{st}</text>
              <text x={W - PAD - 2} y={yOf(-st) - 2} fill="#4a4a46" fontSize="7" textAnchor="end">-{st}</text>
            </g>
          ))}
          <polyline points={pitchCurvePoints(penv.start, penv.end, penv.time, penv.bend, W, H, PAD)} fill="none" stroke={SUN} strokeWidth="2" />
          <g className="env-pt" onPointerDown={grab('start')}>
            <circle cx={PAD} cy={yOf(penv.start)} r="14" fill="transparent" />
            <circle cx={PAD} cy={yOf(penv.start)} r="5" fill="#0a0a0a" stroke={SUN} strokeWidth="2" />
          </g>
          <g className="env-pt" onPointerDown={grab('end')}>
            <circle cx={xEnd} cy={yOf(penv.end)} r="14" fill="transparent" />
            <circle cx={xEnd} cy={yOf(penv.end)} r="5" fill="#0a0a0a" stroke={SKY} strokeWidth="2" />
          </g>
          <g className="env-pt" onPointerDown={grab('bend')}>
            <circle cx={midX} cy={yOf(midV)} r="12" fill="transparent" />
            <rect x={midX - 4} y={yOf(midV) - 4} width="8" height="8" rx="2" fill="#0a0a0a" stroke={LEAF} strokeWidth="1.6" />
          </g>
        </svg>
      </div>
      <div className="env-caption">
        <span>START <b>{penv.start > 0 ? '+' : ''}{penv.start}st</b></span>
        <span>END <b>{penv.end > 0 ? '+' : ''}{penv.end}st</b></span>
        <span>TIME <b>{fmtSecs(penv.time)}</b></span>
        <span>BEND <b>{Math.round(penv.bend * 100)}%</b></span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>zaps · falls · rises</span>
      </div>
    </>
  )
}

/* ---------------- oscillator panel ---------------- */

function LevelSlider({ value, color, onChange }: { value: number; color?: string; onChange: (v: number) => void }) {
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const apply = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    onChange(clamp((clientX - rect.left) / rect.width, 0, 1))
  }

  return (
    <div
      ref={ref}
      className={`level-slider${color ? ` ${color}` : ''}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = true
        beginGesture()
        apply(e.clientX)
      }}
      onPointerMove={(e) => { if (dragging.current) apply(e.clientX) }}
      onPointerUp={(e) => {
        if (!dragging.current) return
        dragging.current = false
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
        endGesture()
      }}
    >
      <div className="fill" style={{ width: `${value * 100}%` }} />
    </div>
  )
}

const WAVES: OscWave[] = ['sine', 'triangle', 'sawtooth', 'square']

function OscStrip({ osc }: { osc: 'o1' | 'o2' }) {
  const params = useStore((s) => s.patch.synth[osc])
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)

  return (
    <div className="osc-strip">
      <span className="name">{osc.toUpperCase()}</span>
      <div className="wave-pick">
        {WAVES.map((w) => (
          <button
            key={w}
            className={`wave-btn${params.wave === w ? ' active' : ''}`}
            onClick={() => mutatePatch((p) => { p.synth[osc].wave = w }, true)}
            title={w}
          >
            <WaveGlyph wave={w} size={18} />
          </button>
        ))}
      </div>
      <span className="lab">SEMI</span>
      <MiniDrag
        value={params.semi}
        min={-24}
        max={24}
        step={1}
        format={(v) => `${v > 0 ? '+' : ''}${v}`}
        onChange={(v) => mutatePatch((p) => { p.synth[osc].semi = v })}
        onGestureStart={beginGesture}
        onGestureEnd={endGesture}
      />
      <span className="lab">DET</span>
      <MiniDrag
        value={params.detune}
        min={-50}
        max={50}
        step={1}
        format={(v) => `${v > 0 ? '+' : ''}${v}c`}
        onChange={(v) => mutatePatch((p) => { p.synth[osc].detune = v })}
        onGestureStart={beginGesture}
        onGestureEnd={endGesture}
      />
      <span className="lab">LVL</span>
      <LevelSlider
        value={params.level}
        color={osc === 'o1' ? 'sun' : 'sky'}
        onChange={(v) => mutatePatch((p) => { p.synth[osc].level = v })}
      />
    </div>
  )
}

function OscPanel() {
  const noise = useStore((s) => s.patch.synth.noise)
  const transpose = useStore((s) => s.patch.synth.transpose)
  const mutatePatch = useStore((s) => s.mutatePatch)
  const beginGesture = useStore((s) => s.beginGesture)
  const endGesture = useStore((s) => s.endGesture)

  return (
    <div className="osc-panel">
      <OscStrip osc="o1" />
      <OscStrip osc="o2" />
      <div className="osc-strip">
        <span className="name">NOISE</span>
        <span className="lab">LVL</span>
        <LevelSlider value={noise} onChange={(v) => mutatePatch((p) => { p.synth.noise = v })} />
        <span className="lab">TRANSPOSE</span>
        <MiniDrag
          value={transpose}
          min={-24}
          max={24}
          step={1}
          format={(v) => `${v > 0 ? '+' : ''}${v}st`}
          onChange={(v) => mutatePatch((p) => { p.synth.transpose = v })}
          onGestureStart={beginGesture}
          onGestureEnd={endGesture}
        />
      </div>
    </div>
  )
}

/* ---------------- main tab ---------------- */

function MainTab() {
  const synth = useStore((s) => s.patch.synth)
  const setSynthTab = useStore((s) => s.setSynthTab)

  const envMini = () => {
    const total = Math.max(0.05, synth.adsr.a + synth.adsr.d + HOLD + synth.adsr.r)
    const x = (t: number) => 4 + (t / total) * 92
    const ys = 34 - synth.adsr.s * 26
    return `M 4 34 L ${x(synth.adsr.a)} 8 L ${x(synth.adsr.a + synth.adsr.d)} ${ys} L ${x(synth.adsr.a + synth.adsr.d + HOLD)} ${ys} L 96 34`
  }

  return (
    <div className="synth-main">
      <div className="synth-card" onClick={() => setSynthTab('osc')}>
        <h4>OSCILLATORS</h4>
        <div className="row">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <WaveGlyph wave={synth.o1.wave} size={20} color="#f5c543" />
            <b>{synth.o1.semi > 0 ? '+' : ''}{synth.o1.semi}st</b>
          </span>
          <b>{Math.round(synth.o1.level * 100)}%</b>
        </div>
        <div className="row">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <WaveGlyph wave={synth.o2.wave} size={20} color="#3e9be0" />
            <b>{synth.o2.semi > 0 ? '+' : ''}{synth.o2.semi}st</b>
          </span>
          <b>{Math.round(synth.o2.level * 100)}%</b>
        </div>
        <div className="row"><span>NOISE</span><b>{Math.round(synth.noise * 100)}%</b></div>
      </div>
      <div className="synth-card" onClick={() => setSynthTab('env')}>
        <h4>ENVELOPE</h4>
        <div className="flexfill">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d={envMini()} fill="none" stroke={LEAF} strokeWidth="1.6" />
          </svg>
        </div>
      </div>
      <div className="synth-card" onClick={() => setSynthTab('pitch')}>
        <h4>PITCH ENVELOPE</h4>
        <div className="flexfill">
          <svg viewBox="0 0 300 130" preserveAspectRatio="none">
            <line x1="8" x2="292" y1="65" y2="65" stroke="#202020" />
            <polyline points={pitchCurvePoints(synth.penv.start, synth.penv.end, synth.penv.time, synth.penv.bend, 300, 130, 8)} fill="none" stroke={SUN} strokeWidth="2.4" />
          </svg>
        </div>
      </div>
      <div className="synth-card" style={{ cursor: 'default' }}>
        <h4>SCOPE</h4>
        <div className="flexfill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Scope width={150} height={52} color="#9fd4a4" />
        </div>
      </div>
    </div>
  )
}

/* ---------------- container ---------------- */

export function SynthView() {
  const tab = useStore((s) => s.synthTab)
  const setSynthTab = useStore((s) => s.setSynthTab)

  return (
    <>
      <div className="subtabs">
        {(['main', 'osc', 'env', 'pitch'] as const).map((t) => (
          <button key={t} className={`subtab${tab === t ? ' active' : ''}`} onClick={() => setSynthTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'main' && <MainTab />}
      {tab === 'osc' && <OscPanel />}
      {tab === 'env' && <EnvelopeEditor />}
      {tab === 'pitch' && <PitchEnvEditor />}
    </>
  )
}
