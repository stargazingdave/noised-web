# NoiseD Storm

Procedural rain and thunder for ambience apps and games. This research version develops the Rust/WASM rain engine and includes a demo/player in the monorepo.

## Installation and use

Build a local tarball with `npm run pack:library` at the monorepo root, then install the resulting `artifacts/noised-storm-0.1.0.tgz` in another project. After publication, use `npm install noised-storm`.

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
```

`NoiseDStorm` aliases `NoiseDController`. For rain alone, use `RainGenerator.createWasm(ctx, params, options)`, connect it to a destination, then await `start()`. Options also accept a repeatable rain `seed` and a fixed `maxVoices` pool of 1–256 (default 128). Thunder randomness is independent of the rain seed.

Other bundlers can copy the worklet and WASM exports to their static asset directory and supply those URLs. Consumers need no Rust toolchain. Use HTTPS or localhost, allow the asset URLs in your CSP, and enable CORS for cross-origin assets. Initialization fails explicitly when assets or AudioWorklet are unavailable.

## Engine status

The pure JavaScript rain engine is deprecated following listening comparisons. The comparison selector and switching API have been removed from the demo. Native constructors and V2 exports remain only for compatibility; use `createWasm` for new integrations. There is no automatic fallback to native rain.

Rust generates the continuous white/pink noise and stereo drops inside an AudioWorklet. Drop arrivals are irregular, with varied impact levels and decay lengths; short windows soften the start and end of each filtered drop. The render loop uses preallocated memory and a fixed voice pool. Excess drops steal slots in round-robin order.

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

The library build packages JS, declarations, the standalone worklet and the Rust release binary. Tests cover live controls, lifecycle races, WAV export, thunder sample boundaries, and the compiled WASM worklet. Rust tests check seeded block-size independence, irregular arrivals, drop boundaries and finite output under overload. Existing benchmark and browser checks remain available for development.

License: ISC. Author: David Portal.
