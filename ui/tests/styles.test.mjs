import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('default ESM and CommonJS imports share one style element; unstyled imports leave the DOM alone', () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        import { readFileSync } from 'node:fs';
        const require = createRequire(import.meta.url);
        const hostStyle = { host: true };
        const children = [hostStyle];
        globalThis.document = {
            head: {
                querySelector() { return children.find(node => node.attributes?.['data-noised-ui'] !== undefined); },
                prepend(node) { children.unshift(node); },
            },
            createElement(tag) {
                assert.equal(tag, 'style');
                return { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
            },
        };
        await import('./dist/unstyled.js');
        require('./dist/unstyled.cjs');
        assert.equal(children.length, 1);
        await import('./dist/index.js');
        require('./dist/index.cjs');
        await import('./dist/index.js?second-copy');
        assert.equal(children.length, 2);
        assert.equal(children[1], hostStyle);
        assert.equal(children[0].textContent, readFileSync('./dist/styles.css', 'utf8'));
        children[0].textContent = 'stale styles';
        await import('./dist/index.js?updated-copy');
        assert.equal(children.length, 2);
        assert.equal(children[0].textContent, readFileSync('./dist/styles.css', 'utf8'));
    `], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
});
