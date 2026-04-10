import { discordURL, isDevelopment, isNode } from "./consts";
import { console } from "./crashout";
import sketchConfig from "./sketchConfig";
import { waitFor } from "./util";
import KrunkBox, { SketchVersion } from "./KrunkBox";

export function panic(msg: string) {
  if (sketchConfig.get("silentFail")) return;

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

export function newOverlay() {
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
    dom.append(overlay),
  );

  return overlay;
}

export function begToken() {
  const overlay = newOverlay();

  const doFreeKeys = false;

  overlay.innerHTML =
    `<h1>Get your access key for Sketch.</h1>` +
    (doFreeKeys
      ? `<p>In order to pay for servers and development, we've partnered with WorkInk.</p>` +
        `<p><a id="freeKey" target="_blank">Get Access Key</a></p>` +
        `<p><a href="https://krunker.zip/docs/quick-start/" target="_blank">Video Tutorial</a></p>`
      : `<p>Message <u>@melitha</u> in our <a id="discord">Discord</a> for help with your early access key.</p>`) +
    `<p style="font-size:10px;color:red;visbility:hidden" id="error"></p>` +
    `<form style="display:flex;flex-direction:row;gap:5px">` +
    `<input type="text" placeholder="Access Key" id="accessKey" type="password" required />` +
    `<input type="submit" value="Done" id="submit" />` +
    `</form>`;

  const discord = overlay.querySelector<HTMLAnchorElement>("#discord")!;
  const accessKey = overlay.querySelector<HTMLInputElement>("#accessKey")!;
  const error = overlay.querySelector<HTMLInputElement>("#error")!;
  const submit = overlay.querySelector<HTMLInputElement>("#submit")!;

  discord.href = discordURL;

  accessKey.id = error.id = submit.id = discord.id = "";

  return new Promise<string>((resolve) => {
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
        .catch((err: any) => {
          if (isDevelopment) console.error(err);
          overlay.remove();
          panic(err.stack);
        });
    });
  });
}

export function showUpdated(version: SketchVersion) {
  const overlay = newOverlay();
  if (isNode) {
    overlay.innerHTML =
      `<h1>Update Sketch.</h1>` +
      `<p>Your version of Sketch is outdated. You will need to either reopen your client or re-patch the app.asar with <a>the new version from here</a>. (<span id="ver"></span>)</p>` +
      `<p><button>Relaunch</button></p>`;
    const ver = overlay.querySelector("#ver")!;
    ver.textContent = version.latestVersion;
    ver.id = "";
    overlay.querySelector("a")!.href = version.updateURL;

    overlay
      .querySelector<HTMLInputElement>("button")!
      .addEventListener("click", () => {
        // @ts-ignore
        const app = require("electron");
        app.relaunch();
        app.exit();
      });
  } else {
    overlay.innerHTML =
      `<h1>Update Sketch.</h1>` +
      `<p>Your version of Sketch is outdated. Click <a>this link here</a> to download the latest verison. (<span id="ver"></span>)</p>` +
      `<p><button>Refresh</button></p>`;
    const ver = overlay.querySelector("#ver")!;
    ver.textContent = version.latestVersion;
    ver.id = "";
    overlay.querySelector("a")!.href = version.updateURL;

    overlay
      .querySelector<HTMLInputElement>("button")!
      .addEventListener("click", () => {
        location.reload();
      });
  }
}

export function showFutile(version: SketchVersion) {
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
