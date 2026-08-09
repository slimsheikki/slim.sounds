import { getCtx } from './context'

export interface RecorderHandles {
  analyser: AnalyserNode
  stop: () => Promise<AudioBuffer | null>
  cancel: () => void
  startedAt: number
}

/** Record from the microphone via MediaRecorder, decode to an AudioBuffer. */
export async function startRecording(maxSeconds = 30, onAutoStop?: () => void): Promise<RecorderHandles> {
  const ctx = getCtx()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  })

  const srcNode = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  srcNode.connect(analyser) // not connected to destination — no monitoring feedback

  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(
    (m) => m === '' || MediaRecorder.isTypeSupported(m),
  )
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  rec.start(150)

  let finished = false
  const cleanup = () => {
    stream.getTracks().forEach((t) => t.stop())
    try {
      srcNode.disconnect()
    } catch { /* noop */ }
  }

  const stop = (): Promise<AudioBuffer | null> =>
    new Promise((resolve) => {
      if (finished) return resolve(null)
      finished = true
      window.clearTimeout(autoTimer)
      rec.onstop = async () => {
        cleanup()
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const ab = await blob.arrayBuffer()
          if (ab.byteLength < 100) return resolve(null)
          const buf = await ctx.decodeAudioData(ab)
          resolve(buf)
        } catch {
          resolve(null)
        }
      }
      try {
        rec.stop()
      } catch {
        cleanup()
        resolve(null)
      }
    })

  const cancel = () => {
    if (finished) return
    finished = true
    window.clearTimeout(autoTimer)
    try {
      rec.stop()
    } catch { /* noop */ }
    cleanup()
  }

  const autoTimer = window.setTimeout(() => {
    if (!finished) onAutoStop?.()
  }, maxSeconds * 1000)

  return { analyser, stop, cancel, startedAt: ctx.currentTime }
}
