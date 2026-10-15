import assert from 'node:assert/strict';
import { mkdtemp, lstat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.npm_execpath) throw new Error('Run npm run test:package');
const npm = args => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('npm failed: ' + args.join(' '));
};
npm(['run', 'pack:library']);
const tarball = path.join(root, 'artifacts/noised-storm-0.1.0.tgz');
const consumer = await mkdtemp(path.join(tmpdir(), 'noised-storm-consumer-'));
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'standalone-storm-consumer', version: '1.0.0', private: true, type: 'module' }));
const installation = spawnSync(process.execPath, [process.env.npm_execpath, 'install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], { cwd: consumer, stdio: 'inherit' });
if (installation.status !== 0) throw new Error('Standalone package installation failed');
assert.equal((await lstat(path.join(consumer, 'node_modules/noised-storm'))).isSymbolicLink(), false);
const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
import { NoiseDStorm, NoiseDController, RainGenerator } from 'noised-storm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
if (NoiseDStorm !== NoiseDController || typeof RainGenerator !== 'function' || typeof NoiseDStorm.create !== 'function' || typeof NoiseDStorm.prototype.getEngine !== 'function' || typeof require('noised-storm').NoiseDStorm !== 'function') throw new Error('Invalid package API');
await WebAssembly.compile(readFileSync(require.resolve('noised-storm/noised_dsp.wasm')));
if (!readFileSync(require.resolve('noised-storm/rain.worklet.js'), 'utf8').includes('registerProcessor')) throw new Error('Missing standalone worklet');
console.log('Standalone package installed successfully: ESM, CommonJS, declarations, WASM and worklet assets.');
`], { cwd: consumer, stdio: 'inherit' });
if (result.status !== 0) throw new Error('Standalone consumer check failed');
console.log('Consumer fixture:', consumer);
