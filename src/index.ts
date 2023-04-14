import "./menu/createUI";
import KrunkBox, { WorkInkErrors } from "./KrunkBox";
import { gameVersion, workInkURL } from "./consts";
import type { Hook } from "./inject";
import { getGame, waitForGameLoad } from "./inject";

const hook: Hook<
  (module: { i: number; l: true; exports: unknown }) => unknown
> = (dataArg: string, src: string) => {
  // hook __webpack_require__, specifically the part where it returns module.exports and when it's generating the exports, not caching it
  // the hook is ran once per module
  src = src.replace(
    /,(\w+)\.l=!!\[],\1\.exports}/,
    (match, module) => `,${module}.l=true,${dataArg}(${module})}`
  );

  return {
    data: (module) => {
      console.log(module);
      return module.exports;
    },
    src,
  };
};

const gameLoad = waitForGameLoad();

async function main() {
  let krunkbox: KrunkBox | undefined;

  const savedToken = GM_getValue("token", undefined);

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

  const game = await getGame(krunkbox, hook);

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
