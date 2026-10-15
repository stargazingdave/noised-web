import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Knob, Equalizer, AmpToggleSwitch } from '../dist/index.js';

test('controls render on the server without a browser or audio engine', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
        createElement(Knob, { label: 'Gain', min: -12, max: 12, value: 0, onChange() {} }),
        createElement(Equalizer, { gains: [0, 3], freqs: [100, 1000], onChange() {} }),
        createElement(AmpToggleSwitch, { label: 'Bypass', checked: true, onChange() {} }),
    ));
    assert.match(markup, /aria-label="Gain"/);
    assert.match(markup, /aria-label="Gain at 1.0k"/);
    assert.match(markup, /role="switch" aria-checked="true"/);
});

test('multiple knobs have independent SVG gradients', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
        ...[0, 1].map(value => createElement(Knob, { key: value, value, onChange() {} })),
    ));
    const ids = [...markup.matchAll(/<radialGradient id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    for (const id of ids) assert.ok(markup.includes(`fill="url(#${id})"`));
});

test('disabled controls expose their state and remove the knob from the tab order', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
        createElement(Knob, { value: 0.5, min: 0, max: 1, disabled: true, onChange() {} }),
        createElement(AmpToggleSwitch, { checked: false, disabled: true, onChange() {} }),
    ));
    assert.match(markup, /aria-disabled="true"/);
    assert.match(markup, /tabindex="-1"/);
    assert.match(markup, /disabled=""/);
});
