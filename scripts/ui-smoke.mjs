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
const basePath = process.env.VITE_BASE_PATH || '/';
const url = 'http://127.0.0.1:4173' + basePath.replace(/\/$/, '');
let browser;
try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(output);
        try { if ((await fetch(url + '/')).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Preview server did not become ready: ' + output);
    browser = await chromium.launch({ channel: process.env.NOISED_BROWSER_CHANNEL || 'chrome', headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    const errors = [];
    const visualStyles = ['Phosphor', 'Aurora', 'Valve', 'Matrix'];
    const selectPreset = async id => {
        await page.getByRole('button', { name: 'Presets', exact: true }).click();
        await page.getByRole('combobox', { name: 'Sound preset', exact: true }).selectOption(id);
        await page.keyboard.press('Escape');
    };
    const chooseVisualStyle = async name => {
        await page.getByRole('button', { name: 'Visualization styles', exact: true }).click();
        await page.getByRole('menuitemradio', { name, exact: true }).click();
        await page.locator(`.noised-visualization[data-style="${name.toLowerCase()}"]`).waitFor();
    };
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
        if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) {
            errors.push(`HTTP ${response.status()}: ${response.url()}`);
        }
    });
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
    await page.goto(url + '/');
    await page.getByRole('heading', { name: 'NoiseD Storm', exact: true }).waitFor();
    const masterControls = page.getByRole('region', { name: 'Master controls', exact: true });
    const player = page.getByRole('region', { name: 'Storm Player', exact: true });
    assert.equal(await page.getByRole('tab').count(), 2);
    assert.equal(await player.getByRole('tabpanel').count(), 0);
    assert.equal(await player.getByRole('switch').count(), 0);
    assert.ok(await masterControls.isVisible());
    const eqToggle = page.getByRole('button', { name: 'Show master EQ', exact: true });
    const masterEq = page.locator('#master-eq');
    assert.equal(await eqToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await masterEq.isVisible(), false);
    assert.equal((await eqToggle.textContent()).trim(), 'EQ');
    const scopeBounds = await page.locator('.storm-scope').boundingBox();
    const playBounds = await page.getByRole('button', { name: 'Play Storm', exact: true }).boundingBox();
    const volumeBounds = await masterControls.getByRole('slider', { name: 'Master Volume', exact: true }).boundingBox();
    assert.ok((await page.locator('.storm-visualization-controls').boundingBox()).width <= 330);
    assert.equal(scopeBounds.height, 128);
    assert.ok(playBounds.x < scopeBounds.x && scopeBounds.x < volumeBounds.x);
    await page.getByRole('button', { name: 'Show frequency bars', exact: true }).click();
    await page.getByRole('img', { name: 'Live frequency bars', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__stormProbe.contexts), 0);
    await page.getByRole('button', { name: 'Show waveform', exact: true }).click();
    await page.getByRole('button', { name: 'Visualization styles', exact: true }).click();
    assert.equal(await page.getByRole('menuitemradio').count(), 4);
    await page.screenshot({ path: path.join(artifacts, 'visualization-style-menu.png') });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.locator('.noised-visualization[data-style="aurora"]').waitFor();
    await chooseVisualStyle('Phosphor');
    await eqToggle.click();
    assert.equal(await page.locator('.storm-scope canvas').count(), 1);
    assert.ok(await masterEq.evaluate(eq => {
        const plot = eq.querySelector('.noised-equalizer__plot').getBoundingClientRect();
        const background = eq.querySelector('.noised-equalizer__background').getBoundingClientRect();
        const labels = eq.querySelector('.noised-equalizer__frequencies').getBoundingClientRect();
        return Math.abs(background.x - plot.x) < 1 && Math.abs(background.y - plot.y) < 1
            && Math.abs(background.width - plot.width) < 1 && Math.abs(background.height - plot.height) < 1
            && background.bottom <= labels.top;
    }), 'Visualization must stay within the EQ bars area');
    await player.screenshot({ path: path.join(artifacts, 'player-eq-background-dark.png') });
    const masterBand = masterEq.getByRole('slider').first();
    await masterBand.press('ArrowUp');
    const editedGain = await masterBand.getAttribute('aria-valuenow');
    await page.getByRole('button', { name: 'Hide master EQ', exact: true }).click();
    assert.deepEqual(await page.locator('.storm-scope').boundingBox(), scopeBounds);
    assert.equal(await masterEq.isVisible(), false);
    await eqToggle.click();
    assert.equal(await masterEq.getByRole('slider').first().getAttribute('aria-valuenow'), editedGain);
    await masterEq.getByRole('button', { name: 'Reset all bands to 0 dB', exact: true }).click();
    assert.ok(await masterEq.getByRole('slider').evaluateAll(bands => bands.every(band => band.getAttribute('aria-valuenow') === '0')));
    await page.getByRole('button', { name: 'Hide master EQ', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Play Storm', exact: true }).textContent(), '');
    assert.ok(await page.locator('.demo-brand img').evaluate(img => img.complete && img.naturalWidth > 0));
    for (const name of ['Light theme', 'Dark theme', 'System theme']) {
        assert.equal(await page.getByRole('button', { name, exact: true }).textContent(), '');
    }
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(5, 8, 17)');
    assert.ok(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage.includes('spaceship-stars.svg')));
    assert.equal((await page.request.get(url + '/images/spaceship-stars.svg')).status(), 200);
    await page.screenshot({ path: path.join(artifacts, 'demo-holographic-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'System theme', exact: true }).hover();
    await page.getByRole('tooltip').waitFor();
    await page.getByRole('button', { name: 'System theme', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'System theme', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    assert.equal(await page.evaluate(() => localStorage.getItem('noised-storm-theme')), 'system');
    await page.getByRole('button', { name: 'Light theme', exact: true }).click();
    await eqToggle.click();
    await player.screenshot({ path: path.join(artifacts, 'player-eq-background-light.png') });
    await page.getByRole('button', { name: 'Hide master EQ', exact: true }).click();
    await selectPreset('far-storm');
    for (const tab of ['Rain', 'Thunder']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        const eq = page.getByRole('tabpanel').locator('.noised-equalizer');
        await eq.getByRole('slider').first().press('ArrowUp');
        await eq.getByRole('slider').last().press('ArrowDown');
        await eq.getByRole('button', { name: 'Reset all bands to 0 dB', exact: true }).click();
        assert.ok(await eq.getByRole('slider').evaluateAll(bands => bands.every(band => band.getAttribute('aria-valuenow') === '0')), tab + ' EQ failed to reset all bands');
    }
    await page.getByRole('tab', { name: 'Rain', exact: true }).click();
    await selectPreset('far-storm');
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
    await page.locator('.storm-scope[data-playing="true"]').waitFor();
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        if (!analyser) return false;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.some(value => Math.abs(value) > 0.0001);
    });
    await page.waitForFunction(() => {
        const canvas = document.querySelector('.storm-scope canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
    });
    // An idle trace also has pixels: verify that the waveform actually animates.
    const waveFrame = await page.locator('.storm-scope canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForFunction(previous => document.querySelector('.storm-scope canvas').toDataURL() !== previous, waveFrame);
    await page.getByRole('button', { name: 'Show frequency bars', exact: true }).click();
    await page.getByRole('img', { name: 'Live frequency bars', exact: true }).waitFor();
    await page.waitForFunction(() => {
        const canvas = document.querySelector('.storm-scope canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
    });
    const barsFrame = await page.locator('.storm-scope canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForFunction(previous => document.querySelector('.storm-scope canvas').toDataURL() !== previous, barsFrame);
    await eqToggle.click();
    const eqFrame = await page.locator('.storm-scope canvas').evaluate(canvas => canvas.toDataURL());
    await page.waitForFunction(previous => document.querySelector('.storm-scope canvas').toDataURL() !== previous, eqFrame);
    assert.equal(await page.locator('.storm-scope canvas').count(), 1);
    await player.screenshot({ path: path.join(artifacts, 'player-eq-background-playing.png') });
    const liveBand = masterEq.getByRole('slider').first();
    await liveBand.press('ArrowUp');
    assert.equal(await liveBand.getAttribute('aria-valuenow'), '1');
    await masterEq.getByRole('button', { name: 'Reset all bands to 0 dB', exact: true }).click();
    await page.getByRole('button', { name: 'Hide master EQ', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__stormProbe.contexts), 1);
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), 1);
    await page.locator('.storm-visualization-controls').screenshot({ path: path.join(artifacts, 'frequency-bars.png') });
    for (const style of visualStyles) {
        await chooseVisualStyle(style);
        await page.waitForTimeout(100);
        await page.locator('.storm-visualization-controls').screenshot({ path: path.join(artifacts, `style-${style.toLowerCase()}-spectrum.png`) });
    }
    await page.getByRole('button', { name: 'Show waveform', exact: true }).click();
    for (const style of visualStyles) {
        await chooseVisualStyle(style);
        await page.waitForTimeout(100);
        await page.locator('.storm-visualization-controls').screenshot({ path: path.join(artifacts, `style-${style.toLowerCase()}-waveform.png`) });
    }
    await chooseVisualStyle('Phosphor');
    assert.equal(await page.evaluate(() => window.__stormProbe.contexts), 1);
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), 1);
    await selectPreset('close-storm');
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), 1);
    const master = masterControls.getByRole('textbox', { name: 'Master Volume', exact: true });
    await master.fill('0'); await master.press('Enter');
    await page.waitForFunction(() => {
        const analyser = window.__stormProbe.analyser;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.every(value => value === 0);
    });
    await page.getByRole('switch', { name: 'Rain enabled' }).click();
    assert.equal(await page.getByRole('switch', { name: 'Rain enabled' }).getAttribute('aria-checked'), 'false');
    await page.getByRole('switch', { name: 'Thunder enabled' }).click();
    assert.equal(await page.getByRole('switch', { name: 'Thunder enabled' }).getAttribute('aria-checked'), 'false');
    await page.getByRole('switch', { name: 'Rain enabled' }).click();
    assert.equal(await page.getByRole('tab', { name: 'Rain', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'Pause Storm' }).click();
    assert.equal(await page.locator('.storm-scope').getAttribute('data-playing'), 'false');
    const starts = await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length);
    await selectPreset('far-storm');
    assert.equal(await page.evaluate(() => window.__stormProbe.messages.filter(message => message.type === 'start').length), starts);

    await page.getByRole('tab', { name: 'Rain', exact: true }).click();
    await page.getByRole('textbox', { name: 'Rate', exact: true }).fill('120');
    await page.getByRole('textbox', { name: 'Rate', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Play Storm', exact: true }).click();
    await page.getByRole('button', { name: 'Pause Storm', exact: true }).waitFor();
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Presets', exact: true }).click();
    await page.getByRole('textbox', { name: 'Preset name', exact: true }).fill('Test Storm');
    await page.getByRole('dialog', { name: 'Presets', exact: true }).screenshot({ path: path.join(artifacts, 'preset-tool-light.png') });
    await page.getByRole('button', { name: 'Save preset', exact: true }).click();
    const parameters = await jsonDownload;
    await parameters.saveAs(path.join(artifacts, parameters.suggestedFilename()));
    const savedPreset = JSON.parse(await readFile(path.join(artifacts, parameters.suggestedFilename()), 'utf8'));
    assert.equal(savedPreset.name, 'Test Storm');
    assert.equal(savedPreset.params.rainParams.dropRate, 120);
    savedPreset.params.masterVolume = 0.37;
    savedPreset.params.rainParams.dropRate = 77;
    await page.getByLabel('Load preset file').setInputFiles({ name: 'test-storm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(savedPreset)) });
    await page.getByText('Loaded Test Storm', { exact: true }).waitFor();
    const importedId = await page.getByRole('combobox', { name: 'Sound preset', exact: true }).inputValue();
    assert.ok(importedId.startsWith('imported-'));
    assert.equal(await page.evaluate(() => window.__stormProbe.contexts), 1);
    assert.equal(await page.evaluate(() => window.__stormProbe.worklets), 1);
    assert.equal(await page.getByRole('button', { name: 'Pause Storm', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('textbox', { name: 'Master Volume', exact: true }).inputValue(), '0.37');
    assert.equal(await page.getByRole('textbox', { name: 'Rate', exact: true }).inputValue(), '77.0');
    await selectPreset('default');
    await selectPreset(importedId);
    assert.equal(await page.getByRole('textbox', { name: 'Master Volume', exact: true }).inputValue(), '0.37');
    await page.getByRole('button', { name: 'Presets', exact: true }).click();
    await page.getByLabel('Load preset file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Sound preset', exact: true }).inputValue(), importedId);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const exportLength = page.getByRole('spinbutton', { name: 'Length (seconds)', exact: true });
    await exportLength.fill('0');
    assert.equal(await page.getByRole('button', { name: 'Download WAV', exact: true }).isDisabled(), true);
    await exportLength.fill('2');
    await page.getByRole('dialog', { name: 'Export audio', exact: true }).screenshot({ path: path.join(artifacts, 'export-tool-light.png') });
    const wavDownload = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Download WAV', exact: true }).click();
    const audio = await wavDownload;
    await audio.saveAs(path.join(artifacts, audio.suggestedFilename()));
    const wav = await readFile(path.join(artifacts, audio.suggestedFilename()));
    assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
    assert.ok(wav.length > 100000);
    assert.equal(wav.readUInt32LE(40), 2 * wav.readUInt32LE(24) * 2 * 2);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Pause Storm', exact: true }).click();
    await page.getByRole('button', { name: 'Play Storm' }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Rain', exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.getByRole('button', { name: 'Visualization styles', exact: true }).click();
    const menuBounds = await page.getByRole('dialog', { name: 'Visualization styles', exact: true }).boundingBox();
    assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 391);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(5, 8, 17)');
    for (const [tab, instructions] of [
        ['Rain', 'Oscillating Parameter Controller'],
        ['Thunder', 'Random Parameter Controller'],
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
    await page.getByRole('tab', { name: 'Rain', exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, 'demo-desktop-dark.png'), fullPage: true });
    for (const width of [320, 390, 768, 1024, 1100, 1101, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Show master EQ', exact: true }).click();
        const eqSize = await page.locator('.storm-scope').boundingBox();
        assert.ok((await page.locator('.storm-visualization-controls').boundingBox()).width <= 330);
        assert.ok(eqSize.height >= 128);
        assert.ok(await masterEq.getByRole('slider').evaluateAll(sliders => sliders.every(slider => {
            const rect = slider.getBoundingClientRect();
            const scope = slider.closest('.storm-scope').getBoundingClientRect();
            return rect.left >= scope.left && rect.right <= scope.right && rect.top >= scope.top && rect.bottom <= scope.bottom;
        })), 'EQ clips at ' + width);
        if (width <= 390) {
            await player.screenshot({ path: path.join(artifacts, `player-eq-${width}.png`) });
            for (const [tool, label] of [['Presets', 'Presets'], ['Export', 'Export audio']]) {
                await page.getByRole('button', { name: tool, exact: true }).click();
                const panel = await page.getByRole('dialog', { name: label, exact: true }).boundingBox();
                assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1, tool + ' overflows at ' + width);
                await page.keyboard.press('Escape');
            }
        }
        for (const tab of ['Rain', 'Thunder']) {
            await page.getByRole('tab', { name: tab }).click();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), tab + ' overflows at ' + width);
            const overflowingGroups = await page.locator('.control-group-body').evaluateAll(groups => groups.flatMap(group => {
                const bounds = group.getBoundingClientRect();
                const clipped = group.scrollWidth > group.clientWidth + 1 || group.scrollHeight > group.clientHeight + 1
                    || [...group.querySelectorAll('.noised-knob, .parameter-heading, .noised-switch, .control-select')].some(control => {
                        const rect = control.getBoundingClientRect();
                        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
                            || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
                    });
                return clipped ? [group.closest('.control-group').querySelector('h3').textContent] : [];
            }));
            assert.deepEqual(overflowingGroups, [], tab + ' has clipped controls at ' + width);
            assert.ok(await masterControls.isVisible(), 'Master controls disappeared on ' + tab);
        }
        await page.getByRole('button', { name: 'Hide master EQ', exact: true }).click();
    }
    await page.getByRole('tab', { name: 'Rain', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Thunder', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('tab', { name: 'Rain', exact: true }).getAttribute('aria-selected'), 'true');
    await page.evaluate(() => window.scrollTo(0, 500));
    assert.ok((await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox()).y >= 7);
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
    console.log('UI integration passed: icon controls, system/light/dark themes, persistent master controls, tab switches and keyboard navigation, audio playback, presets, JSON/WAV downloads and responsive layouts.');
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
