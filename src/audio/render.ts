import type { ExportSettings, Patch } from '../state/types'
import { EffectsChain } from './EffectsChain'
import { normalizeBuffer, trimTail } from './context'
import { SamplerVoice, SynthVoice } from './voices'
import { stepDurSec, synthHold } from './Engine'
import { clamp } from '../utils/misc'

function sampleRegionDur(patch: Patch, buffer: AudioBuffer | null): number {
  if (!buffer) return 0.5
  const sp = patch.sampler
  const region = Math.max(0.003, Math.abs(sp.end - sp.start) * buffer.duration)
  const rate = clamp(sp.speed * Math.pow(2, sp.pitch / 12), 0.03, 16)
  return region / rate
}

/** Predicted length in seconds of the exported file (pre-trim). */
export function estimateRenderSeconds(patch: Patch, buffer: AudioBuffer | null, opts: ExportSettings, bpm: number): number {
  let baseDur = 0.5
  if (opts.source === 'seq') {
    const dur = stepDurSec(bpm, patch.seq.rate)
    baseDur = patch.seq.length * dur + (patch.soundSource === 'sample' ? sampleRegionDur(patch, buffer) : patch.synth.adsr.r + 0.2)
  } else if (patch.soundSource === 'sample') {
    baseDur = sampleRegionDur(patch, buffer)
  } else {
    const { adsr, penv } = patch.synth
    baseDur = Math.max(synthHold(patch) + adsr.r + 0.1, penv.time + 0.15)
  }
  return Math.min(40, baseDur + EffectsChain.tailSeconds(patch.fx) + 0.15)
}

/** Render the current sound (or one sequencer loop) offline through the FX chain. */
export async function renderCurrent(
  patch: Patch,
  buffer: AudioBuffer | null,
  opts: ExportSettings,
  bpm: number,
): Promise<AudioBuffer | null> {
  const t0 = 0.02
  if (opts.source !== 'seq' && patch.soundSource === 'sample' && !buffer) return null

  const total = estimateRenderSeconds(patch, buffer, opts, bpm)
  const octx = new OfflineAudioContext(opts.channels, Math.ceil(total * opts.rate), opts.rate)
  const chain = new EffectsChain(octx, true)
  await chain.ready
  chain.update(patch.fx, true)
  chain.output.connect(octx.destination)

  const spawnAt = (midi: number, t: number, gate: number) => {
    if (patch.soundSource === 'sample') {
      if (!buffer) return
      new SamplerVoice(octx, chain.input, buffer, patch.sampler, patch.synth.penv, midi, 1, t, false)
    } else {
      const v = new SynthVoice(octx, chain.input, patch.synth, midi, 1, t)
      v.release(t + gate)
    }
  }

  if (opts.source === 'seq') {
    const dur = stepDurSec(bpm, patch.seq.rate)
    const grid = patch.seq.patterns[patch.seq.pattern]
    const len = clamp(patch.seq.length, 1, 16)
    for (let s = 0; s < len; s++) {
      const swingOff = s % 2 === 1 ? patch.seq.swing * dur * 0.5 : 0
      for (let r = 0; r < grid.length; r++) {
        if (grid[r][s]) {
          spawnAt(patch.seq.root + patch.seq.offsets[r], t0 + s * dur + swingOff, Math.max(0.03, dur * patch.seq.gate))
        }
      }
    }
  } else {
    spawnAt(patch.soundSource === 'sample' ? 60 : patch.seq.root, t0, synthHold(patch))
  }

  let rendered = await octx.startRendering()
  rendered = trimTail(rendered)
  if (opts.normalize) rendered = normalizeBuffer(rendered)
  return rendered
}
