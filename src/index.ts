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
  discordURL,
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
import { analyticsHook } from "./cheats/analytics";

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

function panic(msg: string) {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: `${1e9}`,
    padding: "8px",
    fontSize: "14px",
    whiteSpace: "pre",
  } as CSSStyleDeclaration);

  const boxes = msg.split("\n").map((line) => {
    const e = document.createElement("span");
    e.textContent = line;
    Object.assign(e.style, {
      display: "block",
      maxWidth: "max-content",
      background: "#000",
      fontFamily: "monospace",
      color: "#f00",
      transition: "background-color 0.2s ease-in-out",
    } as CSSStyleDeclaration);
    overlay.append(e);
    return e;
  });

  waitFor(() => document.documentElement, 10).then((dom) => {
    dom.append(overlay);

    setTimeout(() => {
      for (const e of boxes) e.style.backgroundColor = "#f5ce67";

      setTimeout(() => {
        for (const e of boxes) e.style.backgroundColor = "#000";
      }, 200);
    }, 200);
  });
}

function newOverlay() {
  const overlay = document.createElement("div");

  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "#fff",
    zIndex: `${1e9}`,
    padding: "8px",
  } as CSSStyleDeclaration);

  waitFor(() => document.documentElement, 10).then((dom) =>
    dom.append(overlay)
  );

  return overlay;
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
    const overlay = newOverlay();
    overlay.innerHTML = `<h1>Update Sketch.</h1>
      <p>
        Your version of Sketch is outdated. Click <a>this link here</a> to download the latest verison. (<span id="ver"></span>)
      </p>
      <p>
        <button>Refresh</button>
      </p>`;
    overlay.querySelector("#ver")!.textContent = version.latestVersion;
    overlay.querySelector("a")!.href = version.updateURL;

    overlay
      .querySelector<HTMLInputElement>("#button")!
      .addEventListener("click", () => {
        location.reload();
      });
  }

  if (!version.sketchUpdated) {
    if (sketchConfig.get("silentFail")) return;
    const overlay = newOverlay();

    overlay.innerHTML =
      `<h1>Sketch is outdated and an update isn't available.</h1>` +
      `<hr />` +
      `<p>You'll have to wait for an update.</p>` +
      `<p style="font-size:0.6em"><em>Sketch has to be updated every time Krunker updates.</em></p>` +
      `<p><a id="discord">Discord server</a></p>`;

    const discord = overlay.querySelector<HTMLAnchorElement>("#discord")!;
    discord.href = discordURL;
    discord.id = "";
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
      token = await new Promise<string>((resolve) => {
        const overlay = newOverlay();

        const doFreeKeys = false;

        overlay.innerHTML =
          `<h1>Get your access key for Sketch.</h1>` +
          (doFreeKeys
            ? `<p>In order to pay for servers and development, we've partnered with WorkInk.</p>` +
              `<p><a id="freeKey" target="_blank">Get Access Key</a></p>` +
              `<p><a href="https://krunker.zip/docs/quick-start/" target="_blank">Video Tutorial</a></p>`
            : `<p>Message <u>@bizzynil</u> in our <a id="discord">Discord</a> for help with your early access key.</p>`) +
          `<p style="font-size:10px;color:red;visbility:hidden" id="error"></p>` +
          `<form style="display:flex;flex-direction:row;gap:5px">` +
          `<input type="text" placeholder="Access Key" id="accessKey" required />` +
          `<input type="submit" value="Done" id="submit" />` +
          `</form>`;

        const discord = overlay.querySelector<HTMLAnchorElement>("#discord")!;
        const accessKey =
          overlay.querySelector<HTMLInputElement>("#accessKey")!;
        const error = overlay.querySelector<HTMLInputElement>("#error")!;
        const submit = overlay.querySelector<HTMLInputElement>("#submit")!;

        discord.href = discordURL;

        accessKey.id = error.id = submit.id = discord.id = "";

        accessKey.form!.addEventListener("submit", (event) => {
          event.preventDefault();
          accessKey.disabled = true;
          submit.disabled = true;

          KrunkBox.processWorkInk(accessKey.value.trim())
            .then((res) => {
              if (isDevelopment) console.trace(res);
              if (res.success) {
                resolve(res.token);
                overlay.remove();
              } else {
                switch (res.error[0]) {
                  case "sketch_key_validate.invalid":
                    error.style.visibility = "visibible";
                    error.textContent = "Bad access key. Try again.";
                    break;
                  case "sketch_key_validate.used":
                    error.style.visibility = "visibible";
                    error.textContent = "Access key already used. Try again.";
                    break;
                  default:
                    error.style.visibility = "visibible";
                    if (isDevelopment) console.warn("no msg for", res.error[0]);
                    error.textContent = res.error[0];
                    break;
                }
                accessKey.disabled = false;
                submit.disabled = false;
              }
            })
            .catch((err) => {
              overlay.remove();
              panic(err.stack);
            });
        });
      });
      tokenConfig.set("token", token);
    }

    const krunkbox = new KrunkBox(token);
    const game = await getInit(krunkbox, hook);

    // needs to reload to use token
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
