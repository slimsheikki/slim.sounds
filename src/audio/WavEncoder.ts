/** Encode an AudioBuffer as a PCM WAV blob (16 or 24-bit). */
export function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24): Blob {
  const numCh = buffer.numberOfChannels
  const len = buffer.length
  const rate = buffer.sampleRate
  const bytesPerSample = bitDepth / 8
  const blockAlign = numCh * bytesPerSample
  const dataSize = len * blockAlign
  const ab = new ArrayBuffer(44 + dataSize)
  const dv = new DataView(ab)

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  dv.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, numCh, true)
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate * blockAlign, true)
  dv.setUint16(32, blockAlign, true)
  dv.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  dv.setUint32(40, dataSize, true)

  const chans: Float32Array[] = []
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c))

  let off = 44
  if (bitDepth === 16) {
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        off += 2
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        const v = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff)
        dv.setUint8(off, v & 0xff)
        dv.setUint8(off + 1, (v >> 8) & 0xff)
        dv.setUint8(off + 2, (v >> 16) & 0xff)
        off += 3
      }
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}
