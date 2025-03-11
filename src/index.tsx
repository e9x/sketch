import tokenConfig from "tokenConfig";
import KrunkBox from "./KrunkBox";
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
import {
  isDevelopment,
  isKrunker,
  sketchVersion,
  supportedGame,
} from "./consts";
import { hook } from "./filters";
import { getInit, gameLoad, fetchWASM } from "./inject";
import { sketchButton } from "./menu/createUI";
import sketchConfig from "./sketchConfig";
import { waitFor } from "./util";
import { analyticsHook } from "cheats/analytics";
import { createRoot } from "react-dom/client";
import KeyBeg from "components/KeyBeg";

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

if (isKrunker) {
  checkHash();
  main();
}
// else if (location.origin === new URL(apiURL).origin) {
else {
  const sauce = location.pathname.indexOf("/key/");
  if (sauce !== -1) {
    console.log("found key in url");
    // steal it and redirect to krunkar
    const key = location.pathname.slice(sauce + "/key/".length);
    tokenConfig.set("keyFromUrl", key);
    location.href = "https://krunker.io/";
  }
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

  let token = tokenConfig.get("token");

  if (!token) {
    const keyFromUrl = tokenConfig.get("keyFromUrl");
    if (typeof keyFromUrl === "string") {
      tokenConfig.delete("keyFromUrl");
      const res = await KrunkBox.processWorkInk(keyFromUrl);
      if (res.success) {
        token = res.token;
        tokenConfig.set("token", token);
      } else {
        if (isDevelopment) console.error("from url:", res);
      }
    }
  }

  while (true) {
    if (!token) {
      if (sketchConfig.get("silentFail")) return;
      token = await new Promise<string>((resolve) => {
        const { root, overlay } = newRoot();

        root.render(
          <KeyBeg
            done={(token) => {
              root.unmount();
              overlay.remove();
              resolve(token);
            }}
          />
        );
      });
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);
    const game = await getInit(krunkbox, hook);

    if (!game) return;

    if (!game.success) {
      if (isDevelopment) console.error("init:", game);
      tokenConfig.delete("token");
      if (sketchConfig.get("silentFail")) return fetchWASM();
      token = undefined;
      continue;
    }

    await gameLoad;
    sketchButton();

    game.init();

    break;
  }
}
