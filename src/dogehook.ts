import { getExposedWindow, isDevelopment, isKrunker } from "./consts";
import { mirrorAttributes, setNativeFunction } from "./hook";

const window = getExposedWindow();

export type SourceInterceptor = (
  url: string,
  responseText: string,
) => string | undefined;

let interceptor: SourceInterceptor | undefined;

export function setSourceInterceptor(fn: SourceInterceptor) {
  interceptor = fn;
}

export function setInjectValues(_values: Record<string, any>) {
  // Non-enumerable so the global stays out of Object.keys(window) and for-in.
  Object.defineProperty(window, "__sketchInject", {
    value: _values,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

const GAME_SOURCE_MIN = 5_000_000;

function init(): Promise<void> {
  // NOTE: an Object.prototype lockdown guard used to live here -- wrappers
  // around Object.preventExtensions/seal/freeze and Reflect.preventExtensions,
  // plus a WebAssembly.instantiateStreaming scanner that looked for those
  // functions in the WASM import object. None of it ever fired: the
  // '[sketch] blocked Object.prototype lockdown' line never logged once, yet
  // Object.prototype still flipped from extensible to non-extensible between
  // document-start and the game source running. Removed, because
  // game/render/overlay are now captured by source patches in filters.ts and
  // nothing depends on Object.prototype staying extensible.

  // Emscripten's UTF8ToString uses a cached TextDecoder instance created at
  // module scope. Hook the prototype method BEFORE the loader module parses
  // (we run at document-start). The 8.6MB game source passes through here.
  // Replace the TextDecoder constructor (static property on window, not prototype)
  // so instances created after this point get an instance-level decode override.
  // Prototype stays untouched — only the constructor reference on window changes.
  const OrigTD = window.TextDecoder;
  const origProtoDecode = OrigTD.prototype.decode;
  let intercepted = false;

  const FakeTD = function TextDecoder(this: any, ...args: any[]) {
    const instance = new (OrigTD as any)(...args);
    if (intercepted) return instance;

    const decode = setNativeFunction(
      function (input?: BufferSource, options?: TextDecodeOptions) {
        const result = origProtoDecode.call(instance, input as any, options);

        if (
          intercepted ||
          !interceptor ||
          typeof result !== "string" ||
          result.length <= GAME_SOURCE_MIN
        )
          return result;

        intercepted = true;
        // Uninstall before returning so no own 'decode' or swapped global remains.
        delete (instance as any).decode;
        (window as any).TextDecoder = OrigTD;

        if (isDevelopment)
          console.log("[sketch] intercepted game source:", result.length, "chars");

        const patched = interceptor("Function", result);
        if (patched === undefined) return result;

        if (isDevelopment)
          console.log("[sketch] injected patched source:", patched.length, "chars");

        return patched;
      },
      "decode",
      { length: 1 },
    );

    Object.defineProperty(instance, "decode", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: decode,
    });

    return instance;
  } as unknown as typeof TextDecoder;

  // Not isConstructor: leaves OrigTD.prototype.constructor honest.
  mirrorAttributes(FakeTD, OrigTD);
  FakeTD.prototype = OrigTD.prototype;
  (window as any).TextDecoder = FakeTD;

  if (isDevelopment) console.log('[sketch] TextDecoder constructor replaced');

  return new Promise<void>((loaded) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i] as HTMLScriptElement;
          if (node.tagName === "SCRIPT" && node.src) {
            if (
              node.src.includes("/static/index-") ||
              node.src.includes("/pkg/loader-")
            ) {
              loaded();
              observer.disconnect();
              return;
            }
          }
        }
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
    });
  });
}

export const gameLoad: Promise<void> = isKrunker
  ? init()
  : new Promise<void>(() => {});

