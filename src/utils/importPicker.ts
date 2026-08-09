import { useStore } from '../state/store'

/** Open a native file dialog and load the chosen audio file as the sample. */
export function openImportDialog() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aiff,.webm'
  input.onchange = () => {
    const f = input.files?.[0]
    if (f) void useStore.getState().importFile(f)
  }
  input.click()
}
