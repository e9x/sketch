import tokenConfig from "./tokenConfig";
import KrunkBox from "./KrunkBox";
import {
  isDevelopment,
  isKrunker,
  sketchVersion,
  supportedGame,
} from "./consts";
import { afterGame, hook, runBeforeGameOnce, onGameHooks } from "./filters";
import { prepareSource } from "./inject";
import { gameLoad, setSourceInterceptor, setInjectValues } from "./dogehook";
import sketchConfig from "./sketchConfig";
import { begToken, showUpdated, showFutile, panic } from "./anxiety";
import { sketchButton } from "./menu/createUI";
import "./cheats";

if (isKrunker) {
  checkHash();
  main().catch((err) => {
    if (sketchConfig.get("silentFail")) return;
    panic(err.stack);
  });
} else {
  const sauce = location.pathname.indexOf("/key/");
  if (sauce !== -1) {
    const key = location.pathname.slice(sauce + "/key/".length);
    tokenConfig.set("keyFromUrl", key);
    location.href = "https://krunker.io/";
  }
}

/**
 * Check the #hash in the URL
 * Perform operations on the config
 */
function checkHash() {
  const hash = location.hash;

  if (hash === "#showUpdates") {
    // set the config
    sketchConfig.delete("silentFail");

    // remove the hash
    history.replaceState(
      "",
      document.title,
      location.pathname + location.search,
    );
  }
}

declare function enterGame(): void;

declare global {
  var Howler: any;
}

function buildPrologue(injectArgs: Record<string, any>): string {
  const lines: string[] = [
    'var __si = (typeof __sketchInject !== "undefined" ? __sketchInject : (typeof top !== "undefined" && top.__sketchInject) || (typeof parent !== "undefined" && parent.__sketchInject) || (typeof window !== "undefined" && window.__sketchInject));',
  ];
  if (isDevelopment)
    lines.push(
      'try { console.log("[sketch] prologue: __si =", !!__si, "beforeGame:", typeof (__si && __si.beforeGame)); } catch(e) {}',
    );
  for (const key of Object.keys(injectArgs)) {
    if (key === "WP_MMToken") {
      // The loader still calls this body with the real matchmaking token as its
      // first argument; krunkbox's wrapper prologue otherwise clobbers it.
      lines.push(
        `var ${key} = (typeof arguments !== "undefined" && arguments.length && typeof arguments[0] === "string" && arguments[0]) || __si[${JSON.stringify(key)}];`,
      );
      if (isDevelopment)
        lines.push(
          `try { console.log("[sketch] mmToken:", ${key} === __si[${JSON.stringify(key)}] ? "PLACEHOLDER" : "real (" + ${key}.length + " chars)"); } catch(e) {}`,
        );
      continue;
    }
    lines.push(`var ${key} = __si[${JSON.stringify(key)}];`);
  }
  lines.push('if (__si && __si.beforeGame) __si.beforeGame();');
  return lines.join('\n') + '\n';
}

async function main() {
  const version = await KrunkBox.sketchVersion(sketchVersion, supportedGame);

  if (version.outdated) {
    if (sketchConfig.get("silentFail")) return;
    return showUpdated(version);
  }

  if (!version.sketchUpdated) {
    if (sketchConfig.get("silentFail")) return;
    return showFutile(version);
  }

  let token = tokenConfig.get("token");

  if (!token) {
    const keyFromUrl = tokenConfig.get("keyFromUrl");
    if (typeof keyFromUrl === "string") {
      tokenConfig.delete("keyFromUrl");
      try {
        const res = await KrunkBox.processWorkInk(keyFromUrl);
        if (res.success) {
          token = res.token;
          tokenConfig.set("token", token);
        } else {
          if (isDevelopment) console.error("from url:", res);
        }
      } catch (err) {
        if (isDevelopment) console.error(err);
      }
    }
  }

  while (true) {
    if (!token) {
      const t = await begToken();
      if (!t) return;
      token = t;
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token!);
    const prepared = await prepareSource(krunkbox, hook);

    if (!prepared) {
      console.log("refresh to utilize token");
      return;
    }

    if (!prepared.success) {
      if (isDevelopment) console.error("init:", prepared);
      tokenConfig.delete("token");
      token = undefined;
      continue;
    }

    const { source, injectArgs } = prepared;

    // Expose runtime objects (fakeObj, data, WP_MMToken) to iframe contexts.
    // No afterGame here: it would double-mount the button and duplicate the
    // autoSpawn interval alongside onGameHooks.
    setInjectValues({
      ...injectArgs,
      beforeGame: runBeforeGameOnce,
    });

    // afterGame runs here rather than from a source epilogue: the wrapper
    // returns long before the game finishes async init.
    onGameHooks.push(() => {
      // Isolated so one failing hook can't stop the button from mounting.
      for (const ag of afterGame) {
        try {
          ag();
        } catch (e) {
          if (isDevelopment) console.error("[sketch] afterGame hook failed:", e);
        }
      }

      try {
        sketchButton();
      } catch (e) {
        if (isDevelopment) console.error("[sketch] sketchButton failed:", e);
      }

      setTimeout(() => {
        setInterval(() => {
          if (sketchConfig.get("autoSpawn")) enterGame();
        }, 100);
      }, 1e3);
    });

    const prologue = buildPrologue(injectArgs);

    setSourceInterceptor((_url, _responseText) => {
      if (isDevelopment) console.log("[sketch] intercepted XHR source, url:", _url.substring(0, 100), "original:", _responseText.length, "patched:", source.length);
      return prologue + source;
    });

    if (isDevelopment) console.log("[DEV] interceptor registered, waiting for loader");

    // The loader script will run naturally — WASM will create an iframe
    // and call new Function() on it, which our proxy intercepts
    await gameLoad;
    if (isDevelopment) console.log("[DEV] loader script detected, game will compile via WASM");

    break;
  }
}
