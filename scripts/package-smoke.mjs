import assert from 'node:assert/strict';
import { mkdtemp, lstat, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build, preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NOISED_PLAYWRIGHT_PATH || 'playwright');

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.npm_execpath) throw new Error('Run npm run test:package');
const npm = args => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('npm failed: ' + args.join(' '));
};
npm(['run', 'pack:library']);
npm(['run', 'pack:ui']);
const stormManifest = JSON.parse(await readFile(path.join(root, 'storm/engine/package.json'), 'utf8'));
const uiManifest = JSON.parse(await readFile(path.join(root, 'ui/package.json'), 'utf8'));
const tarball = path.join(root, 'artifacts', `${stormManifest.name}-${stormManifest.version}.tgz`);
const uiTarball = path.join(root, 'artifacts', `${uiManifest.name}-${uiManifest.version}.tgz`);
const consumer = await mkdtemp(path.join(tmpdir(), 'noised-storm-consumer-'));
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'standalone-storm-consumer', version: '1.0.0', private: true, type: 'module' }));
const demo = JSON.parse(await readFile(path.join(root, 'storm/demo/package.json'), 'utf8'));
const installation = spawnSync(process.execPath, [process.env.npm_execpath, 'install', '--ignore-scripts', '--no-audit', '--no-fund',
    tarball, uiTarball, `react@${demo.dependencies.react}`, `react-dom@${demo.dependencies['react-dom']}`,
    `@types/react@${demo.devDependencies['@types/react']}`, `@types/react-dom@${demo.devDependencies['@types/react-dom']}`], { cwd: consumer, stdio: 'inherit' });
if (installation.status !== 0) throw new Error('Standalone package installation failed');
assert.equal((await lstat(path.join(consumer, 'node_modules/noised-storm'))).isSymbolicLink(), false);
assert.equal((await lstat(path.join(consumer, 'node_modules/noised-ui'))).isSymbolicLink(), false);
const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
import { NoiseDStorm, NoiseDController, RainGenerator } from 'noised-storm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
if (NoiseDStorm !== NoiseDController || typeof RainGenerator !== 'function' || typeof require('noised-storm').NoiseDStorm !== 'function') throw new Error('Invalid package API');
await WebAssembly.compile(readFileSync(require.resolve('noised-storm/noised_dsp.wasm')));
if (!readFileSync(require.resolve('noised-storm/rain.worklet.js'), 'utf8').includes('registerProcessor')) throw new Error('Missing standalone worklet');
console.log('Standalone package installed successfully: ESM, CommonJS, declarations, WASM and worklet assets.');
const { Knob, Equalizer, AmpToggleSwitch } = await import('noised-ui');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
for (const [component, props] of [[Knob, { value: 0, onChange() {} }], [Equalizer, { gains: [0], freqs: [100], onChange() {} }], [AmpToggleSwitch, { checked: false, onChange() {} }]]) {
    if (!renderToStaticMarkup(createElement(component, props)).length) throw new Error('UI SSR failed');
}
if (typeof require('noised-ui').Knob !== 'function') throw new Error('Missing UI CommonJS export');
if (!readFileSync(require.resolve('noised-ui/styles.css'), 'utf8').includes('.noised-knob')) throw new Error('Missing UI CSS export');
`], { cwd: consumer, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Standalone consumer check failed');

// Exercise the published library with its own CSS, outside Storm and the workspace.
await writeFile(path.join(consumer, 'index.html'), '<!doctype html><html><head><title>NoiseD UI consumer</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(consumer, 'main.tsx'), `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Knob, Equalizer, AmpToggleSwitch, type KnobProps } from 'noised-ui';
import 'noised-ui/styles.css';
function App() {
    const [gain, setGain] = useState(0);
    const [gains, setGains] = useState([0, 0, 0]);
    const [enabled, setEnabled] = useState(true);
    const [compactGains, setCompactGains] = useState(Array(10).fill(0));
    const props: KnobProps = { label: 'Gain', value: gain, onChange: setGain, min: -12, max: 12, step: 0.5 };
    return <div>
        <h1>Standalone controls</h1>
        <Knob {...props} disabled={!enabled} />
        <section aria-label="Default EQ" style={{ width: 300 }}><Equalizer gains={gains} freqs={[100, 1000, 10000]} onChange={(index, value) => setGains(current => current.map((gain, i) => i === index ? value : gain))} /></section>
        <AmpToggleSwitch label="Enabled" checked={enabled} onChange={setEnabled} />
        <h2>Compact controls</h2>
        <Knob {...props} label="Compact gain" density="compact" />
        <section id="compact-eq" aria-label="Compact EQ" style={{ width: 300 }}>
            <Equalizer density="compact" gains={compactGains} freqs={[31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]}
                onChange={(index, value) => setCompactGains(current => current.map((gain, i) => i === index ? value : gain))} />
        </section>
    </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
`);
await writeFile(path.join(consumer, 'types.cts'), `import { Knob, type KnobProps } from 'noised-ui';
const props: KnobProps = { value: 0, onChange(value: number) {} }; void Knob; void props;
`);
const compiler = require.resolve('typescript/bin/tsc');
for (const [module, resolution, file] of [['ESNext', 'bundler', 'main.tsx'], ['NodeNext', 'NodeNext', 'types.cts']]) {
    const checked = spawnSync(process.execPath, [compiler, '--noEmit', '--strict', '--skipLibCheck', '--jsx', 'react-jsx',
        '--target', 'ES2022', '--module', module, '--moduleResolution', resolution, file], { cwd: consumer, stdio: 'inherit' });
    if (checked.status !== 0) throw new Error(`Standalone ${module} declarations failed`);
}
await build({ root: consumer, configFile: false, logLevel: 'warn', build: { outDir: 'dist' } });
const server = await preview({ root: consumer, configFile: false, logLevel: 'warn', preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
    browser = await chromium.launch({ channel: process.env.NOISED_BROWSER_CHANNEL || 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    const knob = page.getByRole('slider', { name: 'Gain', exact: true });
    await knob.press('ArrowUp');
    assert.equal(await knob.getAttribute('aria-valuenow'), '0.5');
    const input = page.getByRole('textbox', { name: 'Gain', exact: true });
    await input.fill('6.2');
    await input.press('Enter');
    assert.equal(await knob.getAttribute('aria-valuenow'), '6');
    const bounds = await knob.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.95, { steps: 5 });
    await page.mouse.up();
    assert.equal(await knob.getAttribute('aria-valuenow'), '12');
    const band = page.getByRole('region', { name: 'Default EQ' }).getByRole('slider', { name: 'Gain at 1.0k', exact: true });
    await band.press('ArrowUp');
    assert.equal(await band.getAttribute('aria-valuenow'), '1');
    const bandBounds = await band.boundingBox();
    await page.mouse.click(bandBounds.x + bandBounds.width / 2, bandBounds.y + bandBounds.height * 0.25);
    assert.ok(Number(await band.getAttribute('aria-valuenow')) > 5);
    const compact = page.getByRole('region', { name: 'Compact EQ' });
    assert.equal((await compact.locator('.noised-equalizer').boundingBox()).height, 128);
    assert.equal((await page.getByRole('slider', { name: 'Compact gain', exact: true }).boundingBox()).width, 64);
    assert.equal(await compact.getByRole('slider').count(), 10);
    const compactBand = compact.getByRole('slider', { name: 'Gain at 1.0k', exact: true });
    await compactBand.press('End');
    assert.equal(await compactBand.getAttribute('aria-valuenow'), '12');
    await compactBand.press('Home');
    assert.equal(await compactBand.getAttribute('aria-valuenow'), '-12');
    await compactBand.press('Shift+ArrowUp');
    assert.equal(await compactBand.getAttribute('aria-valuenow'), '-11.9');
    await compactBand.dblclick();
    assert.equal(await compactBand.getAttribute('aria-valuenow'), '0');
    const compactBounds = await compactBand.boundingBox();
    assert.ok(compactBounds.width >= 24);
    // Hit the edge of the band column, outside the narrow visible fader.
    await page.mouse.move(compactBounds.x + 1, compactBounds.y + compactBounds.height * 0.25);
    await page.mouse.down();
    await page.mouse.up();
    assert.ok(Math.abs(Number(await compactBand.getAttribute('aria-valuenow')) - 6) <= 0.2);
    assert.ok(await compactBand.locator('.noised-equalizer__readout').isVisible());
    const alignment = await compact.evaluate(section => {
        const sliders = [...section.querySelectorAll('.noised-equalizer__slider')];
        const labels = [...section.querySelectorAll('.noised-equalizer__frequency')];
        return sliders.every((slider, index) => {
            const a = slider.getBoundingClientRect();
            const b = labels[index].getBoundingClientRect();
            return Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 1;
        });
    });
    assert.ok(alignment, 'Frequency labels do not align with their faders');
    await compact.evaluate(section => { section.style.width = '240px'; });
    await compact.locator('.noised-equalizer__scale').waitFor({ state: 'detached' });
    assert.ok(await compact.evaluate(section => section.scrollWidth <= section.clientWidth));
    await compact.evaluate(section => { section.style.width = '300px'; });
    await compact.locator('.noised-equalizer__scale').waitFor();
    const toggle = page.getByRole('switch', { name: 'Enabled' });
    await toggle.press('Space');
    assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    assert.equal(await knob.getAttribute('aria-disabled'), 'true');
    assert.equal(await input.isDisabled(), true);
    const styles = await page.evaluate(() => ({
        display: getComputedStyle(document.querySelector('.noised-knob')).display,
        switchWidth: document.querySelector('.noised-switch__button').getBoundingClientRect().width,
        bodyMargin: getComputedStyle(document.body).margin,
    }));
    assert.equal(styles.display, 'flex');
    assert.equal(styles.switchWidth, 24);
    assert.equal(styles.bodyMargin, '8px'); // The library must not reset the host page.
    await mkdir(path.join(root, 'artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'artifacts/ui-standalone.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Standalone UI passed: ESM/CommonJS, both declaration formats, scoped CSS, pointer/keyboard controls, disabled state and SSR.');
} finally {
    await browser?.close();
    await new Promise(resolve => server.httpServer.close(resolve));
}
console.log('Consumer fixture:', consumer);
