import KrunkBox, { APIError } from "./KrunkBox";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { recoilControlHook } from "./cheats/recoilControl";
import { triggerbotHook } from "./cheats/triggerbot";
import KeyBeg from "./components/KeyBeg";
import NotUpdated from "./components/NotUpdated";
import Outdated from "./components/Outdated";
import {
  isDevelopment,
  isKrunker,
  isNode,
  sketchVersion,
  supportedGame,
} from "./consts";
import { matchModule, getLocalPlayer, getRender } from "./filters";
import type { Module } from "./filters";
import { getInit, gameLoad, fetchWASM } from "./inject";
import { sketchButton } from "./menu/createUI";
import sketchConfig from "./sketchConfig";
import tokenConfig from "./tokenConfig";
import { waitFor } from "./util";

aimbotHook();
bhopHook();
espHook();
triggerbotHook();
recoilControlHook();
forceAutoHook();

const hook = (dataArg: string, src: string) => {
  // hook __webpack_require__, specifically the part where it returns module.exports and when it's generating the exports, not caching it
  // the hook is ran once per module
  src = src.replace(
    /,(\w+)\.l=!!\[],\1\.exports}/,
    (match, module) => `,${module}.l=true,${dataArg}.extract(${module})}`
  );

  src = src.replace(
    /!(\w+)\.isYou&&\1\.objInstances\){if\(\1\.canBSeen\){/,
    (match, player) =>
      `!${player}.isYou&&${player}.objInstances){if(${player}.canBSeen||${dataArg}.nametags){`
  );

  // *r.adsFovMlt[r.getPlayerWeaponId(t)]
  src = src.replace(
    /\*(\w+)\.adsFovMlt/g,
    (match, render) =>
      `*(${dataArg}.noAdsFovMlt?${dataArg}:${render}).adsFovMlt`
  );

  const genericAdsArray = [...Array(64)].fill(0);

  /* javascript-obfuscator:disable */
  return {
    data: {
      get noAdsFovMlt() {
        return sketchConfig.get("noAdsFovMlt");
      },
      get adsFovMlt() {
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
  if (isNode) {
    for (const url of [
      `https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.${
        isDevelopment ? "development" : "production"
      }.min.js`,
      `https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.${
        isDevelopment ? "development" : "production"
      }.min.js`,
    ]) {
      const http = new XMLHttpRequest();
      http.open("GET", url, false);
      http.send();
      new Function(http.responseText)();
    }
  }
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

  const root = ReactDOM.createRoot(overlay);

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

  while (true) {
    if (!token) {
      if (sketchConfig.get("silentFail")) return fetchWASM();
      token = await begKey();
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);

    const game = (await krunkbox.valid())
      ? await getInit(krunkbox, hook)
      : APIError.BadToken;

    if (game === APIError.BadToken) {
      tokenConfig.delete("token");
      if (sketchConfig.get("silentFail")) return fetchWASM();
      token = undefined;
      continue;
    }

    if (game === APIError.DIY) return;

    await gameLoad;
    sketchButton();

    // load menu font
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Delicious+Handrawn&display=swap";
    link.rel = "stylesheet";
    // load the fonts as soon as they're available
    // to prevent the placeholder font when it's first rendered
    link.addEventListener("load", () => {
      for (const font of document.fonts)
        if (font.family === "Delicious Handrawn") font.load();
    });
    document.head.append(link);

    game();

    break;
  }
}

function begKey() {
  return new Promise<string>((resolve) => {
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
}
