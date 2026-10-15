# NoiseD Storm

A self-contained monorepo for procedural rain and thunder synthesis and its demo/player.

- `packages/noised-storm`: publishable `noised-storm` library, including Rust/WASM, AudioWorklet assets, types, native generators, tests and benchmarks.
- `apps/demo`: React player with the original controls, presets, visualization and local assets.

## Develop

Requires Node 22.12+, npm 11.21+, Rust and the `wasm32-unknown-unknown` target.

    rustup target add wasm32-unknown-unknown
    npx npm@11.21.0 install
    npm run dev

The player opens at http://127.0.0.1:5173. It consumes the local npm workspace package and uses the WASM rain engine.

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
