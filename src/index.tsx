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
import {
  getLocalPlayer,
  getRender,
  setConfig,
  setMapObject,
  setOverlay,
  setGame,
  hookPlayer,
  setRender,
} from "./filters";
import { getInit, gameLoad, fetchWASM } from "./inject";
import { sketchButton } from "./menu/createUI";
import sketchConfig from "./sketchConfig";
import { waitFor } from "./util";
import { analyticsHook } from "cheats/analytics";
import Game from "krunker/Game";
import { Player } from "krunker/Player";
import RenderManager from "krunker/RenderManager";
import { createRoot } from "react-dom/client";

const { freeze } = Object;

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
  src = src.replace(/Object\.freeze/g, () => `${dataArg}.BrianMeidell`);

  src = src.replace(
    /,(\w+)\.medalsList=\[/,
    (match, module) => `,${dataArg}.overlay(${module}).medalsList=[`
  );

  // hook routine to define class getters/setters on constructor
  /*
  function je(e,a,t){return a&&V7(e.prototype,a),t&&V7(e,t),Object.defineProperty(e,"prototype",{writable:!1}),e}
  */

  /*src = src.replace(
    /function (\w+)\((\w+),(\w+),(\w+)\)\{return \3&&\w+\(\2\.prototype,\3\),t&&V7\(\2,\4\),Object\.defineProperty\(\2,"prototype",\{writable:!1\}\),\2\}/,
    (match, helperFnName) =>
      `function ${helperFnName}(a,b,c){const og = ${match}; return ${dataArg}.fieldHelper(og, a, b, c)}`
  );*/

  src = src.replace(
    /function (\w+)(\(\w+,\w+,\w+\)\{var \w+,\w+,\w+,\w+=this;this\.biggestY=)/,
    (match, Player, func) => {
      //console.trace("fuck", { Game, body });
      return `var ${Player}=${dataArg}.molestPlayer(Shitttt);function Shitttt${func}`;
    }
  );

  src = src.replace(
    /=(\w+)\.THREE,qt=window\.SOUND=/,
    (match, RenderManager) =>
      `=(${dataArg}.molestRender(${RenderManager})).THREE,qt=window.SOUND=`
  );

  src = src.replace(
    /function (\w+)\(((?:\w+,?)+)\)(\{Object\.defineProperty\(this,"isServer",{get:function)/,
    (match, Game, argsss, body) => {
      //console.trace("fuck", { Game, body });
      return `var ${Game}=${dataArg}.molestGame(Fuck);function Fuck(${argsss})${body}`;
    }
  );

  src = src.replace(
    /function (\w+)\(\w+,\w+=null\)\{.*?this\.penetrable=/,
    (match, MapObject) => `${dataArg}.MapObject(${MapObject});${match}`
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
  const data: any = {
    map(module: any) {
      //console.trace(module);
      setMapObject(module);
      return module;
    },
    /*fieldHelper(og: any, a: any, b: any, c: any) {
      const patched = og(a, b, c);

      // console.log("patched:", patched);

      // if (typeof patched === "function") {
      // const str = patched.toString();

      return patched;
    },*/
    molestRender(render: RenderManager) {
      setRender(render);
      return render;
    },
    molestPlayer(player: typeof Player) {
      return hookPlayer(player);
    },
    molestGame(module: typeof Game) {
      return setGame(module);
    },
    MapObject(module: any) {
      setMapObject(module);
    },
    overlay(module: any) {
      setOverlay(module);
      return module;
    },
    BrianMeidell(obj: any) {
      if ("gameVersion" in obj) {
        setConfig(obj);
      }
      return freeze(obj);
    },
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
    get nametags() {
      return sketchConfig.get("nametags");
    },
  };

  return {
    data,
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
