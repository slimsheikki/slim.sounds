import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../state/store'
import { useSceneStore } from '../../state/sceneStore'
import { LAYER_DEFS, LAYER_ORDER, type Track } from '../../state/ambientTypes'
import { ambientEngine } from '../../audio/AmbientEngine'
import { eventRate } from '../../audio/ambientVoices'
import { MiniDrag } from '../MiniDrag'
import { IconExport } from '../icons'
import { clamp } from '../../utils/misc'

/* ---------------- clip texture (drawn in the track colour) ---------------- */

function ContinuousTexture({ color }: { color: string }) {
  // a soft repeating sine — the "~~~~" of the sketch
  const periods = 16
  const pts: string[] = []
  const N = 120
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * 100
    const y = 10 - Math.sin((i / N) * periods * Math.PI * 2) * 5.5
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return (
    <svg className="clip-tex" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.1" vectorEffect="non-scaling-stroke" opacity="0.85" />
    </svg>
  )
}

function SparkTexture({ color, len, motion }: { color: string; len: number; motion: number }) {
  const count = clamp(Math.round(len * eventRate(motion)), 1, 60)
  const marks = []
  for (let i = 0; i < count; i++) {
    // deterministic scatter so it doesn't jump on every render
    const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1
    const x = ((i + 0.5) / count) * 100 + jitter * (40 / count)
    const y = 10 + Math.cos(i * 2.3) * 3.5
    marks.push(<circle key={i} cx={clamp(x, 1, 99)} cy={y} r={1.7} fill={color} />)
  }
  return (
    <svg className="clip-tex" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      {marks}
    </svg>
  )
}

/* ---------------- one lane ---------------- */

function Lane({ track }: { track: Track }) {
  const scene = useSceneStore((s) => s.scene)
  const selectedId = useSceneStore((s) => s.selectedId)
  const select = useSceneStore((s) => s.select)
  const moveClip = useSceneStore((s) => s.moveClip)
  const resizeClip = useSceneStore((s) => s.resizeClip)
  const toggleMute = useSceneStore((s) => s.toggleMute)
  const removeTrack = useSceneStore((s) => s.removeTrack)
  const updateTrack = useSceneStore((s) => s.updateTrack)
  const begin = useSceneStore((s) => s.beginGesture)
  const end = useSceneStore((s) => s.endGesture)

  const def = LAYER_DEFS[track.type]
  const dur = scene.duration
  const selected = selectedId === track.id
  const leftPct = (track.clip.start / dur) * 100
  const widthPct = (track.clip.len / dur) * 100

  const drag = (kind: 'move' | 'l' | 'r') => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const bodyEl = (e.currentTarget as HTMLElement).closest('.atl-body') as HTMLElement | null
    if (!bodyEl) return
    const rect = bodyEl.getBoundingClientRect()
    const secPerPx = dur / rect.width
    const startClip = { ...track.clip }
    const grabSec = (e.clientX - rect.left) * secPerPx
    select(track.id)
    begin()
    const move = (ev: PointerEvent) => {
      const cur = clamp((ev.clientX - rect.left) * secPerPx, 0, dur)
      if (kind === 'move') moveClip(track.id, startClip.start + (cur - grabSec))
      else if (kind === 'l') {
        const ns = clamp(cur, 0, startClip.start + startClip.len - 0.5)
        resizeClip(track.id, ns, startClip.start + startClip.len - ns)
      } else {
        resizeClip(track.id, startClip.start, clamp(cur - startClip.start, 0.5, dur - startClip.start))
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      end()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className={`atl-lane${selected ? ' sel' : ''}${track.muted ? ' muted' : ''}`} onPointerDown={() => select(track.id)}>
      <div className="atl-lane-head" style={{ ['--tc' as string]: track.color }}>
        <button
          className={`lane-dot${track.muted ? ' off' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleMute(track.id)}
          title={track.muted ? 'un-mute' : 'mute'}
        />
        <span className="lane-name">{track.name}</span>
        {selected ? (
          <>
            <MiniDrag
              className="lane-pitch"
              value={track.pitch}
              min={-24}
              max={24}
              step={1}
              format={(v) => `${v > 0 ? '+' : ''}${v}`}
              onChange={(v) => updateTrack(track.id, { pitch: v })}
              onGestureStart={begin}
              onGestureEnd={end}
            />
            <button
              className="lane-x"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => removeTrack(track.id)}
              title="remove layer"
            >
              ×
            </button>
          </>
        ) : (
          <span className="lane-blurb">{def.blurb}</span>
        )}
      </div>
      <div className="atl-body">
        <div
          className="atl-clip"
          style={{ left: `${leftPct}%`, width: `${widthPct}%`, ['--tc' as string]: track.color }}
          onPointerDown={drag('move')}
        >
          {def.continuous ? (
            <ContinuousTexture color={track.color} />
          ) : (
            <SparkTexture color={track.color} len={track.clip.len} motion={track.motion} />
          )}
          <span className="clip-handle l" onPointerDown={drag('l')} />
          <span className="clip-handle r" onPointerDown={drag('r')} />
          {def.continuous && <span className="clip-loop" title="loops for the whole clip">∞</span>}
        </div>
      </div>
    </div>
  )
}

/* ---------------- ruler ---------------- */

function Ruler() {
  const dur = useSceneStore((s) => s.scene.duration)
  const step = dur <= 16 ? 2 : dur <= 32 ? 5 : 10
  const ticks: number[] = []
  for (let s = 0; s <= dur + 0.001; s += step) ticks.push(s)
  return (
    <div className="atl-ruler">
      <div className="atl-lane-head atl-ruler-head">
        <span>0s</span>
        <span className="atl-ruler-end">{dur}s</span>
      </div>
      <div className="atl-body atl-ruler-body">
        {ticks.map((t) => (
          <span key={t} className="atl-tick" style={{ left: `${(t / dur) * 100}%` }}>
            <i />
            <b>{t}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- add-layer palette ---------------- */

function AddLayer() {
  const addTrack = useSceneStore((s) => s.addTrack)
  const count = useSceneStore((s) => s.scene.tracks.length)
  const [open, setOpen] = useState(false)
  const full = count >= 9

  return (
    <div className="atl-add">
      <button className="chip-btn add-btn" disabled={full} onClick={() => setOpen((o) => !o)}>
        ＋ LAYER
      </button>
      {open && !full && (
        <div className="atl-palette">
          {LAYER_ORDER.map((type) => {
            const d = LAYER_DEFS[type]
            return (
              <button
                key={type}
                className="palette-chip"
                style={{ ['--tc' as string]: d.color }}
                onClick={() => { addTrack(type); setOpen(false) }}
                title={d.blurb}
              >
                <i />
                {d.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------------- header ---------------- */

function Header() {
  const scene = useSceneStore((s) => s.scene)
  const setDuration = useSceneStore((s) => s.setDuration)
  const toggleLofi = useSceneStore((s) => s.toggleLofi)
  const begin = useSceneStore((s) => s.beginGesture)
  const end = useSceneStore((s) => s.endGesture)
  const exportScene = useStore((s) => s.exportScene)
  const exporting = useStore((s) => s.exporting)
  const scenePlaying = useStore((s) => s.scenePlaying)

  return (
    <div className="atl-head">
      <div className="atl-title">
        <span className="atl-eyebrow">AMBIENCE</span>
        <span className="atl-scene">{scene.name.toUpperCase()}</span>
      </div>
      <div className="atl-head-ctrl">
        <span className="atl-field">
          <label>LENGTH</label>
          <MiniDrag
            className="atl-val"
            value={scene.duration}
            min={6}
            max={60}
            step={1}
            format={(v) => `${v}s`}
            onChange={setDuration}
            onGestureStart={begin}
            onGestureEnd={end}
            travel={200}
          />
        </span>
        <button className={`chip-btn${scene.lofi ? ' leaf-lit' : ''}`} onClick={toggleLofi} title="90s / Y2K tape colouring">
          90s LOFI
        </button>
        <button className="chip-btn export-chip" disabled={exporting} onClick={() => void exportScene()}>
          <IconExport size={11} /> {exporting ? 'RENDERING…' : 'EXPORT LOOP'}
        </button>
        <span className={`atl-play-state${scenePlaying ? ' on' : ''}`}>{scenePlaying ? '● LOOPING' : '○ IDLE'}</span>
      </div>
    </div>
  )
}

/* ---------------- container ---------------- */

export function AmbientTimeline() {
  const tracks = useSceneStore((s) => s.scene.tracks)
  const selectedId = useSceneStore((s) => s.selectedId)
  const select = useSceneStore((s) => s.select)
  const scenePlaying = useStore((s) => s.scenePlaying)
  const lanesRef = useRef<HTMLDivElement>(null)

  // keep a layer selected so the four knobs are always live
  useEffect(() => {
    if (!selectedId && tracks.length) select(tracks[0].id)
  }, [selectedId, tracks, select])

  useEffect(() => {
    if (!scenePlaying) {
      lanesRef.current?.style.setProperty('--ph', '0')
      return
    }
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const ph = ambientEngine.phase()
      if (ph >= 0) lanesRef.current?.style.setProperty('--ph', String(ph))
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scenePlaying])

  return (
    <div className="atl">
      <Header />
      <div className={`atl-lanes${scenePlaying ? ' playing' : ''}`} ref={lanesRef}>
        <Ruler />
        {tracks.length === 0 ? (
          <div className="atl-empty">
            <span className="big">EMPTY SCENE</span>
            <span className="hint">stack a few layers, drag their clips along the timeline, press play — it loops forever</span>
          </div>
        ) : (
          tracks.map((t) => <Lane key={t.id} track={t} />)
        )}
        <div className="atl-playhead" />
      </div>
      <div className="atl-foot">
        <AddLayer />
        <span className="atl-hint">drag clip bodies to move · edges to resize · the four knobs shape the selected layer</span>
      </div>
    </div>
  )
}
