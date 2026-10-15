# NoiseD Web

The web monorepo for NoiseD Storm and NoiseD UI. The sibling `../vst-plugins`
folder is a separate Git repository for native JUCE plugins.

```text
web/
  storm/
    engine/   noised-storm: JavaScript API, Rust/WASM rain, Web Audio thunder
    demo/     Private React player consuming both workspace libraries
  ui/         noised-ui: reusable React audio controls and standalone CSS
  scripts/    Browser and package integration checks
  artifacts/  Local tarballs, screenshots and downloaded audio (ignored)
```

One root npm workspace and lockfile manage all three packages. `noised-storm`
and `noised-ui` have independent package manifests and can be released separately.
The UI library has no Storm or audio-engine dependency. The native VST repository
keeps its own C++/JUCE UI implementation and build system.

## Develop

Requires Node 22.12+, npm 11.21+, Rust and the `wasm32-unknown-unknown` target.

```sh
rustup target add wasm32-unknown-unknown
npx npm@11.21.0 install
npm run dev
```

Run commands from this `web` directory. The player opens at
http://127.0.0.1:5173. `dev` builds both libraries before starting Vite.
For UI-library development, run `npm run dev:ui` in another terminal to watch
its source and rebuild the package. The demo and library use plain CSS;
no Tailwind configuration or CSS generation is needed.

```sh
npm run build
npm run typecheck
npm test
npm run preview
npm run bench
npm run check
```

## Package the libraries

```sh
npm run pack:library
npm run pack:ui
```

These commands produce `artifacts/noised-storm-0.1.0.tgz` and
`artifacts/noised-ui-0.1.0.tgz`. Install either tarball in another project with
`npm install /path/to/file.tgz`. Neither library requires this monorepo checkout.
The demo is private and is never published.

- [Storm API and asset setup](storm/engine/README.md)
- [UI installation, styling and component API](ui/README.md)

The Storm tarball includes JavaScript, declarations, WASM and the standalone
worklet. Consumers do not need a Rust toolchain. Rain uses Rust/WASM; thunder
and effects use Web Audio. The Rust backend requires HTTPS or localhost.

## Verification

After building, `npm run test:ui` checks the player in installed Chrome and
saves desktop/mobile previews and JSON/WAV downloads under `artifacts/`.
`npm run test:package` installs the packed libraries in an independent temporary
consumer and checks their public exports, assets and UI behavior. Use
`NOISED_BROWSER_CHANNEL` to select another installed browser.

The player preserves controls while paused, changes presets without recreating
the audio graph, supports rain/thunder enable switches, and downloads parameter
JSON or a ten-second stereo WAV.

The demo's flat starfield uses the same seeded stars and sky palette as the
sibling `David/spaceship` project, projected to a standalone SVG. Regenerate it
with `node scripts/generate-starfield.mjs`; the source project is not needed.
The demo defaults to a dark holographic theme. The navbar offers saved light,
dark, and system theme choices. The player has playback/status, a compact live
visualization window, and master volume below its title and actions. A button
beside the window switches between waveform and frequency bars. The master EQ
opens from an EQ tab and is hidden initially. Rain and Thunder tabs include
independent enable switches.

## Sound-quality research

Rain retains its earlier WASM timing and drop envelopes after listening feedback
on the experimental variation. Thunder keeps the layered body, shaped rumble and
tapered tails. Presets and controls are preserved for listening feedback. See the
Storm library README for the synthesis boundary between Rust and Web Audio.
