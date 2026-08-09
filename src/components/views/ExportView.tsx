import { useStore } from '../../state/store'
import { estimateRenderSeconds } from '../../audio/render'
import { sanitizeFilename } from '../../utils/misc'
import { IconExport } from '../icons'

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`chip-btn${active ? ' lit' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

export function ExportView() {
  const settings = useStore((s) => s.exportSettings)
  const setExportSettings = useStore((s) => s.setExportSettings)
  const exportWav = useStore((s) => s.exportWav)
  const exporting = useStore((s) => s.exporting)
  const patch = useStore((s) => s.patch)
  const buffer = useStore((s) => s.buffer)
  const bpm = useStore((s) => s.bpm)

  const est = estimateRenderSeconds(patch, buffer, settings, bpm)
  const seqHasSteps = patch.seq.patterns[patch.seq.pattern].some((row) => row.some(Boolean))

  return (
    <div className="exportv">
      <div className="exp-form">
        <div className="exp-field">
          <label>SFX NAME</label>
          <input
            className="exp-name"
            value={settings.name}
            spellCheck={false}
            onChange={(e) => setExportSettings({ name: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="exp-field">
          <label>SOURCE</label>
          <div className="exp-chips">
            <Chip active={settings.source === 'sound'} label={patch.soundSource === 'sample' ? 'SAMPLE' : 'SYNTH NOTE'} onClick={() => setExportSettings({ source: 'sound' })} />
            <Chip active={settings.source === 'seq'} label={`SEQUENCE${seqHasSteps ? '' : ' (EMPTY)'}`} onClick={() => setExportSettings({ source: 'seq' })} />
          </div>
        </div>
        <div className="exp-field">
          <label>SAMPLE RATE</label>
          <div className="exp-chips">
            <Chip active={settings.rate === 44100} label="44.1 kHz" onClick={() => setExportSettings({ rate: 44100 })} />
            <Chip active={settings.rate === 48000} label="48 kHz" onClick={() => setExportSettings({ rate: 48000 })} />
          </div>
        </div>
        <div className="exp-field">
          <label>BIT DEPTH / CHANNELS</label>
          <div className="exp-chips">
            <Chip active={settings.depth === 16} label="16 BIT" onClick={() => setExportSettings({ depth: 16 })} />
            <Chip active={settings.depth === 24} label="24 BIT" onClick={() => setExportSettings({ depth: 24 })} />
            <span style={{ width: 8 }} />
            <Chip active={settings.channels === 1} label="MONO" onClick={() => setExportSettings({ channels: 1 })} />
            <Chip active={settings.channels === 2} label="STEREO" onClick={() => setExportSettings({ channels: 2 })} />
          </div>
        </div>
        <div className="exp-field">
          <label>NORMALIZE</label>
          <div className="exp-chips">
            <Chip active={settings.normalize} label="ON" onClick={() => setExportSettings({ normalize: true })} />
            <Chip active={!settings.normalize} label="OFF" onClick={() => setExportSettings({ normalize: false })} />
          </div>
        </div>
      </div>
      <div className="exp-side">
        <button className="export-big" onClick={() => void exportWav()} disabled={exporting}>
          <IconExport size={15} color="#201803" />
          {exporting ? 'RENDERING…' : 'EXPORT WAV'}
        </button>
        <div className="exp-summary">
          <b>{sanitizeFilename(settings.name)}.wav</b>
          <br />
          ~{est.toFixed(2)}s · {settings.rate === 48000 ? '48' : '44.1'}kHz · {settings.depth}bit · {settings.channels === 1 ? 'mono' : 'stereo'}
          <br />
          drops straight into your game project ☀
        </div>
      </div>
    </div>
  )
}
