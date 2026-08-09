import { useEffect } from 'react'
import { useStore } from '../state/store'
import { useKeysStore } from '../state/keyboardStore'
import type { Mode } from '../state/types'

const MODE_KEYS: Record<string, Mode> = {
  Digit1: 'sample',
  Digit2: 'synth',
  Digit3: 'keys',
  Digit4: 'fx',
  Digit5: 'seq',
  Digit6: 'export',
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * One keyboard, two jobs: playing notes (custom mapping wins) and app shortcuts.
 * A mapped key always plays — shortcuts only live on unmapped keys or behind modifiers.
 */
export function useGlobalKeys() {
  useEffect(() => {
    const playedByCode = new Map<string, number>()

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const st = useStore.getState()
      const code = e.code
      const mod = e.metaKey || e.ctrlKey

      if (e.key === 'Shift') st.setShiftHeld(true)

      // undo / redo
      if (mod && code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (mod) return // leave other browser shortcuts alone

      if (code === 'Space') {
        e.preventDefault()
        if (e.repeat) return
        if (st.recording) {
          void st.stopRec()
        } else if (st.playing || st.seqPlaying) {
          st.stop()
        } else {
          st.play()
        }
        return
      }

      if (code === 'Escape') {
        if (st.recording) void st.stopRec(true)
        else if (st.presetsOpen) st.setPresetsOpen(false)
        else if (st.keySelection) st.setKeySelection(null)
        else st.stop()
        return
      }

      // shift-shortcuts (these never collide with playing — mapping ignores shifted keys)
      if (e.shiftKey) {
        if (code === 'KeyA') { st.switchAB('A'); return }
        if (code === 'KeyB') { st.switchAB('B'); return }
        if (code === 'KeyE') { st.setMode('export'); return }
        if (code === 'KeyL') { st.toggleLoop(); return }
      }

      // the piano mapping has priority over everything below
      const mapping = useKeysStore.getState().mapping
      const mapped = !e.shiftKey && mapping[code] !== undefined

      // in KEYS mode, pressing a physical key also selects it in the editor
      if (st.mode === 'keys' && !e.repeat && /^(Key|Digit|Semicolon|Quote|Comma|Period|Slash|Bracket|Minus|Equal)/.test(code)) {
        st.setKeySelection(code)
      }

      if (mapped) {
        e.preventDefault()
        if (e.repeat || playedByCode.has(code)) return
        const midi = mapping[code] + (st.octave - 4) * 12
        playedByCode.set(code, midi)
        st.noteOn(code, midi)
        return
      }

      if (e.repeat) return

      // unmapped keys → shortcuts
      const mode = MODE_KEYS[code]
      if (mode) {
        st.setMode(mode)
        return
      }
      switch (code) {
        case 'KeyR':
          void (st.recording ? st.stopRec() : st.startRec())
          break
        case 'KeyM':
          st.mutateSound()
          break
        case 'KeyZ':
          st.setOctave(st.octave - 1)
          break
        case 'KeyX':
          st.setOctave(st.octave + 1)
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const st = useStore.getState()
      if (e.key === 'Shift') st.setShiftHeld(false)
      const midi = playedByCode.get(e.code)
      if (midi !== undefined) {
        playedByCode.delete(e.code)
        st.noteOff(e.code)
        st.heldRemove(midi)
      }
    }

    const onBlur = () => {
      const st = useStore.getState()
      for (const [code, midi] of playedByCode) {
        st.noteOff(code)
        st.heldRemove(midi)
      }
      playedByCode.clear()
      st.setShiftHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
