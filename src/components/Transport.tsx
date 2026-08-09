import { useEffect } from 'react'
import { useStore } from '../state/store'
import { engine } from '../audio/Engine'
import { IconLoop, IconPlay, IconRec, IconStop } from './icons'

export function Transport() {
  const playing = useStore((s) => s.playing)
  const seqPlaying = useStore((s) => s.seqPlaying)
  const recording = useStore((s) => s.recording)
  const loop = useStore((s) => s.patch.sampler.loop)
  const play = useStore((s) => s.play)
  const stop = useStore((s) => s.stop)
  const toggleLoop = useStore((s) => s.toggleLoop)
  const startRec = useStore((s) => s.startRec)
  const stopRec = useStore((s) => s.stopRec)

  // watch the one-shot playback and clear the PLAY light when it ends
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (!engine.playbackActive()) {
        useStore.setState({ playing: false })
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const isOn = playing || seqPlaying

  return (
    <div className="transport">
      <button className={`t-btn${isOn ? ' lit-play' : ''}`} onClick={play} title="play (space)">
        <IconPlay size={22} color="var(--leaf)" />
      </button>
      <button className="t-btn" onClick={stop} title="stop (space)">
        <IconStop size={19} color="#edede8" />
      </button>
      <button
        className={`t-btn${recording ? ' lit-rec' : ''}`}
        onClick={() => void (recording ? stopRec() : startRec())}
        title="record (R)"
      >
        <IconRec size={20} color="var(--amber)" />
      </button>
      <button className={`t-btn${loop ? ' lit-loop' : ''}`} onClick={toggleLoop} title="loop sample playback">
        <IconLoop size={20} color="#edede8" />
        <span className="loop-dot" />
      </button>
    </div>
  )
}
