# NoiseD Storm

- `engine/`: the publishable `noised-storm` package, including Rust/WASM and Web Audio synthesis.
- `demo/`: the private React player, consuming `noised-storm` and `noised-ui` through the root npm workspace.

Run installation, builds and development from the parent `web` directory.
See [the web README](../README.md) for commands and [the engine README](engine/README.md)
for the audio API. See the [demo README](demo/README.md) for player layout,
presets, export and shared controller state. Shared React controls and styling
live in [NoiseD UI](../ui/README.md).
