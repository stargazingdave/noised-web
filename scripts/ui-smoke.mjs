import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NOISED_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
if (!process.env.npm_execpath) throw new Error('Run this check with npm run test:ui');
const server = spawn(process.execPath, [process.env.npm_execpath, 'run', 'preview'], { cwd: root, stdio: 'pipe' });
let output = '';
server.stdout.on('data', data => { output += data; });
server.stderr.on('data', data => { output += data; });
const url = 'http://127.0.0.1:4173';
let browser;
try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(output);
        try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Preview server did not become ready: ' + output);
    browser = await chromium.launch({ channel: process.env.NOISED_BROWSER_CHANNEL || 'chrome', headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        const probe = window.__stormProbe = { contexts: 0, worklets: 0, messages: [], analyser: null };
        const Context = window.AudioContext;
        window.AudioContext = class extends Context {
            constructor(...args) { super(...args); probe.contexts++; }
            createAnalyser() { const analyser = super.createAnalyser(); probe.analyser = analyser; return analyser; }
        };
        const Worklet = window.AudioWorkletNode;
        window.AudioWorkletNode = class extends Worklet {
            constructor(...args) {
                super(...args); probe.worklets++;
                const post = this.port.postMessage.bind(this.port);
                this.port.postMessage = (data, ...rest) => { probe.messages.push(structuredClone(data)); post(data, ...rest); };
            }
        };
    });
    await page.goto(url);
    await page.getByRole('heading', { name: 'NoiseD Storm', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Sound preset' }).selectOption('far-storm');
    const engine = page.getByRole('combobox', { name: 'Audio engine' });
    await engine.selectOption('javascript');
    assert.equal(await page.getByRole('combobox', { name: 'Sound preset' }).inputValue(), 'far-storm');
    await engine.selectOption('wasm');
    assert.equal(await page.evaluate(() => window.__stormProbe.contexts), 0);
    assert.equal(await page.getByRole('button', { name: 'Play Storm' }).getAttribute('aria-pressed'), 'false');
    await page.screenshot({ path: path.join(artifacts, 'demo-desktop.png'), fullPage: true });

    await page.route('**/*.wasm', async route => { await new Promise(resolve => setTimeout(resolve, 400)); await route.continue(); });
    await page.getByRole('button', { name: 'Play Storm' }).click();
    await page.getByRole('button', { name: 'Cancel start' }).click();
    await page.getByRole('button', { name: 'Play Storm' }).waitFor();
    await page.waitForFunction(() => window.__stormProbe.worklets === 1);
    assert.equal(await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length), 0);
    await page.getByRole('button', { name: 'Play Storm' }).click();
    await page.getByRole('button', { name: 'Pause Storm' }).waitFor({ timeout: 20000 });
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        if (!analyser) return false;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.some(value => Math.abs(value) > 0.0001);
    });
    await page.getByRole('combobox', { name: 'Sound preset' }).selectOption('close-storm');
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), 1);
    const master = page.getByRole('tabpanel').getByRole('textbox', { name: 'Volume', exact: true });
    await master.fill('0'); await master.press('Enter');
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.every(value => value === 0);
    });
    await page.getByRole('checkbox', { name: 'Rain enabled' }).uncheck();
    await page.getByRole('checkbox', { name: 'Thunder enabled' }).uncheck();
    await page.getByRole('checkbox', { name: 'Rain enabled' }).check();
    await page.getByRole('button', { name: 'Pause Storm' }).click();
    const starts = await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length);
    await page.getByRole('combobox', { name: 'Sound preset' }).selectOption('far-storm');
    assert.equal(await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length), starts);

    await page.getByRole('tab', { name: 'Rain Controls' }).click();
    await page.getByRole('textbox', { name: 'Rate', exact: true }).fill('120');
    await page.getByRole('textbox', { name: 'Rate', exact: true }).press('Enter');
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download parameters as JSON' }).click();
    const parameters = await jsonDownload;
    await parameters.saveAs(path.join(artifacts, parameters.suggestedFilename()));
    assert.equal(JSON.parse(await readFile(path.join(artifacts, parameters.suggestedFilename()), 'utf8')).rainParams.dropRate, 120);
    // The fixed JavaScript implementation works with all WASM requests blocked.
    await page.unroute('**/*.wasm');
    let unexpectedWasmLoads = 0;
    await page.route('**/*.wasm', route => { unexpectedWasmLoads++; return route.abort(); });
    const workletsBeforeJavascript = await page.evaluate(() => window.__stormProbe.worklets);
    await engine.selectOption('javascript');
    await page.getByRole('button', { name: 'Play Storm' }).waitFor();
    assert.equal(Number(await page.getByRole('textbox', { name: 'Rate', exact: true }).inputValue()), 120);
    await page.getByRole('button', { name: 'Play Storm' }).click();
    await page.getByRole('button', { name: 'Pause Storm' }).waitFor();
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.some(value => Math.abs(value) > 0.0001);
    });
    await page.getByRole('tab', { name: 'Master Controls' }).click();
    await master.fill('0'); await master.press('Enter');
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.every(value => value === 0);
    });
    await master.fill('1'); await master.press('Enter');
    assert.equal(unexpectedWasmLoads, 0);
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), workletsBeforeJavascript);
    await page.unroute('**/*.wasm');

    // Playing engine switches preserve custom settings and replace the old graph.
    await engine.selectOption('wasm');
    await page.getByRole('button', { name: 'Pause Storm' }).waitFor();
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), workletsBeforeJavascript + 1);
    await page.getByRole('tab', { name: 'Rain Controls' }).click();
    assert.equal(Number(await page.getByRole('textbox', { name: 'Rate', exact: true }).inputValue()), 120);
    assert.equal(await page.getByRole('combobox', { name: 'Sound preset' }).inputValue(), 'custom');
    await engine.selectOption('javascript');
    await page.getByRole('button', { name: 'Pause Storm' }).waitFor();
    await page.getByRole('button', { name: 'Pause Storm' }).click();

    // An obsolete Rust initialization must never replace a newer JavaScript engine.
    const workletsBeforeRace = await page.evaluate(() => window.__stormProbe.worklets);
    const startsBeforeRace = await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length);
    await page.route('**/*.wasm', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
    await engine.selectOption('wasm');
    await page.getByRole('button', { name: 'Play Storm' }).click();
    await page.getByRole('button', { name: 'Cancel start' }).waitFor();
    await engine.selectOption('javascript');
    await page.getByRole('button', { name: 'Pause Storm' }).waitFor();
    await page.waitForFunction(expected => window.__stormProbe.worklets === expected && window.__stormProbe.messages.filter(message => message.type === 'destroy').length === expected, workletsBeforeRace + 1);
    assert.equal(await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length), startsBeforeRace);
    assert.equal(await engine.inputValue(), 'javascript');
    assert.equal(await page.getByRole('alert').count(), 0);
    await page.getByRole('button', { name: 'Pause Storm' }).click();
    await page.unroute('**/*.wasm');

    const wavDownload = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Download 10-second WAV' }).click();
    const audio = await wavDownload;
    assert.equal(audio.suggestedFilename(), 'noised-storm-javascript.wav');
    await audio.saveAs(path.join(artifacts, audio.suggestedFilename()));
    const wav = await readFile(path.join(artifacts, audio.suggestedFilename()));
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
    assert.ok(wav.length > 100000);
    assert.ok(wav.subarray(44).some(value => value !== 0));
    await page.getByRole('button', { name: 'Play Storm' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Master Controls' }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Two-engine UI integration passed: switching while paused/playing/initializing, native audio with WASM blocked, preserved controls, native WAV export; presets while paused/playing, cancelled startup, live volume, enable toggles, parameter/WAV downloads and mobile layout.');
} finally {
    await browser?.close();
    // npm spawns Vite; close the owned process tree on Windows.
    if (process.platform === 'win32') {
        await new Promise(resolve => {
            const killer = spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { windowsHide: true });
            killer.on('exit', resolve); killer.on('error', resolve);
        });
    } else { server.kill('SIGTERM'); }
}
