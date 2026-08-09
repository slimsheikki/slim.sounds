import { useEffect } from 'react'
import { loadPersisted, useStore } from './state/store'
import { loadPersistedScene } from './state/sceneStore'
import { useGlobalKeys } from './hooks/useGlobalKeys'
import { LeftRail } from './components/LeftRail'
import { DisplayPanel } from './components/DisplayPanel'
import { Transport } from './components/Transport'
import { KnobRow } from './components/KnobRow'
import { FunctionGrid } from './components/FunctionGrid'
import { StepSeq } from './components/StepSeq'
import { Piano } from './components/Piano'
import { IconSun } from './components/icons'

export default function App() {
  useGlobalKeys()
  const dragOver = useStore((s) => s.dragOver)
  const mode = useStore((s) => s.mode)

  useEffect(() => {
    loadPersisted()
    loadPersistedScene()
  }, [])

  // drag & drop import — anywhere on the page
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      useStore.getState().setDragOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) useStore.getState().setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      useStore.getState().setDragOver(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) void useStore.getState().importFile(file)
    }
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <>
      <div className="shell">
        <LeftRail />
        <div className="main-col">
          <div className="display-row">
            <DisplayPanel />
            <Transport />
          </div>
          <div className="control-row">
            <KnobRow />
            <FunctionGrid />
          </div>
          {mode !== 'ambient' && <StepSeq />}
          <Piano />
        </div>
      </div>
      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-box">
            <IconSun size={30} color="var(--sun)" />
            DROP AUDIO HERE
            <span className="sub">WAV · MP3 · OGG · M4A — IT BECOMES YOUR SAMPLE</span>
          </div>
        </div>
      )}
    </>
  )
}
