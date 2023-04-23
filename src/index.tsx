import "./menu/createUI";
import KrunkBox, { APIError, WorkInkErrors } from "./KrunkBox";
import { aimbotHook } from "./cheats/aimbot";
import { bhopHook } from "./cheats/bhop";
import { espHook, forceNametags } from "./cheats/esp";
import { forceAutoHook } from "./cheats/forceAuto";
import { triggerbotHook } from "./cheats/triggerbot";
import { configDelete, configGet, configSet } from "./config";
import { discordURL, gameVersion, sketchVersion, workInkURL } from "./consts";
import type { Module } from "./filters";
import { matchModule } from "./filters";
import { getInit, gameLoad } from "./inject";

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

  return root;
}

async function main() {
  const savedToken = configGet<string>("token");

  const version = await KrunkBox.sketchVersion(sketchVersion, gameVersion);

  if (version.outdated) return location.assign(version.updateURL);

  if (!version.sketchUpdated)
    return newRoot().render(
      <>
        <h1>Sketch isn't updated.</h1>
        <a href={discordURL}>Discord server</a>
      </>
    );

  if (savedToken) {
    const krunkbox = new KrunkBox(savedToken);
    if (await krunkbox.valid()) return init(krunkbox);
  }

  const root = newRoot();

  root.render(<KeyBeg />);
}

function KeyBeg() {
  const key = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <>
      <h1>Get your access key for Sketch.</h1>
      <p>
        In order to pay for servers and development, we've partnered with
        WorkInk. Click{" "}
        <a target="_blank" href={workInkURL}>
          here
        </a>{" "}
        to get your access key.
      </p>
      {error && <p style={{ fontSize: "10px", color: "red" }}>{error}</p>}
      <form
        style={{ display: "flex", flexDirection: "row", gap: 5 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!key.current) return;

          setBusy(true);

          KrunkBox.processWorkInk(key.current.value)
            .then((res) => {
              switch (res) {
                case WorkInkErrors.BadToken:
                  setError("Bad access key. Try again.");
                  break;
                case WorkInkErrors.DuplicateToken:
                  setError("Access key already used. Try again.");
                  break;
                default:
                  configSet<string>("token", res);
                  location.reload();
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

main();

async function init(krunkbox: KrunkBox) {
  const game = await getInit(krunkbox, hook);

  if (game === APIError.BadToken) {
    configDelete("token");
    location.reload();
    return;
  }

  if (game === APIError.DIY) return;

  await gameLoad;

  game();
}
