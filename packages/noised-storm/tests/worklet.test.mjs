import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { _defaultRainParams } from '../dist/index.js';

const source = await readFile(new URL('../dist/worklet/rain.worklet.js', import.meta.url), 'utf8');
const module = await WebAssembly.compile(await readFile(new URL('../dist/wasm/noised_dsp.wasm', import.meta.url)));

function processor(params = {}) {
    let Processor;
    vm.runInNewContext(source, {
        WebAssembly, Float32Array, sampleRate: 48000,
        AudioWorkletProcessor: class { port = { postMessage() {}, close() {} }; },
        registerProcessor: (_name, implementation) => { Processor = implementation; },
    });
    return new Processor({ processorOptions: { module, params: { ...structuredClone(_defaultRainParams), ...params }, maxVoices: 32, seed: 42 } });
}
function block(length = 128) { return [[new Float32Array(length)], [new Float32Array(length), new Float32Array(length)]]; }

test('actual WASM worklet handles controls, variable blocks, stable memory, stop and disposal', () => {
    const p = processor({ dropRate: 500 });
    const memory = p.kernel.memory.buffer;
    const pointer = p.kernel.engine_output_ptr(p.handle);
    p.port.onmessage({ data: { type: 'start' } });
    let energy = 0;
    for (const length of [128, 256, 4096]) {
        const outputs = block(length);
        assert.equal(p.process([], outputs), true);
        assert.ok(outputs.flat().every(channel => channel.every(Number.isFinite)));
        energy += outputs[1][0].reduce((sum, x) => sum + Math.abs(x), 0);
    }
    assert.ok(energy > 0);
    assert.equal(p.kernel.memory.buffer, memory);
    assert.equal(p.kernel.engine_output_ptr(p.handle), pointer);
    p.port.onmessage({ data: { type: 'stop' } });
    p.port.onmessage({ data: { type: 'params', params: { ..._defaultRainParams, dropRate: 0 } } });
    p.port.onmessage({ data: { type: 'start' } });
    const outputs = block();
    p.process([], outputs);
    assert.ok(outputs[1].every(channel => channel.every(x => x === 0)));
    p.port.onmessage({ data: { type: 'destroy' } });
    assert.equal(p.process([], block()), false);
});

test('same seed produces repeatable audio and independent processor state', () => {
    const a = processor({ dropRate: 1000 });
    const b = processor({ dropRate: 1000 });
    for (const p of [a, b]) p.port.onmessage({ data: { type: 'start' } });
    const left = block(2048), right = block(2048);
    a.process([], left); b.process([], right);
    assert.deepEqual(left, right);
    for (const p of [a, b]) p.port.onmessage({ data: { type: 'destroy' } });
});
