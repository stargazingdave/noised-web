# NoiseD Web

NoiseD Storm and NoiseD UI are independent libraries managed by one npm workspace.
The Storm demo consumes both; it is private and is not published.

| Directory | Package / purpose | Documentation |
| --- | --- | --- |
| `storm/engine` | `noised-storm`: Rust/WASM rain and Web Audio thunder | [Engine API, assets and lifecycle](storm/engine/README.md) |
| `ui` | `noised-ui`: React audio controls with automatic scoped styling | [Components, styling and SSR](ui/README.md) |
| `storm/demo` | Vite/React player using both libraries | [Layout, presets and export](storm/demo/README.md) |
| `scripts` | Browser and standalone-package checks | Verification below |
| `artifacts` | Ignored screenshots, downloaded audio and tarballs | Local output only |

The sibling `../vst-plugins` directory is a separate Git repository for native
JUCE plugins. It has its own C++ build and UI; this workspace does not build it.

## Set up and develop

Source builds require Node 22.12+, npm 11.21+, Rust stable and the
`wasm32-unknown-unknown` target. Run workspace commands from this directory:

```sh
rustup target add wasm32-unknown-unknown
npx npm@11.21.0 ci
npm run dev
```

The player opens at http://127.0.0.1:5173/. `dev` builds the two libraries before
starting Vite. Use `npm run dev:ui` in a second terminal to watch UI source and CSS.
Engine changes require rebuilding the engine; demo source uses Vite hot reload.

| Command | Result |
| --- | --- |
| `npm run build` | Builds engine JS/WASM, UI entries/styles/types, then `storm/demo/dist` |
| `npm run typecheck` | Checks all three TypeScript workspaces |
| `npm test` | Engine Node/Rust tests, UI tests, demo tests |
| `npm run check` | Build, typecheck and unit tests |
| `npm run preview` | Serves the built demo at http://127.0.0.1:4173/ |
| `npm run test:ui` | Chrome checks against the built demo: playback, controls, themes, files and responsive layout |
| `npm run test:package` | Installs packed libraries in an independent consumer; checks exports, types, SSR, assets, automatic/explicit styles and interactions |
| `npm run bench` | Rain performance benchmark |

Browser checks need installed Chrome. Set `NOISED_BROWSER_CHANNEL` to another
installed Playwright browser channel, or `NOISED_PLAYWRIGHT_PATH` to a Playwright
module path. Screenshots, downloads and tarballs are saved under `artifacts/`.

## Consume or package a library

```sh
npm run pack:library
npm run pack:ui
```

Install `artifacts/noised-storm-0.1.0.tgz` or `artifacts/noised-ui-0.1.0.tgz` in
another project. Package versions are independent. Consumers need neither this
checkout nor Rust; worklet/WASM assets are included in the engine package.
React 18 or 19 is a UI peer dependency. Storm itself has no React dependency.

```tsx
import { Knob, Equalizer, Visualization } from 'noised-ui';
// Styles are installed automatically in the browser. No CSS import is needed.
```

For SSR first-paint CSS or explicit style control, use `noised-ui/unstyled`
with `noised-ui/styles.css`; see the [UI README](ui/README.md). Neither library
requires Tailwind or a theme provider. Storm audio needs browser Web Audio,
HTTPS or localhost, and initialization from a user interaction.

## GitHub Pages deployment

Live demo: https://stargazingdave.github.io/noised-web/.

The [Pages workflow](.github/workflows/deploy-pages.yml) deploys each push to
`main` and supports manual runs from Actions. It installs locked npm dependencies
and Rust's WASM target, builds both libraries before the demo, then uploads only
`storm/demo/dist` to the `github-pages` environment. Actions use pinned commits.

Set Settings > Pages > Source to **GitHub Actions**. No custom deployment token
or secrets are required. The deployment job uses GitHub's built-in token.
Its environment links to the deployed URL; check the Actions run for failures.

Vite receives `VITE_BASE_PATH` from Pages metadata. Development defaults to `/`.
To check a production project path locally in PowerShell:

```powershell
$env:VITE_BASE_PATH = '/noised-web/'
npm run build
npm run test:ui
npm run preview
# Open http://127.0.0.1:4173/noised-web/
# After stopping preview:
Remove-Item Env:VITE_BASE_PATH
```

On POSIX shells, use `export VITE_BASE_PATH=/noised-web/` and unset it afterward.
Keep the same base path for build, browser check and preview. Logo, starfields,
JS, CSS, WASM and AudioWorklet URLs respect the configured path.
