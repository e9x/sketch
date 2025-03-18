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
import { analyticsHook } from "./cheats/analytics";
import { panic, begToken, showUpdated, showFutile } from "./anxiety";

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
  main().catch((err) => {
    console.error(err);
    panic(err.stack);
  });
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
      if (sketchConfig.get("silentFail")) return;
      token = await begToken();
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);
    const game = await getInit(krunkbox, hook);

    // needs to reload to use token
    if (!game) {
      console.log("refresh to utilize token");
      return;
    }

    if (!game.success) {
      if (isDevelopment) console.error("init:", game);
      tokenConfig.delete("token");
      // if (sketchConfig.get("silentFail")) return fetchWASM();
      token = undefined;
      continue;
    }

    await gameLoad;
    sketchButton();

    game.init();

    break;
  }
}
