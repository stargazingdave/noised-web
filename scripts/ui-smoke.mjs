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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
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
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(5, 8, 17)');
    assert.ok(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage.includes('spaceship-stars.svg')));
    assert.equal((await page.request.get(url + '/images/spaceship-stars.svg')).status(), 200);
    await page.screenshot({ path: path.join(artifacts, 'demo-holographic-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await page.getByRole('combobox', { name: 'Sound preset' }).selectOption('far-storm');
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
    const wavDownload = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Download 10-second WAV' }).click();
    const audio = await wavDownload;
    await audio.saveAs(path.join(artifacts, audio.suggestedFilename()));
    const wav = await readFile(path.join(artifacts, audio.suggestedFilename()));
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
    assert.ok(wav.length > 100000);
    await page.getByRole('button', { name: 'Play Storm' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Master Controls' }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(5, 8, 17)');
    for (const [tab, instructions] of [
        ['Rain Controls', 'Oscillating Parameter Controller'],
        ['Thunder Controls', 'Random Parameter Controller'],
    ]) {
        await page.getByRole('tab', { name: tab }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
        await page.getByRole('button', { name: 'Parameter help', exact: true }).first().click();
        await page.getByRole('heading', { name: instructions, exact: true }).waitFor();
        const popover = page.getByRole('dialog');
        const bounds = await popover.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
        await page.keyboard.press('Escape');
        await popover.waitFor({ state: 'hidden' });
    }
    await page.screenshot({ path: path.join(artifacts, 'demo-mobile-dark.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: 'Rain Controls' }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-desktop-dark.png'), fullPage: true });
    for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const tab of ['Master Controls', 'Rain Controls', 'Thunder Controls']) {
            await page.getByRole('tab', { name: tab }).click();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tab + ' overflows at ' + width);
            assert.ok(await page.locator('.control-group-body').evaluateAll(groups => groups.every(group => group.scrollWidth <= group.clientWidth + 1)), tab + ' has clipped controls at ' + width);
        }
    }
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
    console.log('UI integration passed: presets while paused/playing, cancelled startup, live volume, enable toggles, parameter/WAV downloads, light/dark layouts and mobile help popovers.');
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
