import "./menu/createUI";
import KrunkBox, { WorkInkErrors } from "./KrunkBox";
import { aimbotHook } from "./cheats/aimbot";
import { autoReloadHook } from "./cheats/autoReload";
import { bhopHook } from "./cheats/bhop";
import { forceAutoHook } from "./cheats/forceAuto";
import { triggerbotHook } from "./cheats/triggerbot";
import { configGet } from "./config";
import { gameVersion, workInkURL } from "./consts";
import { matchVars, matchModule } from "./filters";
import type { Module } from "./filters";
import type { Hook } from "./inject";
import { getInit, waitForGameLoad } from "./inject";

bhopHook();
aimbotHook();
triggerbotHook();
forceAutoHook();
autoReloadHook();

const hook: Hook<(module: Module) => unknown> = (
  dataArg: string,
  src: string
) => {
  // hook __webpack_require__, specifically the part where it returns module.exports and when it's generating the exports, not caching it
  // the hook is ran once per module
  src = src.replace(
    /,(\w+)\.l=!!\[],\1\.exports}/,
    (match, module) => `,${module}.l=true,${dataArg}(${module})}`
  );

  matchVars(src);

  return {
    data: (module) => {
      matchModule(module);
      return module.exports;
    },
    src,
  };
};

const gameLoad = waitForGameLoad();

async function main() {
  let krunkbox: KrunkBox | undefined;

  const savedToken = configGet("token", "");

  if (savedToken) krunkbox = new KrunkBox(savedToken);

  while (!krunkbox) {
    const apiToken = await getToken();

    if (!apiToken) return; // aborted

    krunkbox = new KrunkBox(apiToken);
    if (!(await krunkbox.valid())) {
      krunkbox = undefined;
    }
  }

  const vars = await krunkbox.vars();

  if (vars.gameVersion !== gameVersion) {
    if (confirm("KrunkSketch isn't updated. Join the Discord for updates?"))
      GM_openInTab("https://y9x.github.io/discord/");

    return;
  }

  const game = await getInit(krunkbox, hook);

  await gameLoad;

  game();
}

main();

async function getToken() {
  let token: string | undefined;

  while (!token) {
    GM_openInTab(workInkURL);
    const key = prompt(
      "Go to the newly opened tab and follow the instructions. When done, enter your access key here"
    );
    // cancel
    if (typeof key !== "string") return;
    const res = await KrunkBox.processWorkInk(key);
    if (res === WorkInkErrors.BadToken) alert("Bad access key. Try again.");
    else if (res === WorkInkErrors.DuplicateToken)
      alert("Access key already used. Try again.");
    else {
      token = res;
      break;
    }
  }

  return token;
}
