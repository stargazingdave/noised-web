import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';
import { _defaultRainParams } from '../dist/index.js';

const source = await readFile(new URL('../dist/worklet/rain.worklet.js', import.meta.url), 'utf8');
const module = await WebAssembly.compile(await readFile(new URL('../dist/wasm/noised_dsp.wasm', import.meta.url)));
let Processor;
vm.runInNewContext(source, { WebAssembly, Float32Array, sampleRate: 48000,
    AudioWorkletProcessor: class { port = { postMessage() {}, close() {} }; },
    registerProcessor: (_name, implementation) => { Processor = implementation; },
});

console.log('WASM + worklet copy cost in Node; excludes native effects and browser scheduling.');
console.log('128 frames at 48 kHz gives 2.667 ms per block. No JS/backend speedup is inferred.');
const rows = [];
for (const rate of [0, 30, 300, 1000]) {
    const p = new Processor({ processorOptions: { module, params: { ..._defaultRainParams, dropRate: rate }, maxVoices: 128, seed: 42 } });
    p.port.onmessage({ data: { type: 'start' } });
    const outputs = [[new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]];
    for (let i = 0; i < 1000; i++) p.process([], outputs);
    const memory = p.kernel.memory.buffer;
    const times = [];
    for (let i = 0; i < 10000; i++) {
        const start = performance.now();
        p.process([], outputs);
        times.push(performance.now() - start);
    }
    const total = times.reduce((a, b) => a + b, 0);
    times.sort((a, b) => a - b);
    rows.push({ dropsPerSecond: rate, medianMs: times[5000].toFixed(3), p95Ms: times[9500].toFixed(3),
        maxMs: times.at(-1).toFixed(3), msPerAudioSecond: (total / (10000 * 128 / 48000)).toFixed(2),
        stableMemory: memory === p.kernel.memory.buffer });
    p.port.onmessage({ data: { type: 'destroy' } });
}
console.table(rows);
