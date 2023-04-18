import "./menu/createUI";
import KrunkBox, { APIError, WorkInkErrors } from "./KrunkBox";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook, forceNametags } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { triggerbotHook } from "./cheats/triggerbot";
import { configDelete, configGet } from "./config";
import { discordURL, gameVersion, sketchVersion, workInkURL } from "./consts";
import type { Module } from "./filters";
import { matchModule } from "./filters";
import { getInit, waitForGameLoad } from "./inject";

aimbotHook();
bhopHook();
espHook();
forceAutoHook();
triggerbotHook();

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

  return {
    data: {
      extract: (module: Module) => {
        matchModule(module);
        return module.exports;
      },
      get nametags() {
        return forceNametags();
      },
    },
    src,
  };
};

const gameLoad = waitForGameLoad();

async function main() {
  let krunkbox: KrunkBox | undefined;

  const savedToken = configGet<string>("token", "");

  const version = await KrunkBox.sketchVersion(sketchVersion, gameVersion);

  if (version.outdated) {
    if (
      confirm(
        `KrunkSketch is outdated. You have ${sketchVersion} but the latest is ${version.latestVersion}. Update?`
      )
    )
      GM_openInTab(version.updateURL);

    return;
  }

  if (!version.sketchUpdated) {
    if (confirm("KrunkSketch isn't updated. Join the Discord for updates?"))
      GM_openInTab(discordURL);

    return;
  }

  if (savedToken) krunkbox = new KrunkBox(savedToken);

  while (!krunkbox) {
    const apiToken = await getToken();

    if (!apiToken) return; // aborted

    krunkbox = new KrunkBox(apiToken);

    if (!(await krunkbox.valid())) krunkbox = undefined;
  }

  const game = await getInit(krunkbox, hook);

  if (game === APIError.BadToken) {
    console.error("Invalid token");
    configDelete("token");
    location.reload();
  }

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
