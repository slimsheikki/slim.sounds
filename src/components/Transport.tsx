import { useEffect } from 'react'
import { useStore } from '../state/store'
import { useSceneStore } from '../state/sceneStore'
import { engine } from '../audio/Engine'
import { IconLoop, IconPlay, IconRec, IconStop } from './icons'

export function Transport() {
  const mode = useStore((s) => s.mode)
  const playing = useStore((s) => s.playing)
  const seqPlaying = useStore((s) => s.seqPlaying)
  const scenePlaying = useStore((s) => s.scenePlaying)
  const recording = useStore((s) => s.recording)
  const samplerLoop = useStore((s) => s.patch.sampler.loop)
  const sceneLoop = useSceneStore((s) => s.scene.loop)
  const toggleSampleLoop = useStore((s) => s.toggleLoop)
  const toggleSceneLoop = useSceneStore((s) => s.toggleLoop)
  const play = useStore((s) => s.play)
  const stop = useStore((s) => s.stop)
  const startRec = useStore((s) => s.startRec)
  const stopRec = useStore((s) => s.stopRec)

  const ambient = mode === 'ambient'
  const loop = ambient ? sceneLoop : samplerLoop
  const toggleLoop = ambient ? toggleSceneLoop : toggleSampleLoop

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

  const isOn = playing || seqPlaying || scenePlaying

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
      <button
        className={`t-btn${loop ? ' lit-loop' : ''}`}
        onClick={toggleLoop}
        title={ambient ? 'loop the scene forever' : 'loop sample playback'}
      >
        <IconLoop size={20} color="#edede8" />
        <span className="loop-dot" />
      </button>
    </div>
  )
}
