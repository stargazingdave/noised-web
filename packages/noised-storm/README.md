# 🌧️ NoiseD Storm

A lightweight TypeScript library for procedural **rain** and **thunder** sound generation using the Web Audio API.
Perfect for ambience apps, games, or chill projects.

---

## 🎧 Features

- 🌧️ Realistic rain synthesis with adjustable drop rate, pitch, decay, and EQ
- ⚡ Procedural thunder bursts with reverb, stereo spread, and randomness
- 🎚️ Full parameter control with support for oscillation and randomization
- 📦 Easily importable into any modern JS/TS project
- 🪶 Lightweight, no dependencies

---

## 🚀 Installation

```bash
npm install noised-storm
```

---

## 🛠️ Usage

```ts
import { RainGenerator, ThunderGenerator } from 'noised-storm';

// Create audio context
const audioCtx = new AudioContext();

// Setup rain
const rain = new RainGenerator(audioCtx, yourRainParams);
rain.start();

// Setup thunder
const thunder = new ThunderGenerator(audioCtx, yourThunderParams);
thunder.triggerThunder(); // on demand
```

## Optional Rust / WebAssembly rain backend

The existing constructors use native Web Audio nodes. To use the Rust rain
kernel, initialize it asynchronously and supply the worklet and WASM asset URLs.
For example, with Vite's asset URL imports:

```ts
import { RainGenerator, NoiseDController } from 'noised-storm';
import workletUrl from 'noised-storm/rain.worklet.js?url';
import wasmUrl from 'noised-storm/noised_dsp.wasm?url';

const ctx = new AudioContext();
const rain = await RainGenerator.createWasm(ctx, { dropRate: 100 }, {
  workletUrl,
  wasmUrl,
  maxVoices: 128, // fixed pool, 1–256
  seed: 42,
});
rain.connect(ctx.destination);
await rain.start(); // invoke playback from a user interaction
rain.setParams({ dropRate: 200, noiseFilterFreq: { value: 2500 } });
rain.stop();
rain.destroy();

// The controller can use the same optional backend for its rain generator.
const ambience = await NoiseDController.createWasm(ctx, {}, { workletUrl, wasmUrl });
await ambience.start();
ambience.updateRainParams({ on: false });
ambience.destroy();
```

Other bundlers can copy `dist/worklet/rain.worklet.js` and
`dist/wasm/noised_dsp.wasm` to a static asset directory and pass those URLs.
Use HTTPS or localhost, allow the asset URLs in your CSP, and serve cross-origin
assets with CORS enabled. Consumers do **not** need Rust installed. Initialization
fails explicitly if AudioWorklet or either asset is unavailable; use the existing
constructor when you want the native backend.

Rust runs inside an AudioWorklet, generating continuous white/pink noise and
mixing bandpass-filtered, enveloped, stereo drops. The TypeScript graph retains
EQ, noise filtering, wet/dry gains and native convolution. The render path uses
preallocated memory and voices; excess drops steal pool slots in round-robin
order. This is an alternative synthesis backend, so its drops can sound different
from the native generator. Thunder remains native Web Audio. No shared-memory
headers or WebAssembly threads are required.

The WASM factory is available on the original `RainGenerator` and
`NoiseDController`. The V2 exports remain native; they support nested live patches,
and `NoiseDControllerV2.tick(dt)` takes **seconds**. Thunder delay controls remain
in **milliseconds**. Stop/destroy cancels active and scheduled voices. Use
`await controller.start()` to observe context resume errors.
`renderToFile(durationSec)` schedules on the offline audio clock and retains the
controller's selected rain backend.

## 📦 Build
Library development requires Rust plus its WASM target:

```bash
rustup target add wasm32-unknown-unknown
```

```bash
npm run build
```

This builds JS/types, the standalone worklet, and the Rust release binary into the
same npm package. `npm run build:js` builds only the native API/worklet wrapper;
`npm run build:wasm` builds and copies the kernel. `npm run dev` watches the
TypeScript API; rerun the relevant build after changing the worklet or Rust code.

```bash
npm run typecheck
npm test
npm run bench
```

Tests cover live controls, lifecycle races, offline WAV export, and the actual
compiled WASM kernel/worklet. The benchmark measures WASM rendering plus sample
copying in Node, including median/p95 block time and memory stability; it excludes
native effects and browser scheduling and does not claim a speedup over the
native backend. Mobile CPU and audible glitches still need device measurements.

For an optional real-browser integration check, install Playwright and Chrome,
then run `npm run test:browser`. An existing Playwright installation can be supplied
with `NOISED_PLAYWRIGHT_PATH`; `NOISED_BROWSER_CHANNEL` defaults to `chrome`.

For dev mode with watch:
```bash
npm run dev
```

## 🧙 Author
The name is David Portal, hi 😊
I'll soon add a website with more of my projects.

The branded `NoiseDStorm` export is an alias of `NoiseDController`; both names are supported.
