// Optional real-browser integration test. Install Playwright locally, or point
// NOISED_PLAYWRIGHT_PATH at an existing Playwright package. Uses installed Chrome.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NOISED_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Noised integration test</title>'); return; }
        const name = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
        if (!name.startsWith(root)) { res.writeHead(403); res.end(); return; }
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(await readFile(name));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ channel: process.env.NOISED_BROWSER_CHANNEL || 'chrome', headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async () => {
        const { RainGenerator, NoiseDController, RainGeneratorV2, defaultRainParamsV2 } = await import('/index.js');
        const options = { workletUrl: '/worklet/rain.worklet.js', wasmUrl: '/wasm/noised_dsp.wasm', seed: 42 };
        const ctx = new AudioContext({ sampleRate: 48000 });
        const rain = await RainGenerator.createWasm(ctx, { dropRate: 300 }, options);
        let processorErrors = 0;
        rain.worklet.addEventListener('processorerror', () => processorErrors++);
        const analyser = ctx.createAnalyser();
        rain.connect(analyser); analyser.connect(ctx.destination);
        const data = new Float32Array(analyser.fftSize);
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const rms = () => { analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length); };
        await rain.start(); await sleep(200);
        let playing = rms();
        const firstClock = ctx.currentTime;
        // Device initialization can delay the first hardware output in headless Chrome.
        for (let attempt = 0; !playing && attempt < 20; attempt++) { await sleep(100); playing = rms(); }
        rain.setParams({ volume: 0 }); await sleep(200);
        const muted = rms();
        rain.stop();
        rain.setParams({ volume: 0.5, noiseLevel: 0.5, dropRate: 0 });
        await rain.start(); await sleep(200);
        const restarted = rms();
        rain.stop(); await sleep(200);
        const stopped = rms();
        rain.destroy(); analyser.disconnect(); await ctx.close();

        const offline = new OfflineAudioContext(2, 48000, 48000);
        const offlineRain = await RainGenerator.createWasm(offline, { dropRate: 300, noiseLevel: 0 }, options);
        offlineRain.connect(offline.destination);
        await offlineRain.start();
        const audio = await offline.startRendering();
        const channels = [audio.getChannelData(0), audio.getChannelData(1)];
        const offlineEnergy = channels[0].reduce((sum, x) => sum + x * x, 0);
        const stereoDifference = channels[0].reduce((sum, x, i) => sum + Math.abs(x - channels[1][i]), 0);
        const finite = channels.every(channel => channel.every(Number.isFinite));
        offlineRain.destroy();

        const nativeCtx = new AudioContext();
        const controller = new NoiseDController(nativeCtx, { delayBetweenThunders: { min: 100, max: 100 },
            rainParams: { dropRate: 10 }, thunderParams: { duration: { value: 0.1 }, rumbleDecay: { value: 0.2 } } });
        const wav = await controller.renderToFile(0.5);
        const decoded = await nativeCtx.decodeAudioData(await wav.arrayBuffer());
        const wavEnergy = decoded.getChannelData(0).reduce((sum, x) => sum + x * x, 0);
        controller.destroy();
        const wasmController = await NoiseDController.createWasm(nativeCtx,
            { rainParams: { dropRate: 300, noiseLevel: 0 }, thunderParams: { on: false } }, options);
        const wasmWav = await wasmController.renderToFile(0.2);
        const wasmDecoded = await nativeCtx.decodeAudioData(await wasmWav.arrayBuffer());
        const wasmWavEnergy = wasmDecoded.getChannelData(0).reduce((sum, x) => sum + x * x, 0);
        wasmController.destroy();
        const v2 = new RainGeneratorV2(nativeCtx, nativeCtx.destination, structuredClone(defaultRainParamsV2));
        v2.start();
        v2.updateParams({ const: { noise: { level: 0.1 }, drops: { rate: 20 } }, osc: { noise: { filterFreq: { value: 2000 } } } });
        v2.tick(0.1); v2.stop(); v2.tick(10); v2.destroy();
        await nativeCtx.close();
        return { playing, firstClock, muted, restarted, stopped, processorErrors, offlineEnergy, stereoDifference, finite,
            wavEnergy, wasmWavEnergy, wavChannels: decoded.numberOfChannels };
    });
    assert.ok(result.playing > 0 && result.restarted > 0, JSON.stringify(result));
    assert.equal(result.muted, 0);
    assert.equal(result.stopped, 0);
    assert.equal(result.processorErrors, 0);
    assert.ok(result.offlineEnergy > 0 && result.stereoDifference > 0 && result.finite);
    assert.ok(result.wavEnergy > 0 && result.wavChannels === 2);
    assert.ok(result.wasmWavEnergy > 0);
    assert.deepEqual(errors, []);
    console.log('Chrome integration passed:', result);
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
