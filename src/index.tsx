import KrunkBox, { APIError } from "./KrunkBox";
import { adblockHook } from "./cheats/adblock";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { keybindOverlayHook } from "./cheats/keybindOverlay";
import { recoilControlHook } from "./cheats/recoilControl";
import { skinHackHook } from "./cheats/skins";
import { triggerbotHook } from "./cheats/triggerbot";
import { watermarkHook } from "./cheats/watermark";
import NotUpdated from "./components/NotUpdated";
import Outdated from "./components/Outdated";
import { isKrunker, sketchVersion, supportedGame } from "./consts";
import { matchModule, getLocalPlayer, getRender } from "./filters";
import type { Module } from "./filters";
import { getInit, gameLoad, fetchWASM } from "./inject";
import { sketchButton } from "./menu/createUI";
import sketchConfig from "./sketchConfig";
import { waitFor } from "./util";
import { analyticsHook } from "cheats/analytics";
import { createRoot } from "react-dom/client";

triggerbotHook();
bhopHook();
// aimbot spinbot messes with crouch and bhop
aimbotHook();
espHook();
recoilControlHook();
forceAutoHook();
skinHackHook();
keybindOverlayHook();
adblockHook();
watermarkHook();
analyticsHook();

const hook = (dataArg: string, src: string) => {
  // hook __webpack_require__, specifically the part where it returns module.exports and when it's generating the exports, not caching it
  // the hook is ran once per module
  src = src.replace(
    /(\w+)\.l=!0,\1\.exports/,
    (match, module) => `${module}.l=true,${dataArg}.extract(${module})`
  );

  src = src.replace(
    /!(\w+)\.isYou&&\1\.objInstances\){if\(\1\.canBSeen\){/,
    (match, player) =>
      `!${player}.isYou&&${player}.objInstances){if(${player}.canBSeen||${dataArg}.nametags){`
  );

  // force the game to calculate FPS if the watermark is enabled
  // this works because the game hides the FPS element even if this code is ran
  src = src.replace(
    /if\((\w+)\.tmp\.showFPS\)\{for\(/,
    (match, settings) =>
      `if(${dataArg}.watermark||${settings}.tmp.showFPS){for(`
  );

  // *r.adsFov[r.getPlayerWeaponId(t)]
  src = src.replace(
    /\*(\w+)\.adsFov/g,
    (match, render) => `*(${dataArg}.noAdsFov?${dataArg}:${render}).adsFov`
  );

  const genericAdsArray = [...Array(64)].fill(0);

  /* javascript-obfuscator:disable */
  return {
    data: {
      get watermark() {
        return sketchConfig.get("watermark");
      },
      get noAdsFov() {
        return sketchConfig.get("noAdsFovMlt");
      },
      get adsFov() {
        try {
          const ads: number[] = [];

          ads[getRender().getPlayerWeaponId(getLocalPlayer())] = 0;

          return ads;
        } catch {
          return genericAdsArray;
        }
      },
      extract: (module: Module) => {
        matchModule(module);
        return module.exports;
      },
      get nametags() {
        return sketchConfig.get("nametags");
      },
    },
    src,
  };
  /* javascript-obfuscator:enable */
};

if (isKrunker) {
  checkHash();
  main();
}

function newRoot() {
  const overlay = document.createElement("div");

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "white",
    zIndex: `${1e9}`,
    padding: "8px",
  } as CSSStyleDeclaration);

  const root = createRoot(overlay);

  waitFor(() => document.documentElement, 10).then((dom) =>
    dom.append(overlay)
  );

  return { root, overlay };
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
      location.pathname + location.search
    );
  }
}

async function main() {
  const version = await KrunkBox.sketchVersion(sketchVersion, supportedGame);

  if (version.outdated) {
    if (sketchConfig.get("silentFail")) return fetchWASM();
    return newRoot().root.render(
      <Outdated
        latestVersion={version.latestVersion}
        updateURL={version.updateURL}
      />
    );
  }

  if (!version.sketchUpdated) {
    if (sketchConfig.get("silentFail")) return;
    return newRoot().root.render(<NotUpdated />);
  }

  while (true) {
    const krunkbox = new KrunkBox();

    const game = await getInit(krunkbox, hook);

    /*if (game === APIError.BadToken) {
      tokenConfig.delete("token");
      if (sketchConfig.get("silentFail")) return fetchWASM();
      token = undefined;
      continue;
    }*/

    if (game === APIError.DIY) return;

    await gameLoad;
    sketchButton();

    game();

    break;
  }
}
