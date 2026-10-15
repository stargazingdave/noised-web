# NoiseD UI

React controls for audio interfaces: `Knob`, `Equalizer`, and `AmpToggleSwitch`.
The package includes ESM, CommonJS, TypeScript declarations and scoped plain CSS.
It has no dependency on NoiseD Storm, Web Audio, Tailwind, or a theme provider.

## Install and use

From another project, install the locally packed library:

```sh
npm install /path/to/noised-ui-0.1.0.tgz
```

React is a peer dependency; the package accepts React 18 or 19. The monorepo
currently tests with React 19. Import the stylesheet once in your app entry point.

```tsx
import { useState } from 'react';
import { Knob, Equalizer, AmpToggleSwitch } from 'noised-ui';
import 'noised-ui/styles.css';

export function AudioControls() {
  const [volume, setVolume] = useState(0.5);
  const [gains, setGains] = useState([0, 0, 0]);
  const [enabled, setEnabled] = useState(true);

  return <>
    <Knob label="Volume" min={0} max={1} step={0.01}
      value={volume} onChange={setVolume} disabled={!enabled} />
    <Equalizer freqs={[100, 1000, 10000]} gains={gains}
      onChange={(index, value) => setGains(current =>
        current.map((gain, i) => i === index ? value : gain))} />
    <AmpToggleSwitch label="Enabled" checked={enabled} onChange={setEnabled} />
  </>;
}
```

All controls are controlled components: the caller owns the current values and
handles changes. Audio-engine bindings and application themes belong in the app.
The Storm demo provides an example of these bindings.

## Components

- **Knob**: required `value` and `onChange`; optional `min` (0), `max` (100),
  `step` (1), `label`, `disabled`, `size` (100 pixels), `strokeWidth`, `trackWidth`,
  `colors`, `density` and `className`. Supports pointer dragging, arrow/Page keys and an
  editable numeric value. Colors: `labels`, `body`, `face`, `indicator`, `track`.
  Use six-digit hex values for the body color, which generates a shaded gradient.
- **Equalizer**: required `gains`, `freqs` and `onChange(index, value)`. Supply
  matching frequency/gain arrays. Optional `min` (-12), `max` (12), `height` (200
  pixels), `rotateLabels`, `className` and `colors` (`bar`, `background`, `Hz`, `dB`).
  Also accepts `density`. Supports full-column pointer dragging, arrow/Page keys,
  Home/End, Shift for fine adjustment, and double-click to reset a band to 0 dB.
  Frequency labels align with the faders; guides include the zero-dB position.
  The dB scale adapts to available width, and hover/focus shows the exact gain.
- **AmpToggleSwitch**: required `checked` and `onChange`; optional `label`,
  `disabled` and `className`. A keyboard-accessible switch with an amp-style lever.

Prop/color interfaces are exported alongside the components. Use a positive
`step` and `max > min` for numeric controls.

### Compact controls

`Knob` and `Equalizer` accept `density="compact"`. The default remains
`"comfortable"` for existing consumers. Compact knobs use a 64px dial and omit
the min/max captions while retaining an editable value and accessible bounds.
Compact EQs are 128px tall with a three-tick scale and shorter frequency labels.
Explicit `size` (knob) or `height` (EQ) overrides the density's default dimensions.

```tsx
<Knob density="compact" label="Volume" value={volume} onChange={setVolume} />
<Equalizer density="compact" gains={gains} freqs={frequencies} onChange={setBand} />
```

The library owns layout and interaction; consumers still choose their own
colors, panel widths, and surrounding spacing. `ControlDensity` is exported
for wrappers that forward a density option.

## Styling

`noised-ui/styles.css` provides component styles without a global page reset.
Classes are prefixed `noised-`. Controls inherit text color and can be customized
with their color props or an app-owned `className`. The focus outline color can
be changed with the inherited `--noised-focus-color` CSS custom property.
Motion respects `prefers-reduced-motion`.

Import your overrides after the library stylesheet. No CSS tooling is required.
The stylesheet is marked as a package side effect so bundlers preserve it.

## Develop

From the repository root:

```sh
npm run build --workspace=noised-ui
npm run dev:ui
npm run test --workspace=noised-ui
npm run pack:ui
```

The package is independently versioned. `prepack` rebuilds the JavaScript,
declarations and CSS so the tarball contains everything consumers need.
