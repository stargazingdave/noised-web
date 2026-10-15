# Storm demo

Private Vite/React player consuming [NoiseD Storm](../engine/README.md) and
[NoiseD UI](../../ui/README.md). Run installation and scripts from the
[workspace root](../../README.md); the demo is not an npm library.

## Run and verify

```sh
npm run dev
npm run build
npm run test:ui
npm run preview
```

Development is at http://127.0.0.1:5173/; production preview is at port 4173.
The workspace build compiles both libraries before Vite. The demo uses the UI
library's automatic styles and adds CSS overrides in `src/styles.css`.
See the root README for testing under a Pages subpath and deployment setup.

## Player layout

The compact sticky navbar contains the logo and saved light/dark/system choices.
The player has playback/status, master volume, and a borderless visualization
with controls capped at 330 px. The EQ button switches to the master equalizer
and passes the live visualization as its `barsBackground`. It occupies only the
bars plot, leaving scale, frequency labels and Flat reset outside it.

Waveform and frequency-bar modes support Phosphor, Aurora, Valve and Matrix.
The demo uses 48 frequency bars over 20 Hz-12 kHz; these settings are props of
the shared component. Styles and mode persist when EQ is toggled. The audio
engine, analyser and EQ gains persist across view and tab changes.

Rain and Thunder tabs have independent enable switches. Each includes its own
EQ and sound controls. Master controls stay available on either tab. The UI
library supplies reusable controls; the demo owns layout, theme and audio bindings.

## Preset files

The Presets tool selects built-in Default, Close Storm and Far Storm sounds.
Save preset downloads current settings as a named JSON document with fields
`version` (1), `name` (a string), and `params` (complete `NoiseDParams`).

Load preset validates a JSON file, adds it to the session list, selects it and
immediately applies it to the live graph without restarting playback. Earlier
plain parameter JSON files are accepted; their filename becomes the label.
Imported presets are kept only in client memory and disappear on page reload.
Invalid files show an inline error and do not change the selected preset.

Editing a control marks the current sound as Custom. Saving captures those
current values. Built-in presets remain unchanged; imported entries can be
selected again after other presets or manual edits.

## WAV export

The Export tool renders current sound to stereo 16-bit PCM WAV. Length is
1-300 seconds, default 10, at the live AudioContext sample rate. Rendering uses
an OfflineAudioContext and the same WASM backend. Live playback may continue
while rendering. Export does not start paused playback. Initialization/render
errors appear in the player, and rendering disables duplicate downloads.

## Component and state ownership

`NoisedSynth` composes small header and tab components beneath one
`NoisedControllerProvider`. Child components call the context consumer hook;
only the provider calls `useCreateNoisedController` to own the audio graph.
Calling the state-creating hook separately in each child would disconnect the
visualization, transport, presets and controls from each other.

Audio starts from Play or export interaction. Unmounting the player destroys
its controller and closes the context. Lifetime and operation checks handle
cancelled startup and React StrictMode cleanup. Preset parsing and serialization
live in `model/preset-files.ts`, separate from file-picker UI.

The flat starfield is a seeded projection of the sibling `David/spaceship`
reference. `node scripts/generate-starfield.mjs` regenerates both SVG assets;
the reference checkout is not required. Light mode uses white space with
reflected-color gradients; both themes have translucent panels. Theme choice
is saved in localStorage; imported presets are not.
