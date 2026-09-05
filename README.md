# Sketch

A Tampermonkey userscript for Krunker. Sketch intercepts the game's
WASM-compiled bundle at load time, rewrites the obfuscated source to expose the
game's internal objects, and installs its cheat modules and in-game menu onto
them.

Sketch does not work standalone — it requires a **krunkbox** server to serve the
game source and validate keys.

## Requirements

- Node 20+ and npm (build only)
- Tampermonkey, or another userscript manager with `unsafeWindow` support
- A reachable krunkbox instance and a valid key

## Setup

```sh
git clone <this repo>
cd sketch
npm install
```

Create a `.env` in the repo root:

```ini
# Base URL of your krunkbox instance
SKETCH_API_URL=http://127.0.0.1:3001/

# sha512 of the game source this build was written against
SKETCH_SUPPORTED_GAME=b81c2a2bf4db6...

# Version reported to krunkbox for update checks
SKETCH_VERSION=2.1.0

# Dev-only: where the dev API listens
SKETCH_DEV_API_HOST=127.0.0.1
SKETCH_DEV_API_PORT=8085
```

`SKETCH_API_URL`, `SKETCH_SUPPORTED_GAME`, and `SKETCH_VERSION` are required.
They are validated at import time in `src/consts.ts`, so a missing value fails
the build rather than producing a broken script. Production values can live in
`.env.production`.

## Building

| command | what it does |
| --- | --- |
| `npm run build` | build → `dist/sketch.user.js` |
| `npm run watch` | same, rebuilding on change |
| `npm run build:dev` | dev build, also emits `dist/sketch.DEV.user.js` |
| `npm run watch:dev` | dev build + watch + dev server on `http://127.0.0.1:8080/` |
| `npm run check` | `tsc --noEmit` |

Builds default to development. Set `NODE_ENV=production` for a release build,
which strips the dev logging and diagnostics:

```sh
NODE_ENV=production npm run build
```

Install `dist/sketch.user.js` in Tampermonkey. For development, point
Tampermonkey at the dev server instead, so you only need to reload the page
after a rebuild.

## Development Workflow

1. `npm run watch:dev`
2. Install or point Tampermonkey at `http://127.0.0.1:8080/`
3. Edit `src/`, then reload krunker.io

The watcher rebuilds automatically — you do not need to restart it. If a change
appears not to apply, confirm the watcher is still writing output before digging
into the code:

```sh
stat -c '%y %n' src/filters.ts dist/sketch.DEV.user.js
```

Dev builds log their progress. A healthy load looks like:

```
[sketch] TextDecoder constructor replaced
[DEV] patching io/game/render/overlay/settings worked: true
[sketch] intercepted game source: 8669826 chars
[sketch] captured overlay
[sketch] captured render
[sketch] captured game
[sketch] captured settings
[sketch] ws open
[sketch] render hooks installed
```

`patching X worked: true` only means the patch regex matched while rewriting the
source. The `captured X` lines are what confirm the hooks actually ran.

## How It Works

Krunker ships its client as an obfuscated bundle that is decompressed and
compiled inside a WASM loader, so there is no plain `<script>` to intercept.
Sketch works around that in five stages:

1. **Intercept** — `src/dogehook.ts` replaces `window.TextDecoder` and overrides
   `decode` per instance. When the loader decodes something larger than
   `GAME_SOURCE_MIN` (5,000,000 chars), that is the game source. The hook then
   uninstalls itself.
2. **Fetch and verify** — `src/KrunkBox.ts` and `src/inject.ts` retrieve the
   source and the `renamed` globals map from krunkbox and check version
   compatibility.
3. **Patch** — `src/filters.ts` applies a small set of regexes that splice
   `data.capture*(this)` calls next to stable, non-obfuscated string literals in
   the bundle (`'clearSkyDome'`, `'isServer'`, `'hideNames'`,
   `'bundleMedalFilters'`, `new WebSocket`). This hands Sketch live references
   to the game, renderer, overlay, settings, and socket objects.
4. **Inject** — a generated prologue declares the globals the bundle expects,
   read from a non-enumerable `window.__sketchInject`, and calls `beforeGame()`.
   The patched source is returned to the loader in place of the original.
5. **Hook** — as each object is captured, the corresponding hook installer runs
   and the cheat modules in `src/cheats/` attach to the render, input, and
   overlay loops. Once the game object is usable, the Sketch menu button mounts.

## Features

Cheat modules live in `src/cheats/`:

- Aimbot, triggerbot, recoil control, force-auto
- ESP
- Bhop
- Skin changer (`skins.tsx` + `skinhack/`)
- Custom skyboxes
- Adblock, watermark, keybind overlay

Configuration is edited through the in-game menu (`src/menu/`) and persisted via
the userscript manager's storage. `src/presets/` ships `rage` and `legit`
presets, selectable from the menu.

## Project Layout

```
src/
  index.ts        entry: version check, token, injection, load orchestration
  inject.ts       prepareSource(): fetch, seed inject args, run patches
  filters.ts      source patches, runtime state, hook arrays
  dogehook.ts     TextDecoder interception, source interceptor
  hook.ts         toString spoofing (mirrorAttributes / setNativeFunction)
  consts.ts       env, environment detection, getExposedWindow()
  cheats/         one module per cheat
  menu/           preact menu + the in-game button
  presets/        rage / legit config presets
  krunker/        hand-written type definitions for game objects
  sketchConfig.ts persisted settings
build.js          esbuild config + dev server
meta.json         userscript header (meta.dev.json for dev builds)
skyboxes/         bundled skybox assets
```

See `AGENTS.md` for architecture notes, the patch-anchor table, and the list of
approaches that are known not to work.

## Troubleshooting

**Build fails with `Invalid SKETCH_API_URL` or `Invalid SKETCH_SUPPORTED_GAME`**
Your `.env` is missing a required value.

**`address already in use 127.0.0.1:8085`**
A previous dev server is still running:

```sh
fuser -k 8085/tcp; fuser -k 8080/tcp
```

**Socket errors, or the game never connects**
The matchmaking token is not reaching `/seek-game`. In a dev build the
`[sketch] mmToken:` line will say `PLACEHOLDER` instead of `real (N chars)`.

**The game loads but no Sketch button appears**
Check for `captured game` in the console. The button mounts from `onGameHooks`,
which only runs after the game object is captured and populated.

**Nothing is patched after a game update**
Krunker changed the bundle and the patch anchors no longer match. You will need
new anchors and a new `SKETCH_SUPPORTED_GAME` checksum — see `AGENTS.md`.
