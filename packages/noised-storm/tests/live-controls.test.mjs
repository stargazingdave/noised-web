import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Context, WorkletNode } from './audio-mock.mjs';
import { RainGenerator, ThunderGenerator, NoiseDController, RainGeneratorV2, ThunderGeneratorV2,
    NoiseDControllerV2, defaultRainParamsV2, defaultThunderParamsV2 } from '../dist/index.js';

test('legacy rain applies live patches, remembers stopped controls, and starts one timer', async () => {
    const ctx = new Context();
    const callbacks = new Map();
    const original = [globalThis.setInterval, globalThis.clearInterval];
    globalThis.setInterval = fn => { const id = callbacks.size + 1; callbacks.set(id, fn); return id; };
    globalThis.clearInterval = id => callbacks.delete(id);
    try {
        const rain = new RainGenerator(ctx);
        await rain.start();
        assert.equal(callbacks.size, 1);
        rain.setParams({ volume: 0.7, noiseLevel: 0.8, dropDryLevel: 0.3, dropRate: 0 });
        assert.equal(rain.output.gain.value, 0.7);
        assert.equal(rain.dryGain.gain.value, 0.8);
        assert.equal(rain.dryDropGainNode.gain.value, 0.3);
        const beforeNoise = rain.noiseNode;
        rain.setParams({ noiseType: 'white' });
        assert.notEqual(rain.noiseNode, beforeNoise);
        const whiteNoise = rain.noiseNode;
        rain.setParams({ noiseType: 'white', volume: 0.6 });
        assert.equal(rain.noiseNode, whiteNoise);
        assert.equal(callbacks.size, 0);
        rain.setDropRate(20);
        callbacks.values().next().value();
        const source = ctx.nodes.find(node => node.kind === 'source' && !node.loop);
        rain.stop();
        assert.equal(source.stopped, true);
        rain.setVolume(0.2);
        assert.equal(rain.output.gain.value, 0);
        await rain.start();
        assert.equal(rain.output.gain.value, 0.2);
        rain.destroy();
        assert.equal(callbacks.size, 0);
    } finally { [globalThis.setInterval, globalThis.clearInterval] = original; }
});

test('stop during resume cancels a pending start', async () => {
    const ctx = new Context();
    ctx.state = 'suspended';
    let resolve;
    ctx.resume = () => new Promise(done => { resolve = done; });
    const rain = new RainGenerator(ctx);
    const pending = rain.start();
    rain.setParams({ dropRate: 300, noiseType: 'white' });
    assert.equal(ctx.nodes.filter(node => node.kind === 'source').length, 0);
    rain.stop();
    resolve();
    await pending;
    assert.equal(ctx.nodes.filter(node => node.kind === 'source').length, 0);
    rain.destroy();
});

test('instance controls do not mutate defaults or other instances', () => {
    const ctx = new Context();
    const a = new NoiseDController(ctx);
    const b = new NoiseDController(ctx);
    a.setEqGain(0, 12);
    a.setRainVolume(0.1);
    assert.equal(JSON.parse(b.exportParamsAsJSON()).eqGains[0], 0);
    assert.equal(JSON.parse(b.exportParamsAsJSON()).rainParams.volume, 0.5);
    a.destroy(); b.destroy();
});

test('thunder routes through limiter and stop cancels all scheduled voices', () => {
    const ctx = new Context();
    const thunder = new ThunderGenerator(ctx);
    thunder.connect(ctx.destination);
    assert.equal(thunder.limiter.connections[0].node, ctx.destination);
    assert.equal(thunder.output.connections.length, 1);
    thunder.triggerThunder();
    const sources = ctx.nodes.filter(node => node.started);
    assert.ok(sources.length > 3);
    thunder.setParams({ volume: { value: 0 } });
    assert.equal(thunder.output.gain.value, 0);
    const count = ctx.nodes.length;
    thunder.triggerThunder();
    assert.equal(ctx.nodes.length, count);
    thunder.stop();
    assert.ok(sources.every(node => node.stopped && node.disconnected));
    thunder.destroy();
});

test('controller starts one thunder timer and honors live on/off switches', async () => {
    const ctx = new Context();
    const timers = new Map();
    const original = [globalThis.setTimeout, globalThis.clearTimeout];
    let id = 0;
    globalThis.setTimeout = fn => { timers.set(++id, fn); return id; };
    globalThis.clearTimeout = key => timers.delete(key);
    try {
        const controller = new NoiseDController(ctx, { rainParams: { on: false } });
        await controller.start();
        controller.startThunder(); controller.startThunder();
        assert.equal(timers.size, 1);
        controller.updateThunderParams({ on: false });
        assert.equal(timers.size, 0);
        controller.updateThunderParams({ on: true });
        assert.equal(timers.size, 1);
        controller.stop();
        assert.equal(timers.size, 0);
        controller.destroy();
    } finally { [globalThis.setTimeout, globalThis.clearTimeout] = original; }
});

test('V2 rain deep patches reach nodes and modulation preserves base controls', () => {
    const ctx = new Context();
    const rain = new RainGeneratorV2(ctx, ctx.destination, structuredClone(defaultRainParamsV2));
    rain.updateParams({ const: { drops: { rate: 2 }, main: { volume: 0.6, eqGains: [4] } },
        osc: { noise: { filterFreq: { value: 1000, osc: true, amp: 100, freq: 0.25 } } } });
    rain.start(); rain.start();
    assert.equal(ctx.nodes.filter(node => node.kind === 'source').length, 1);
    rain.tick(1);
    assert.equal(rain.noiseFilter.frequency.value, 1100);
    assert.equal(rain.getParams().osc.noise.filterFreq.value, 1000);
    assert.equal(rain.gainNode.gain.value, 0.6);
    assert.equal(rain.eqNode[0].gain.value, 4);
    assert.equal(rain.gainNode.connections[0].node, rain.eqNode[0]);
    assert.equal(rain.wetDropGainNode.connections[0].node, rain.reverbNode);
    rain.stop();
    const count = ctx.nodes.length;
    rain.tick(100);
    assert.equal(ctx.nodes.length, count);
    rain.updateParams({ const: { drops: { rate: -1 } } });
    rain.start(); rain.tick(1);
    const stoppedDropCount = ctx.nodes.length;
    rain.tick(100);
    rain.updateParams({ const: { drops: { rate: 2 } } });
    rain.tick(0.1);
    assert.equal(ctx.nodes.length, stoppedDropCount);
    rain.destroy();
    assert.ok(rain.eqNode.every(node => node.disconnected));
});

test('V2 thunder uses seconds for tick and samples one interval per event', () => {
    const ctx = new Context();
    const thunder = new ThunderGeneratorV2(ctx, ctx.destination, structuredClone(defaultThunderParamsV2));
    thunder.updateParams({ delayBetweenThunders: { min: 1000, max: 1000 } });
    thunder.start();
    thunder.tick(0.9);
    assert.equal(ctx.nodes.filter(node => node.started).length, 0);
    thunder.tick(0.1);
    assert.ok(ctx.nodes.some(node => node.started));
    thunder.stop();
    assert.ok(ctx.nodes.filter(node => node.started).every(node => node.stopped));
    const count = ctx.nodes.length;
    thunder.tick(100);
    assert.equal(ctx.nodes.length, count);
    thunder.destroy();
});

test('V2 controller path controls update snapshots and gate ticks', async () => {
    globalThis.AudioContext = Context;
    const initial = { masterVolume: 0.5, eqGains: [1],
        rainParams: { ...structuredClone(defaultRainParamsV2), on: false },
        thunderParams: { ...structuredClone(defaultThunderParamsV2), on: false } };
    const controller = new NoiseDControllerV2(initial);
    await controller.start();
    controller.setParam('rainParams.const.drops.rate', 4);
    assert.equal(controller.getParams().rainParams.const.drops.rate, 4);
    assert.equal(controller.getParams().rainParams.const.drops.q, 1);
    controller.setParam('rainParams.on', true);
    controller.tick(1);
    assert.ok(controller.ctx.nodes.some(node => node.started));
    controller.setParam('rainParams.on', false);
    const count = controller.ctx.nodes.length;
    controller.tick(100);
    assert.equal(controller.ctx.nodes.length, count);
    const snapshot = controller.getParams();
    snapshot.rainParams.const.drops.q = 99;
    assert.equal(controller.getParams().rainParams.const.drops.q, 1);
    assert.throws(() => controller.setParam('__proto__.polluted', true));
    controller.destroy();
});

test('WASM factory connects stereo drops and forwards live controls without native timers', async () => {
    globalThis.AudioWorkletNode = WorkletNode;
    const oldFetch = globalThis.fetch;
    const wasm = await readFile(new URL('../dist/wasm/noised_dsp.wasm', import.meta.url));
    globalThis.fetch = async () => new Response(wasm);
    const ctx = new Context();
    try {
        const options = { workletUrl: 'rain.worklet.js', wasmUrl: 'rain.wasm', seed: 42 };
        const rain = await RainGenerator.createWasm(ctx, {}, options);
        const other = await RainGenerator.createWasm(ctx, {}, options);
        assert.equal(ctx.audioWorklet.calls.length, 1);
        await rain.start();
        rain.setParams({ dropRate: 300, dropMinPitch: { value: 400, osc: false, amp: 0, freq: 0 } });
        assert.equal(rain.dropInterval, null);
        assert.equal(rain.noiseNode, null);
        assert.deepEqual(rain.worklet.connections.map(c => c.output), [0, 1, 1]);
        assert.equal(rain.worklet.messages.at(-1).params.dropRate, 300);
        assert.equal(rain.worklet.messages.filter(message => message.type === 'params' && message.params.dropRate === 300).length, 1);
        rain.stop();
        assert.equal(rain.worklet.messages.at(-1).type, 'stop');
        const post = rain.worklet.port.postMessage;
        rain.worklet.port.postMessage = message => rain.worklet.messages.push(structuredClone(message));
        const pendingStart = rain.start();
        await Promise.resolve();
        assert.ok(rain.pendingWorkletStart);
        rain.stop();
        await pendingStart;
        assert.equal(rain.output.gain.value, 0);
        rain.worklet.port.postMessage = post;
        await rain.start();
        assert.equal(rain.pendingWorkletStart, null);
        const node = rain.worklet;
        rain.destroy(); other.destroy();
        assert.equal(node.messages.at(-1).type, 'destroy');
        assert.equal(node.disconnected, true);
        await assert.rejects(RainGenerator.createWasm(ctx, {}, { ...options, maxVoices: 0 }), RangeError);
    } finally { globalThis.fetch = oldFetch; }
});

test('failed WASM asset loads clean up and allow a later retry', async () => {
    globalThis.AudioWorkletNode = WorkletNode;
    const oldFetch = globalThis.fetch;
    const ctx = new Context();
    try {
        globalThis.fetch = async () => new Response('', { status: 404 });
        const options = { workletUrl: 'worklet.js', wasmUrl: 'missing.wasm' };
        await assert.rejects(RainGenerator.createWasm(ctx, {}, options), /HTTP 404/);
        assert.ok(ctx.nodes.every(node => node.disconnected));
        const bytes = await readFile(new URL('../dist/wasm/noised_dsp.wasm', import.meta.url));
        globalThis.fetch = async () => new Response(bytes);
        const rain = await RainGenerator.createWasm(ctx, {}, options);
        await rain.start(); rain.destroy();
    } finally { globalThis.fetch = oldFetch; }
});

test('WAV export renders once and interleaves stereo correctly', async () => {
    let renders = 0;
    globalThis.OfflineAudioContext = class extends Context {
        state = 'suspended';
        async resume() { throw new Error('Offline rendering must not call resume'); }
        async startRendering() {
            renders++;
            const buffer = this.createBuffer(2, 2, 48000);
            buffer.getChannelData(0).set([1, -1]);
            buffer.getChannelData(1).set([0.5, -0.5]);
            return buffer;
        }
    };
    const controller = new NoiseDController(new Context(), { rainParams: { on: false }, thunderParams: { on: false } });
    const blob = await controller.renderToFile(1);
    const data = new DataView(await blob.arrayBuffer());
    assert.equal(renders, 1);
    assert.deepEqual([44, 46, 48, 50].map(i => data.getInt16(i, true)), [32767, 16383, -32768, -16384]);
    controller.destroy();
});


test('zero duration controls remain valid for the player', () => {
    const ctx = new Context();
    const thunder = new ThunderGenerator(ctx);
    thunder.setParams({ reverbDuration: { value: 0 }, reverbDecay: { value: 0 }, duration: { value: 0 } });
    assert.doesNotThrow(() => thunder.triggerThunder());
    assert.ok(ctx.buffers.every(buffer => buffer.length > 0));
    thunder.destroy();
});


test('thunder bodies and tails have finite, silent sample boundaries across sample rates', () => {
    for (const rate of [8000, 48000, 96000]) {
        for (const duration of [0, 0.02, 1]) {
            const ctx = new Context();
            ctx.sampleRate = rate;
            const thunder = new ThunderGenerator(ctx, {
                duration: { value: duration }, burstCount: { value: 1 },
                rumbleDecay: { value: 0 },
            });
            thunder.triggerThunder();
            const sources = ctx.nodes.filter(node => node.kind === 'source' && node.buffer);
            assert.equal(sources.length, 2);
            for (const source of sources) {
                const data = source.buffer.getChannelData(0);
                assert.ok(data.every(Number.isFinite));
                assert.ok(data[0] === 0);
                assert.ok(data.at(-1) === 0);
                assert.ok(data.some(value => Math.abs(value) > 0));
            }
            thunder.stop();
            assert.ok(sources.every(source => source.stopped && source.disconnected));
            thunder.destroy();
        }
    }
});
