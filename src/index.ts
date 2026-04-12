import tokenConfig, { initTokenConfig } from "./tokenConfig";
import { console } from "./crashout";
import KrunkBox from "./KrunkBox";
import {
  isDevelopment,
  isKrunker,
  sketchVersion,
  supportedGame,
} from "./consts";
import { afterGame, beforeGame, hook } from "./filters";
import { getInit } from "./inject";
import { gameLoad } from "./dogehook";
import sketchConfig, { initSketchConfig } from "./sketchConfig";
import { initPlayerSpoofConfig } from "./playerSpoofConfig";
import { begToken, showUpdated, showFutile, panic } from "./anxiety";
import { sketchButton } from "./menu/createUI";
import "./cheats";

const loadGameNormally = () => {};

if (isKrunker) {
  main().catch((err) => {
    if (isDevelopment) console.error(err);
    if (sketchConfig.get("silentFail")) return;
    panic(err.stack);
  });
}
// else if (location.origin === new URL(apiURL).origin) {
else {
  const sauce = location.pathname.indexOf("/key/");
  if (sauce !== -1) {
    // console.log("found key in url");
    // steal it and redirect to krunkar
    const key = location.pathname.slice(sauce + "/key/".length);
    initTokenConfig().then(() => {
      tokenConfig.set("keyFromUrl", key);
      location.href = "https://krunker.io/";
    });
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

async function main() {
  await initSketchConfig();
  await initPlayerSpoofConfig();
  await initTokenConfig();

  checkHash();

  const version = await KrunkBox.sketchVersion(sketchVersion, supportedGame);

  if (version.outdated) {
    if (sketchConfig.get("silentFail")) return loadGameNormally();
    return showUpdated(version);
  }

  if (!version.sketchUpdated) {
    if (sketchConfig.get("silentFail")) return loadGameNormally();
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
      // if (sketchConfig.get("silentFail")) return fetchWASM();
      token = await begToken();
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);
    const game = await getInit(krunkbox, hook);

    // needs to reload to use token
    if (!game) {
      // console.log("refresh to utilize token");
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
    for (const bg of beforeGame) bg();
    game.init();
    for (const ag of afterGame) ag();
    sketchButton();

    setTimeout(() => {
      setInterval(() => {
        if (sketchConfig.get("autoSpawn")) enterGame();
      }, 100);
    }, 1e3);

    break;
  }
}
