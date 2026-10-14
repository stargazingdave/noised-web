import { spawnSync } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync('cargo', ['build', '-p', 'noised-dsp', '--release', '--target', 'wasm32-unknown-unknown', '--locked'], {
    cwd: root, stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(new URL('../dist/wasm/', import.meta.url), { recursive: true });
await copyFile(new URL('../target/wasm32-unknown-unknown/release/noised_dsp.wasm', import.meta.url),
    new URL('../dist/wasm/noised_dsp.wasm', import.meta.url));
