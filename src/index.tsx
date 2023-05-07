/* eslint-disable no-constant-condition */
import "./workinkBypass";
import "./menu/createUI";
import KrunkBox, { APIError, WorkInkErrors } from "./KrunkBox";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook, forceNametags } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { recoilControlHook } from "./cheats/recoilControl";
import { triggerbotHook } from "./cheats/triggerbot";
import {
  discordURL,
  isKrunker,
  sketchVersion,
  supportedGame,
  workInkURL,
} from "./consts";
import { matchModule, getLocalPlayer, getRender } from "./filters";
import type { Module } from "./filters";
import { getInit, gameLoad } from "./inject";
import sketchConfig from "./sketchConfig";
import tokenConfig from "./tokenConfig";

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
        return forceNametags();
      },
    },
    src,
  };
};

if (isKrunker) main();

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

  document.documentElement.append(overlay);

  return { root, overlay };
}

async function main() {
  const version = await KrunkBox.sketchVersion(sketchVersion, supportedGame);

  if (version.outdated)
    return newRoot().root.render(
      <>
        <h1>Update Sketch.</h1>
        <p>
          Your version of Sketch is outdated. Click{" "}
          <a href={version.updateURL}>this link here</a> to download the latest
          verison. ({version.latestVersion})
        </p>
        <p>
          <button onClick={() => location.reload()}>Refresh</button>
        </p>
      </>
    );

  if (!version.sketchUpdated)
    return newRoot().root.render(
      <>
        <h1>Sketch isn't updated.</h1>
        <a href={discordURL}>Discord server</a>
      </>
    );

  let token = tokenConfig.get("token");

  while (true) {
    if (!token) {
      token = await begKey();
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);

    const game = await getInit(krunkbox, hook);

    if (game === APIError.BadToken) {
      tokenConfig.delete("token");
      token = undefined;
      continue;
    }

    if (game === APIError.DIY) return;

    await gameLoad;

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

function KeyBeg({ done }: { done: (token: string) => void }) {
  const key = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <h1>Get your access key for Sketch.</h1>
      <p>
        In order to pay for servers and development, we've partnered with
        WorkInk.
      </p>
      <p>
        <a href={workInkURL}>Get Access Key</a>
      </p>
      <p>
        <a href="https://sketch.sys32.dev/docs/quick-start/">Video Tutorial</a>
      </p>
      {error && <p style={{ fontSize: "10px", color: "red" }}>{error}</p>}
      <form
        style={{ display: "flex", flexDirection: "row", gap: 5 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!key.current) return;

          setBusy(true);

          KrunkBox.processWorkInk(key.current.value.trim())
            .then((res) => {
              switch (res) {
                case WorkInkErrors.BadToken:
                  setError("Bad access key. Try again.");
                  break;
                case WorkInkErrors.DuplicateToken:
                  setError("Access key already used. Try again.");
                  break;
                default:
                  done(res);
              }
            })
            .finally(() => setBusy(false));
        }}
      >
        <input type="text" placeholder="Access Key" disabled={busy} ref={key} />
        <input type="submit" value="Done" disabled={busy} />
      </form>
    </>
  );
}
