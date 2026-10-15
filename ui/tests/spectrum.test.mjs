import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/visualization-spectrum.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
const { readSpectrumBands } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('spectrum locates bass, midrange and treble on the same logarithmic scale across sample rates', () => {
    for (const sampleRate of [44100, 48000, 96000]) {
        for (const frequency of [80, 1000, 10000]) {
            const data = new Float32Array(4096).fill(-Infinity);
            data[Math.round(frequency * 8192 / sampleRate)] = -40;
            const bands = new Float32Array(48);
            readSpectrumBands(data, sampleRate, bands, -100, -30);
            const peak = bands.indexOf(Math.max(...bands));
            const expected = Math.floor(Math.log(frequency / 20) / Math.log(1000) * bands.length);
            assert.ok(Math.abs(peak - expected) <= 1, `${frequency} Hz at ${sampleRate}: bar ${peak}, expected ${expected}`);
        }
    }
});

test('equal per-bin power stays level across bands instead of favoring wider high bands', () => {
    const data = new Float32Array(1024).fill(-65);
    const bands = new Float32Array(48);
    readSpectrumBands(data, 48000, bands, -100, -30);
    assert.ok(bands.every(value => Math.abs(value - 0.5) < 0.00001));
});

test('silence, DC and frequencies above 20 kHz do not light up the bars', () => {
    const data = new Float32Array(4096).fill(-Infinity);
    data[0] = 0;
    data[Math.round(22000 * 8192 / 48000)] = 0;
    const bands = new Float32Array(48);
    readSpectrumBands(data, 48000, bands, -100, -30);
    assert.ok(bands.every(value => value === 0));
});

test('low sample rates stay within available bins and levels stay bounded', () => {
    const data = new Float32Array(1024).fill(0);
    const bands = new Float32Array(48);
    readSpectrumBands(data, 16000, bands, -100, -30);
    assert.ok(bands.every(value => value === 1));
});

test('custom bounds reposition in-range tones and exclude tones outside the range', () => {
    const data = new Float32Array(4096).fill(-Infinity);
    const bands = new Float32Array(48);
    const toneBin = hz => Math.round(hz * 8192 / 48000);
    data[toneBin(1000)] = -40;
    readSpectrumBands(data, 48000, bands, -100, -30, 100, 12000);
    const expected = Math.floor(Math.log(1000 / 100) / Math.log(12000 / 100) * bands.length);
    assert.ok(Math.abs(bands.indexOf(Math.max(...bands)) - expected) <= 1);
    data.fill(-Infinity);
    data[toneBin(50)] = -40;
    data[toneBin(16000)] = -40;
    readSpectrumBands(data, 48000, bands, -100, -30, 100, 12000);
    assert.ok(bands.every(value => value === 0));
});

test('invalid ranges fall back to defaults and ranges above Nyquist show no activity', () => {
    const data = new Float32Array(1024).fill(-65);
    const bands = new Float32Array(48);
    const defaults = new Float32Array(48);
    readSpectrumBands(data, 48000, defaults, -100, -30);
    for (const [min, max] of [[0, 12000], [12000, 100], [20, NaN], [Infinity, 20000]]) {
        readSpectrumBands(data, 48000, bands, -100, -30, min, max);
        assert.deepEqual(bands, defaults);
    }
    readSpectrumBands(data, 16000, bands, -100, -30, 10000, 12000);
    assert.ok(bands.every(value => value === 0));
});
