import { useStore } from '../state/store'
import { PRESETS } from '../audio/presets'

const CATS: { id: 'UI' | 'MOVE' | 'COMBAT' | 'GAME' | 'SOLAR'; label: string; color: string }[] = [
  { id: 'UI', label: 'INTERFACE', color: '#55aae8' },
  { id: 'MOVE', label: 'MOVEMENT', color: '#62c46f' },
  { id: 'COMBAT', label: 'COMBAT', color: '#e85c4a' },
  { id: 'GAME', label: 'GAMEPLAY', color: '#ffc940' },
  { id: 'SOLAR', label: 'SOLARPUNK', color: '#f2823f' },
]

export function PresetsOverlay() {
  const setPresetsOpen = useStore((s) => s.setPresetsOpen)
  const applyPreset = useStore((s) => s.applyPreset)
  const activePresetId = useStore((s) => s.activePresetId)

  return (
    <div className="presets-overlay">
      <div className="presets-head">
        <h3>PRESETS · STARTING POINTS, NOT ENDINGS</h3>
        <button className="chip-btn" onClick={() => setPresetsOpen(false)}>CLOSE</button>
      </div>
      <div className="presets-body">
        {CATS.map((cat) => (
          <div key={cat.id}>
            <div className="preset-cat" style={{ color: cat.color }}>{cat.label}</div>
            <div className="preset-list">
              {PRESETS.filter((p) => p.cat === cat.id).map((p) => (
                <button
                  key={p.id}
                  className={`preset-btn${activePresetId === p.id ? ' active' : ''}`}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
