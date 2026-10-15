# NoiseD Storm

Framework-independent procedural rain and thunder for browser ambience apps and games.
This package owns audio synthesis and lifecycle, with no React, UI or CSS dependency.
See the [workspace README](../../README.md) for monorepo commands and deployment,
the [demo README](../demo/README.md) for player tools, and the
[UI README](../../ui/README.md) for React controls and automatic styling.

## Installation and use

Release candidate: **1.0.0-beta.1**, intended for the `beta` tag. This is a 1.0
API candidate; beta versions may still change the public API. See the
[release procedure](https://github.com/stargazingdave/noised-web#publish-a-library-release)
for verification and publishing. The engine and UI have independent releases.

Build a local tarball with `npm run pack:library` at the monorepo root, then install the resulting `artifacts/noised-storm-1.0.0-beta.1.tgz` in another project. After publication, use `npm install noised-storm@beta`.

Initialize from a user interaction. With Vite, import the packaged assets as URLs:

```ts
import { NoiseDStorm } from 'noised-storm';
import workletUrl from 'noised-storm/rain.worklet.js?url';
import wasmUrl from 'noised-storm/noised_dsp.wasm?url';

const ctx = new AudioContext();
const storm = await NoiseDStorm.createWasm(ctx, {}, { workletUrl, wasmUrl });
await storm.start();
storm.updateRainParams({ dropRate: 100, noiseFilterFreq: { value: 2500 } });
storm.updateThunderParams({ volume: { value: 0.4 } });
storm.stop();
storm.destroy();
await ctx.close(); // The application owns its AudioContext.
```

`NoiseDStorm` aliases `NoiseDController`. For rain alone, use `RainGenerator.createWasm(ctx, params, options)`, connect it to a destination, then await `start()`. Options also accept a repeatable rain `seed` and a fixed `maxVoices` pool of 1–256 (default 128). Thunder randomness is independent of the rain seed.

Other bundlers can copy the worklet and WASM exports to their static asset directory and supply those URLs. Consumers need no Rust toolchain. Use HTTPS or localhost, allow the asset URLs in your CSP, and enable CORS for cross-origin assets. Initialization fails explicitly when assets or AudioWorklet are unavailable.

The package exports ESM and CommonJS, TypeScript declarations, and these asset
subpaths: `noised-storm/rain.worklet.js` and `noised-storm/noised_dsp.wasm`.
The `?url` syntax in the example is Vite-specific, not part of the engine API.
With another build tool, provide publicly fetchable URLs yourself; they must
respect the deployed base path. WASM is compiled from an ArrayBuffer, so hosts
that omit the `application/wasm` MIME type still work. Do not inline the worklet
into the main bundle; it runs in AudioWorkletGlobalScope.

Importing the JS package in Node/SSR is supported, but creating or running an
engine requires browser Web Audio (or a compatible test implementation). Await
`createWasm` and `start`, catch initialization errors, and keep one controller
for the lifetime of a player instead of creating one for each UI component.

## Controller API

| Method | Behavior |
| --- | --- |
| `NoiseDStorm.createWasm(ctx, params, options)` | Async factory; accepts nested partial parameters and caller-supplied asset URLs |
| `start()` | Async start/resume of enabled rain and thunder |
| `stop()` | Stops playback and pending thunder scheduling without destroying the graph |
| `startRain()` / `stopRain()` | Enables/starts or disables/stops rain; await rain startup |
| `startThunder()` / `stopThunder()` | Enables scheduling while the controller is running, or disables/stops thunder |
| `setMasterVolume(value)` | Updates output gain |
| `setDelayBetweenThunders({ min, max })` | Updates/reschedules the random thunder interval, in milliseconds |
| `setEqGain(index, gain)` | Updates a master EQ gain in dB |
| `updateRainParams(patch)` | Applies a nested rain patch; may return an async startup when enabling rain |
| `updateThunderParams(patch)` | Applies a nested thunder patch |
| `getAnalyser()` | Creates an AnalyserNode tapped after master gain; call once and reuse it for visualization |
| `exportParamsAsJSON()` | Serializes the controller's current parameters |
| `renderToFile(durationSec)` | Async stereo 16-bit PCM WAV Blob, rendered on an offline clock at the context's sample rate |
| `destroy()` | Stops/disconnects owned audio nodes; idempotent; the caller still closes its context |

Master, rain and thunder EQs have ten bands: 31, 62, 125, 250, 500, 1000,
2000, 4000, 8000 and 16000 Hz. Gain arrays are replaced as whole arrays in
patches. Object patches preserve sibling values; use the exported
`DeepPartial<NoiseDParams>` type for typed updates. Dedicated `setRain*` methods
also remain available; their declarations and parameter interfaces are in
[NoiseDController.ts](src/NoiseDController.ts).

### Parameters and modulation

`NoiseDParams` contains `masterVolume`, `delayBetweenThunders`, `eqGains`,
`rainParams` and `thunderParams`. The library's initial output gain is 0.5;
both layers are enabled, and thunder intervals default to 5000-15000 ms.
The demo uses its own saved presets, not these engine defaults.

Rain parameters include volume/EQ, white or pink noise and its level/filter,
drop dry/wet levels, rate, pitch, decay, resonance, reverb and pan range.
Modulated rain values use `{ value, osc, amp, freq }`: frequency is in Hz and
amplitude uses the parameter's units. Thunder values generally use
`{ value, rand, dist }`, randomizing around `value` within the distribution.
Thunder exposes volume/duration, filter/bursts/crackle, reverb, sub level,
pan/high-pass, rumble and EQ settings. `delayMs` and thunder intervals use
milliseconds; duration/decay settings use seconds and filter/pitch settings Hz.
Complete types and defaults are in [RainGenerator.ts](src/RainGenerator.ts) and
[ThunderGenerator.ts](src/ThunderGenerator.ts).

Standalone `RainGenerator` and `ThunderGenerator` instances are explicitly
connected by the consumer; the full controller connects its output to
`ctx.destination`. The application owns parameter validation, preset lists,
file parsing and download UI. The engine does not provide preset storage.

For a visualization, pass the analyser returned by `getAnalyser()` to any
compatible renderer, including the UI library's `Visualization`. Keep analyser
and playback state shared across the player's components. No CSS import is
needed by this engine; UI styling belongs to `noised-ui`.

`renderToFile` requires a finite positive duration and uses the rain backend
chosen by the factory. It does not turn on live playback; enabled layers and
current parameters determine the render. The engine does not impose the
demo's 300-second UI limit. Callers choose a duration appropriate to available
memory and handle the returned Blob/download themselves.

## Engine status

The pure JavaScript rain engine is deprecated following listening comparisons. The comparison selector and switching API have been removed from the demo. Native constructors and V2 exports remain only for compatibility; use `createWasm` for new integrations. There is no automatic fallback to native rain.

Rust generates the continuous white/pink noise and stereo drops inside an AudioWorklet. Rain retains the earlier regular drop timing and direct decay control; experimental timing, impact-level and envelope variation was reverted after listening feedback. The render loop uses preallocated memory and a fixed voice pool. Excess drops steal slots in round-robin order.

Thunder synthesis, EQ, filters and convolution still use Web Audio nodes. Thunder now combines a short bright crack with a darker, irregular rolling body, tapered noise tails and shaped sub rumble. This is a first sound-quality pass for listening feedback; it does not move thunder into Rust. No shared-memory headers or WASM threads are required.

Live controls accept nested partial patches. Parameters and presets retain their existing meanings, though synthesized sound has changed. Thunder delay controls use milliseconds. Stop/destroy cancels active and scheduled sources. `renderToFile(durationSec)` renders a stereo WAV on the offline audio clock using the controller's rain backend.

## Development

Requires Node 22.12+, npm 11.21+, Rust and its `wasm32-unknown-unknown` target. From the monorepo root:

```sh
npm run build
npm run typecheck
npm test
npm run dev
```

For this package alone, `npm run build --workspace=noised-storm` emits both JS
formats, declarations, the worklet and WASM binary; `npm run test
--workspace=noised-storm` also runs Rust tests. `npm run test:browser
--workspace=noised-storm` verifies browser audio and `npm run bench` at the root
runs the performance benchmark. The source build uses the committed Cargo.lock
with `--locked`; the npm tarball contains prebuilt assets. Keep generated
`dist` and Rust `target` directories out of Git.

The library build packages JS, declarations, the standalone worklet and the Rust release binary. Tests cover live controls, lifecycle races, WAV export, thunder sample boundaries, and the compiled WASM worklet. Rust tests check seeded block-size independence, reset behavior and finite output under overload. Existing benchmark and browser checks remain available for development.

License: ISC. Author: David Portal.
