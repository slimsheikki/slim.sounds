import type { ReactNode } from 'react'
import { useStore } from '../state/store'
import { useKeysStore } from '../state/keyboardStore'
import { fmtHz, fmtSecs } from '../utils/misc'
import { midiName } from '../utils/notes'
import { Meter, Scope } from './Scope'
import { SampleView } from './views/SampleView'
import { SynthView } from './views/SynthView'
import { FxView } from './views/FxView'
import { SeqView } from './views/SeqView'
import { KeysView } from './views/KeysView'
import { ExportView } from './views/ExportView'
import { RecordOverlay } from './views/RecordOverlay'
import { PresetsOverlay } from './PresetsOverlay'
import { FX_META } from './views/FxView'
import { AmbientTimeline } from './views/AmbientTimeline'

const MODE_TITLES: Record<string, string> = {
  sample: 'SAMPLER',
  synth: 'SYNTH',
  keys: 'KEY MAP',
  fx: 'EFFECTS',
  seq: 'SEQUENCER',
  export: 'EXPORT',
}

function InfoLines() {
  const st = useStore()
  const mapping = useKeysStore((s) => s.mapping)
  const p = st.patch
  const lines: [string, string][] = []
  let foot: ReactNode = null

  if (st.mode === 'sample') {
    lines.push(['SOUND', p.sampleName ? p.sampleName.slice(0, 14) : '—'])
    lines.push(['LEN', st.buffer ? fmtSecs(st.buffer.duration) : '—'])
    lines.push(['START', `${(Math.min(p.sampler.start, p.sampler.end) * 100).toFixed(1)}%`])
    lines.push(['END', `${(Math.max(p.sampler.start, p.sampler.end) * 100).toFixed(1)}%`])
    lines.push(['PITCH', `${p.sampler.pitch > 0 ? '+' : ''}${p.sampler.pitch}st`])
    lines.push(['SPEED', `${p.sampler.speed.toFixed(2)}x`])
    lines.push(['REVERSE', p.sampler.reverse ? 'ON' : 'OFF'])
    foot = <>drag the <em>markers</em> · wheel zooms · play keys to pitch it</>
  } else if (st.mode === 'synth' || st.mode === 'keys') {
    if (st.mode === 'keys') {
      lines.push(['MAPPED', `${Object.keys(mapping).length} keys`])
      lines.push(['OCTAVE', String(st.octave)])
      lines.push(['VEL', `${Math.round(st.velocity * 100)}%`])
      foot = <>your laptop <em>is</em> the instrument — lay it out your way</>
    } else {
      lines.push(['OSC 1', `${p.synth.o1.wave.slice(0, 3).toUpperCase()} ${p.synth.o1.semi > 0 ? '+' : ''}${p.synth.o1.semi}`])
      lines.push(['OSC 2', p.synth.o2.level > 0.001 ? `${p.synth.o2.wave.slice(0, 3).toUpperCase()} ${p.synth.o2.semi > 0 ? '+' : ''}${p.synth.o2.semi}` : 'OFF'])
      lines.push(['NOISE', `${Math.round(p.synth.noise * 100)}%`])
      lines.push(['ENV', `${fmtSecs(p.synth.adsr.a)} ${fmtSecs(p.synth.adsr.d)}`])
      lines.push(['P.ENV', p.synth.penv.start === p.synth.penv.end ? 'FLAT' : `${p.synth.penv.start > 0 ? '+' : ''}${p.synth.penv.start}→${p.synth.penv.end > 0 ? '+' : ''}${p.synth.penv.end}`])
      lines.push(['FILTER', fmtHz(p.fx.filter.cutoff)])
      foot = <>press some keys — <em>mutate</em> when curious</>
    }
  } else if (st.mode === 'fx') {
    const sel = FX_META.find((m) => m.id === st.selectedFx)
    lines.push(['CHAIN', `${Object.values(p.fx).filter((f) => f.on).length}/7 ON`])
    lines.push(['EDIT', sel?.name ?? '—'])
    if (st.selectedFx === 'filter') {
      lines.push(['TYPE', p.fx.filter.type === 'lowpass' ? 'LP 12' : p.fx.filter.type === 'highpass' ? 'HP 12' : 'BP 12'])
      lines.push(['CUT', fmtHz(p.fx.filter.cutoff)])
    }
    foot = <>tiny chain, big character — <em>less is more</em></>
  } else if (st.mode === 'seq') {
    lines.push(['PATTERN', String(p.seq.pattern + 1).padStart(2, '0')])
    lines.push(['LENGTH', String(p.seq.length)])
    lines.push(['RATE', ['1/4', '1/8', '1/16', '1/32'][[4, 8, 16, 32].indexOf(p.seq.rate)] ?? '1/16'])
    lines.push(['SWING', `${Math.round(p.seq.swing * 100)}%`])
    lines.push(['ROOT', midiName(p.seq.root)])
    foot = <>coins, arps, alarms — <em>paint a few steps</em></>
  } else {
    lines.push(['FILE', `${st.exportSettings.name.slice(0, 13)}`])
    lines.push(['FORMAT', 'WAV'])
    lines.push(['RATE', st.exportSettings.rate === 48000 ? '48 kHz' : '44.1 kHz'])
    lines.push(['DEPTH', `${st.exportSettings.depth} bit`])
    lines.push(['CHAN', st.exportSettings.channels === 1 ? 'MONO' : 'STEREO'])
    lines.push(['NORM', st.exportSettings.normalize ? 'ON' : 'OFF'])
    foot = <>game-ready audio, <em>zero friction</em></>
  }

  return (
    <div className="disp-left">
      <div className="disp-mode">{MODE_TITLES[st.mode]}</div>
      {lines.map(([k, v]) => (
        <div className="disp-line" key={k}>
          <span className="lab">{k}</span>
          <b>{v}</b>
        </div>
      ))}
      <div className="disp-foot">{foot}</div>
    </div>
  )
}

function TopBar() {
  const bpm = useStore((s) => s.bpm)
  const playing = useStore((s) => s.playing)
  const seqPlaying = useStore((s) => s.seqPlaying)
  const scenePlaying = useStore((s) => s.scenePlaying)
  const recording = useStore((s) => s.recording)
  const exporting = useStore((s) => s.exporting)
  const soundSource = useStore((s) => s.patch.soundSource)

  const on = playing || seqPlaying || scenePlaying
  const state = exporting ? 'EXPORTING' : recording ? 'RECORDING' : on ? 'PLAYING' : 'IDLE'
  const cls = exporting ? 'exporting' : recording ? 'recording' : on ? 'playing' : ''

  return (
    <div className="disp-topbar">
      <span className="bpm">♩ <b>{bpm.toFixed(1)}</b> · 4/4</span>
      <span style={{ color: 'var(--ink-faint)' }}>SRC {soundSource.toUpperCase()}</span>
      <span className={`state-chip ${cls}`}><i />{state}</span>
    </div>
  )
}

function RightPanel() {
  const held = useStore((s) => s.held)
  const speed = useStore((s) => s.patch.sampler.speed)
  const mode = useStore((s) => s.mode)

  return (
    <div className="disp-right">
      <Scope width={96} height={40} />
      <div className="stat"><span>LEVEL</span></div>
      <div className="meter-wrap">
        <Meter />
        <div className="meter-side"><span>0</span><span>-12</span><span>-24</span><span>-∞</span></div>
      </div>
      {mode === 'sample' ? (
        <div className="stat"><span>PLAYBK</span><b>{speed.toFixed(2)}x</b></div>
      ) : (
        <div className="stat"><span>VOICE</span><b>{String(held.length).padStart(2, '0')}</b></div>
      )}
    </div>
  )
}

export function DisplayPanel() {
  const mode = useStore((s) => s.mode)
  const recording = useStore((s) => s.recording)
  const presetsOpen = useStore((s) => s.presetsOpen)
  const toast = useStore((s) => s.toast)

  if (mode === 'ambient') {
    return (
      <div className="display">
        <div className="display-inner ambient">
          <AmbientTimeline />
          {recording && <RecordOverlay />}
          {presetsOpen && <PresetsOverlay />}
          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="display">
      <div className="display-inner">
        <InfoLines />
        <div className="disp-center">
          <TopBar />
          <div className="disp-view">
            {mode === 'sample' && <SampleView />}
            {mode === 'synth' && <SynthView />}
            {mode === 'keys' && <KeysView />}
            {mode === 'fx' && <FxView />}
            {mode === 'seq' && <SeqView />}
            {mode === 'export' && <ExportView />}
          </div>
          {recording && <RecordOverlay />}
          {presetsOpen && <PresetsOverlay />}
          {toast && <div className="toast">{toast}</div>}
        </div>
        <RightPanel />
      </div>
    </div>
  )
}
