# Sketch — Browsing Guide

Sketch is a Tampermonkey userscript that hijacks Krunker's WASM-loaded game
bundle at load time, string-patches the obfuscated source, and installs cheat
hooks into the resulting objects. It pairs with the **krunkbox** server, which
serves the game source, the userscript, and the token/matchmaking endpoints.

## When To Use This Skill

Use this for anything under `src/`: the injection pipeline, source patches,
cheat modules, or the preact menu. Cross-reference `../Krunker_v7.1.4/` (the
readable reference client) whenever you need to find or verify a patch anchor —
see "Finding patch anchors".

## Entrypoints

- `npm run build` → `node ./build.js` (esbuild → `dist/sketch.user.js`)
- `npm run watch` → same, `--watch`
- `npm run build:dev` / `npm run watch:dev` → `--dev`; also emits
  `dist/sketch.DEV.user.js` and serves it on `http://127.0.0.1:8080/`
- `npm run check` → `tsc --noEmit`. **There is no `typecheck` script.**

The dev watcher hot-rebuilds, so you do not need to restart it after editing
`src/`. It has been OOM-killed (exit 137) and has also gone *deaf* while still
looking alive under `pgrep`, so if a change seems not to apply, compare mtimes
before blaming the code:

```sh
stat -c '%y %n' src/filters.ts dist/sketch.DEV.user.js
```

Env comes from `.env` / `.env.production` and is inlined by esbuild:
`SKETCH_API_URL`, `SKETCH_SUPPORTED_GAME` (sha512 of the supported game
source), `SKETCH_VERSION`, `SKETCH_DEV_API_HOST`, `SKETCH_DEV_API_PORT`.
`src/consts.ts` throws at import time if any of the first three are missing.

## The Injection Pipeline

Read these five files in order; they are the whole load path.

1. **`src/index.ts`** — `main()`. Version-checks against krunkbox, resolves a
   token, calls `prepareSource`, registers the source interceptor, then awaits
   `gameLoad`. Also builds the **prologue** and pushes the `afterGame` +
   `sketchButton()` runner onto `onGameHooks`.
2. **`src/inject.ts`** — `prepareSource()`. Pulls the game source from krunkbox,
   installs the `renamed` globals map (e.g. `JfCzGzvGIQB8rrJX = setTimeout`),
   seeds `injectArgs`, and hands the source to `hook`.
3. **`src/filters.ts`** — `hook` applies every entry in `patches` to the ~8.6M
   char obfuscated bundle. Also holds all runtime state, capture callbacks, and
   hook arrays. The biggest and most important file in the repo.
4. **`src/dogehook.ts`** — how we actually obtain the source. Krunker compiles
   the bundle inside WASM, so we replace **`window.TextDecoder`** (the static
   property, *not* the prototype) and override `decode` per instance. It
   self-uninstalls on first hit.
5. **`src/hook.ts`** — `mirrorAttributes` / `setNativeFunction` /
   `hookContext`, the `Function.prototype.toString` spoofing layer.

### The prologue

`buildPrologue()` in `src/index.ts` emits a `var` declaration for every key in
`injectArgs`, sourced from `window.__sketchInject` (`__si`), then calls
`__si.beforeGame()`. The emitted set is driven by `Object.keys(injectArgs)`, so
**removing a key removes its declaration** and the game source will throw a
`ReferenceError` for it.

`WP_MMToken` is special-cased. The WASM loader invokes the patched body with
the *real* matchmaking token as `arguments[0]`, so the prologue prefers that and
only falls back to `__si["WP_MMToken"]`. Clobbering it with the placeholder is
what caused the long "socket error" hunt — the token is forwarded to
`/seek-game` as `validationToken` (see `../Krunker_v7.1.4/src/index.js:11-13`,
which decodes it via `charCodeAt(0) - 5`).

`__sketchInject` is defined non-enumerable so it stays out of
`Object.keys(window)` and `for-in`. It is deliberately **not** deleted after
use; the prologue guards with `if (__si && __si.beforeGame)` instead.

## Source Patches

`patches` in `src/filters.ts` maps a name to `[RegExp, replacer]`. Each splices
a `data.capture*` call into the obfuscated source so we get a reference to the
real object at construction time. `dataArg` is a per-load random identifier;
`const v` matches the bundle's homoglyph identifier style (`[iIìíîïÌÍÎÏ]+`).

| patch | anchor | captures |
| --- | --- | --- |
| `patches.io` | `(this\|<v>)[<v>(0x…)]=new WebSocket(<v>)` | the socket |
| `patches.game` | `this['isServer']=!!(<v>),this['isClient']` | `Game` |
| `patches.render` | `,this['clearSkyDome']=function()` | `RenderManager` |
| `patches.overlay` | `]=null,(<v>)['hideNames']=!0x1,` | overlay module |
| `patches.settings` | `this['tmp']={},this['bundleMedalFilters']=function()` | settings |

`patches.game` must stay disambiguated: `isServer` also appears in the players
module, distinguished only by the trailing `this['isClient']` vs
`this['liveObjects']`.

Each `capture*` runs **mid-constructor**, so all four are wrapped in
`try/catch`. `captureGame` and `captureRender` cannot run their hooks
immediately — they defer via `waitFor` until the object's fields are populated
(`attach && players && controls && map`, and
`scene && camera && renderer && game.players`). `captureOverlay` and
`captureSettings` run synchronously.

`[DEV] patching X worked: true` only means **the regex matched during
rewriting**. It does not mean the capture fired. Confirm with the
`captured <name>` log lines.

### Finding patch anchors

1. Locate the behavior in `../Krunker_v7.1.4/` (readable source).
2. Grep the real obfuscated bundle for surviving string literals — quoted
   property names like `'clearSkyDome'` are *not* obfuscated.
3. Verify the regex matches **exactly once** before trusting it.

The extracted bundle is ~10.7MB on a single line, which breaks the obvious
tooling:

- `grep -c` always returns `1`. Use `grep -o … | wc -l`.
- `grep -o` is pathologically slow. Use `rg`, backgrounded, writing to a file.

## Do Not Do These

Each of these was tried and cost real debugging time.

- **Do not trap `Object.prototype` accessors.** By the time `beforeGame` runs,
  `Object.prototype` is already non-extensible (and `Reflect.defineProperty`
  returns `false` rather than throwing). Installing them earlier, at
  document-start, *succeeds* and then hangs the loader: the mere existence of
  accessors named `render`/`controls` makes every object report
  `'render' in obj === true`, which breaks Emscripten's boot. Whatever performs
  the lockdown does not go through `preventExtensions` / `seal` / `freeze` /
  `Reflect.preventExtensions` — hooking all four never fired once. Use a source
  patch instead.
- **Do not install write-only accessors.** `defineProperty(x, k, { set })` with
  no getter made reads return `undefined` once hook timing was deferred, which
  surfaced as `this[…] is not a function` in `getMat` and then a frozen game.
  Use the `wrapLoadTexture` / `wrapAdd` pattern: wrap in place if the value is
  already a function, otherwise fall back to the setter.
- **Do not skip `hookContext`.** It installs the `Function.prototype.toString`
  hook backed by the `functionStrings` WeakMap. Until it runs, *every*
  `mirrorAttributes` / `setNativeFunction` call in the codebase is inert and
  e.g. `localStorage.getItem.toString()` leaks Sketch's real source. It is the
  first `beforeGame` hook and must stay that way.
- **Do not lower `GAME_SOURCE_MIN`.** The skins blob is ~1.2M chars and the game
  source is ~8.67M. At 1M the skins data got patched too, yielding
  `Bad token NaN isn't a type`. It is 5,000,000.
- **Do not run `afterGame` from the epilogue.** `buildEpilogue()` returns `''`
  on purpose; the wrapper returns long before async game init finishes.
  `afterGame` and `sketchButton()` hang off `onGameHooks`.

## Runtime State & Hooks

`src/filters.ts` exposes accessors (`getGame`, `getRender`, `getOverlay`,
`getSettings`, `getIO`, `getConfig`, `getGameConfig`, `getActiveMap`,
`getLocalPlayer`, `getBox`) plus hook arrays that cheats push onto:

- `beforeGame` / `afterGame` — lifecycle
- `onGameHooks` — once the `Game` object is usable
- `onIoHooks` — per socket
- `inputHooks` — per input tick, receives the inputs array
- `preRenderHooks`, `renderObjHooks` — render loop
- `overlayRenderHooks`, `preOverlayRenderHooks` — overlay loop

Per-frame hooks run through `runHooks(label, hooks)`, which isolates each hook
and routes failures to `reportHookError`, deduped by `label + ":" + message` and
dev-only. This exists because one throwing input hook previously spammed
`Uncaught Error: Too early` every single frame.

`data.socket` constructs sockets via `new (getExposedWindow().WebSocket)(arg)`.
The page realm matters: a cross-realm `ArrayBuffer` fails msgpack's
`instanceof` checks.

## Everything Else

- `src/cheats/` — one module per cheat: `aimbot`, `triggerbot`, `esp`, `bhop`,
  `recoilControl`, `forceAuto`, `skins` + `skinhack/`, `adblock`, `watermark`,
  `keybindOverlay`, `analytics`. `src/cheats.ts` imports them for side effects.
- `src/menu/` — preact menu (`Menu.tsx`) and `createUI.tsx` (`sketchButton`).
- `src/presets/` — `rage.ts`, `legit.ts`; both are `Partial<SketchConfig>` and
  are registered in the `presets` record in `Menu.tsx`.
- `src/sketchConfig.ts` / `tokenConfig.ts` / `Config.ts` — persisted config on
  top of `src/values.ts` (`GMJSONStorage` in the browser, `FSJSONStorage` under
  Node).
- `src/krunker/` — hand-written `.d.ts` for the game's objects. Not generated;
  extend it when you touch a new field.
- `src/consts.ts` — env, `isKrunker`, `isDevelopment`, `isNode`,
  `getExposedWindow()` (`unsafeWindow` in the browser).
- `src/crashout.ts` — sanitized `console` and `defineProperty`.
- `src/anxiety.ts` — token / version / panic UI.
- `src/KrunkBox.ts` — the krunkbox HTTP client.
- `src/util.ts` — `waitFor(predicate, interval?, timeout?)`. `timeout` defaults
  to `Infinity` and rejects when exceeded.
