import type { ReactNode } from 'react'
import { useStore } from '../state/store'
import type { Mode } from '../state/types'
import { Knob } from './Knob'
import { Energy } from './Energy'
import { IconExport, IconGrid, IconKeys, IconSine, IconSpark, IconSun, IconWave } from './icons'

const MODES: { id: Mode; label: string; icon: ReactNode; shortcut: string }[] = [
  { id: 'sample', label: 'SAMPLE', icon: <IconWave />, shortcut: '1' },
  { id: 'synth', label: 'SYNTH', icon: <IconSine />, shortcut: '2' },
  { id: 'keys', label: 'KEYS', icon: <IconKeys />, shortcut: '3' },
  { id: 'fx', label: 'FX', icon: <IconSpark />, shortcut: '4' },
  { id: 'seq', label: 'SEQ', icon: <IconGrid />, shortcut: '5' },
  { id: 'export', label: 'EXPORT', icon: <IconExport />, shortcut: '6' },
]

export function LeftRail() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)

  return (
    <div className="rail">
      <div className="brand">
        <div className="brand-row">
          <span className="brand-sun" style={{ color: 'var(--sun)' }}><IconSun size={17} /></span>
          <span className="brand-name">slim.sounds</span>
        </div>
        <div className="brand-tag">SOLAR SFX-1</div>
      </div>
      <div className="grille">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="vol-block">
        <Knob
          label="VOLUME"
          color="#efe9d8"
          utility
          size={58}
          value={volume}
          min={0}
          max={1}
          defaultValue={0.85}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={setVolume}
        />
      </div>
      <div className="mode-list">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn${mode === m.id ? ' active' : ''}`}
            onClick={() => setMode(m.id)}
            title={`${m.label.toLowerCase()} mode (${m.shortcut})`}
          >
            {m.icon}
            {m.label}
            <span className="led" />
          </button>
        ))}
      </div>
      <div className="rail-spacer" />
      <Energy />
    </div>
  )
}
