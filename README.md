# NoiseD Storm

A self-contained monorepo for procedural rain and thunder synthesis and its demo/player.

- `packages/noised-storm`: publishable `noised-storm` library, including Rust/WASM, AudioWorklet assets, types, native generators, tests and benchmarks.
- `apps/demo`: React player with the original controls, presets, visualization and local assets.

## Develop

Requires Node 22.12+, npm 11.21+, Rust and the `wasm32-unknown-unknown` target.

    rustup target add wasm32-unknown-unknown
    npx npm@11.21.0 install
    npm run dev

The player opens at http://127.0.0.1:5173. It consumes the local npm workspace package and offers Rust/WASM and fixed JavaScript/Web Audio engines.

    npm run build
    npm run typecheck
    npm test
    npm run preview
    npm run bench

## Install the library in another project

    npm run pack:library
    npm install /path/to/noised-storm/artifacts/noised-storm-0.1.0.tgz

The tarball contains JS, declarations, WASM and the standalone worklet. No Rust toolchain or monorepo checkout is required by consumers. After publication to npm, install with `npm install noised-storm`. The demo package is private and is never published.

See packages/noised-storm/README.md for the public API and asset URL setup. No code imports, links or runtime assets refer to the previous repositories.

## Verification

After building, `npm run test:ui` checks the player in installed Chrome and saves desktop/mobile previews and downloads under `artifacts/`. `npm run test:package` packs the library and installs it in an independent temporary consumer. Playwright is installed locally; use `NOISED_BROWSER_CHANNEL` to select another installed browser.

The player keeps presets and controls while paused, changes presets without recreating the audio graph, supports rain/thunder enable switches, and downloads parameter JSON or a ten-second stereo WAV. The Rust backend requires HTTPS or localhost.

## Research: compare the engines

Select **Rust / WASM** or **JavaScript / Web Audio (fixed)** above the player controls. Rust remains the default. Engine changes keep the preset, custom parameters, and play/pause state. The previous graph is released before the new one starts; there is a brief restart rather than overlapping playback. Paused changes remain paused, and changing engines during startup cancels the obsolete initialization.

Both engines include the bug fixes. The JavaScript option uses the original native Web Audio graph and JavaScript scheduling/buffer generation; it never loads or instantiates WASM. The Rust option uses the existing AudioWorklet/WASM rain kernel. Thunder and native effects are shared. No synthesis algorithms were changed for this comparison.

Use the same settings, browser, and device to compare live controls, dense rain, stop/start behavior, and playback during other UI activity. This compares the two implementations: scheduling, allocation, and rain synthesis also differ, so it cannot isolate the effect of the programming language alone. Noise is stochastic and the implementations are not waveform-identical.

WAV exports retain the selected engine, and WAV/parameter filenames identify it. Engine selection is temporarily disabled while an offline WAV export runs.
