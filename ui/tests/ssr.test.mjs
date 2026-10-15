import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Knob, Equalizer, AmpToggleSwitch, Visualization } from '../dist/index.js';

test('controls render on the server without a browser or audio engine', () => {
    const markup = renderToStaticMarkup(createElement('div', null,
        createElement(Knob, { label: 'Gain', min: -12, max: 12, value: 0, onChange() {} }),
        createElement(Equalizer, { gains: [0, 3], freqs: [100, 1000], onChange() {} }),
        createElement(AmpToggleSwitch, { label: 'Bypass', checked: true, onChange() {} }),
        createElement(Visualization, { analyser: null, isPlaying: false, height: 80 }),
    ));
    assert.match(markup, /aria-label="Gain"/);
    assert.match(markup, /aria-label="Gain at 1.0k"/);
    assert.match(markup, /role="switch" aria-checked="true"/);
    assert.match(markup, /noised-visualization/);
    assert.match(markup, /aria-label="Live audio waveform"/);
});

test('EQ exposes a Flat reset and disables it when all bands are already flat', () => {
    const nonFlat = renderToStaticMarkup(createElement(Equalizer, { gains: [0, 4, -3], freqs: [100, 1000, 10000], onChange() {} }));
    assert.match(nonFlat, /aria-label="Reset all bands to 0 dB"/);
    assert.match(nonFlat, />Flat<\/button>/);
    assert.doesNotMatch(nonFlat, /disabled=""/);
    const flat = renderToStaticMarkup(createElement(Equalizer, { gains: [0, 0], freqs: [100, 1000], onChange() {} }));
    assert.match(flat, /disabled=""/);
});

test('all visualization styles render on the server without audio or canvas access', () => {
    for (const visualStyle of ['phosphor', 'aurora', 'valve', 'matrix']) {
        for (const type of ['waveform', 'spectrum']) {
            const markup = renderToStaticMarkup(createElement(Visualization, { analyser: null, isPlaying: false, visualStyle, type }));
            assert.ok(markup.includes(`data-style="${visualStyle}"`));
            assert.ok(markup.includes(`data-type="${type}"`));
        }
    }
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

test('compact controls preserve accessible values and explicit sizes', () => {
    const compactKnob = renderToStaticMarkup(createElement(Knob, { density: 'compact', value: 0.5, min: 0, max: 1, onChange() {} }));
    assert.match(compactKnob, /width="64"/);
    assert.match(compactKnob, /aria-valuemin="0" aria-valuenow="0.5"/);
    const sizedKnob = renderToStaticMarkup(createElement(Knob, { density: 'compact', size: 48, value: 0, onChange() {} }));
    assert.match(sizedKnob, /width="48"/);
    const eq = renderToStaticMarkup(createElement(Equalizer, { density: 'compact', gains: [-6, 3, 18], freqs: [100, 1000, 10000], min: -6, max: 18, onChange() {} }));
    assert.match(eq, /height:128px/);
    assert.equal([...eq.matchAll(/aria-orientation="vertical"/g)].length, 3);
    assert.match(eq, /aria-valuetext="\+3 dB"/);
    assert.match(eq, /data-zero="true" style="top:75%"/);
    const defaultKnob = renderToStaticMarkup(createElement(Knob, { value: 0, onChange() {} }));
    assert.match(defaultKnob, /width="100"/);
});
