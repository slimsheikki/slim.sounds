import { useStore } from '../state/store'
import { useSceneStore } from '../state/sceneStore'
import { PRESETS } from '../audio/presets'
import { SCENE_PRESETS } from '../state/ambientTypes'

const CATS: { id: 'UI' | 'MOVE' | 'COMBAT' | 'GAME' | 'SOLAR'; label: string; color: string }[] = [
  { id: 'UI', label: 'INTERFACE', color: '#3e9be0' },
  { id: 'MOVE', label: 'MOVEMENT', color: '#56be68' },
  { id: 'COMBAT', label: 'COMBAT', color: '#e85c4a' },
  { id: 'GAME', label: 'GAMEPLAY', color: '#f5c543' },
  { id: 'SOLAR', label: 'SOLARPUNK', color: '#ee5a2c' },
]

function ScenePresets() {
  const setPresetsOpen = useStore((s) => s.setPresetsOpen)
  const applyScenePreset = useSceneStore((s) => s.applyScenePreset)
  const active = useSceneStore((s) => s.activePreset)

  return (
    <div className="presets-overlay">
      <div className="presets-head">
        <h3>AMBIENCE SCENES · DROP IN, THEN RESHAPE</h3>
        <button className="chip-btn" onClick={() => setPresetsOpen(false)}>CLOSE</button>
      </div>
      <div className="presets-body">
        <div className="preset-cat" style={{ color: '#56be68' }}>GAME ATMOSPHERES</div>
        <div className="scene-preset-list">
          {SCENE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`scene-preset-btn${active === p.id ? ' active' : ''}`}
              onClick={() => applyScenePreset(p.id)}
            >
              <b>{p.name}</b>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PresetsOverlay() {
  const mode = useStore((s) => s.mode)
  const setPresetsOpen = useStore((s) => s.setPresetsOpen)
  const applyPreset = useStore((s) => s.applyPreset)
  const activePresetId = useStore((s) => s.activePresetId)

  if (mode === 'ambient') return <ScenePresets />

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
