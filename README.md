# slim.sounds · SOLAR SFX-1

An online soundmaker for video game sfx **and** ambience — a solar-punk hardware instrument that lives fullscreen in your browser.

![Ambient timeline](docs/screenshot.png)

**slim.sounds** is not a DAW. It's a focused instrument for game audio with two hearts:

```
AMBIENCE   stack looping layers on a timeline → a scene that plays forever → export a seamless loop
SFX        record / synth something → twist it → make it weird → export a one-shot WAV
```

Build a rainy alley or a solar-charged space station by layering wind, drones, rain and sparkle on a timeline — then drop the looping WAV straight into your game. Or record a "clack" and turn it into a futuristic UI click; hit a mug and make it a sci-fi impact.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build (dist/)
```

Everything runs client-side on the Web Audio API — no backend, no accounts, no uploads.

## The instrument

- **AMBIENCE** — a generative timeline for futuristic ambient beds. Stack up to nine looping **layers** (WIND · DRONE · PAD · RAIN · WATER · HUM · SURGE · SPARK · BELLS), each a live synthesis voice — sustained textures draw as `~~~`, sparse event layers as scattered `* *`. Drag clip bodies to move, edges to resize; the four knobs sculpt the selected layer (LEVEL / TONE / MOTION / SPACE). Press play and the scene loops forever with soft per-clip crossfades. A **90s LOFI** master (tape-ish bitcrush + gentle lowpass + chorus + plate reverb) gives it that early-2000s game-CD feel. **EXPORT LOOP** renders a seamless WAV — game background music, ready to drop in. Eight scene presets (Forest Dawn, Space Station, Rainy Alley, Crystal Cave, Underwater, Menu Loop, Ancient Ruins, Solar Field) are starting points.
- **SAMPLE** — record from the mic, drop in audio files (WAV/MP3/OGG/M4A…), then trim, crop, zoom, reverse, normalize, fade, re-pitch and re-speed on a tactile waveform editor.
- **SYNTH** — two oscillators (sine/tri/saw/square) + noise, a draggable ADSR envelope, and a dedicated **pitch envelope** (the secret to zaps, falls, rises and power-ups).
- **KEYS** — your laptop keyboard is the instrument. Fully remappable: click a key, assign any note (or just press a key, then tap a piano key to bind it). Layouts save to local storage.
- **FX** — filter → drive → bitcrusher → chorus → delay → reverb → EQ. Pick a block; the four knobs shape it.
- **SEQ** — a 16-step, 4-row sequencer where each row fires the current sound at its own pitch offset. Coins, arps, alarms, machines. Four patterns, swing, gate, tap tempo.
- **EXPORT** — one button, one game-ready file: WAV 16/24-bit, 44.1/48 kHz, mono/stereo, optional normalize, editable filename. Renders offline through the full FX chain and trims the tail.

Plus: **presets** (starting points across UI / movement / combat / gameplay / solarpunk), **MUTATE** (smart randomization within sensible ranges), **undo/redo**, **A/B compare**, and a little solar meter that charges off the sounds you make.

![SFX sampler](docs/screenshot-sfx.png)

## Keys & shortcuts

| Key | Action |
| --- | --- |
| `A W S E D F T G Y H U J K O L P ; '` | play notes (default layout, remappable in KEYS) |
| `space` | play / stop (loops the scene in AMBIENCE) |
| `R` | record / stop recording (`esc` discards) |
| `M` | mutate (the sound, or the whole scene in AMBIENCE) |
| `1–7` | ambience · sample · synth · keys · fx · seq · export |
| `Z` / `X` | octave down / up |
| `⌘/ctrl Z` · `⌘/ctrl ⇧ Z` | undo · redo (scene history in AMBIENCE) |
| `⇧A` / `⇧B` | switch to sound A / B |
| `⇧L` | loop toggle · `⇧E` export panel |

Knobs: drag vertically, scroll, `shift` for fine control, double-click to reset.

## Stack

React + TypeScript + Vite + Zustand + Web Audio API. No UI frameworks — the whole visual system is hand-built. Audio engine (`src/audio/`) is fully independent of the UI: voices with pitch-envelope-driven detune, a modular effects chain (shared between live playback and offline export rendering), an AudioWorklet bitcrusher, a procedural-IR reverb, and a 16/24-bit WAV encoder.

The **ambient engine** (`AmbientEngine` + `ambientVoices`) is a separate persistent generative graph: per-layer synthesis voices feeding a shared plate reverb and a 90s-lofi master bus, driven by a lookahead scheduler that region-gates continuous textures and scatters discrete events across each loop cycle. It shares the same master/limiter/meter as the SFX engine and renders offline to a seamless loop for export. Both engines stay UI-independent; scene state lives in its own Zustand store with its own undo history and persistence.

*running on daylight ☀*
