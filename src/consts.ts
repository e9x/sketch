import { FSJSONStorage, GMJSONStorage } from "./values";

export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid SKETCH_API_URL");

export const linkvertiseURL = process.env.SKETCH_LINKVERTISE_URL || "";
if (!linkvertiseURL) throw new TypeError("Invalid SKETCH_LINKVERTISE_URL");

/**
 * The page that the linkvertise URL redirects to
 * Eg https://linkvertise.com/#/
 * No page title
 * Just the starting part of the link
 */
export const linkvertisePage = process.env.SKETCH_LINKVERTISE_PAGE || "";
if (!linkvertisePage) throw new TypeError("Invalid SKETCH_LINKVERTISE_PAGE");

export const supportedGame = process.env.SKETCH_SUPPORTED_GAME || "";
if (!supportedGame) throw new TypeError("Invalid SKETCH_SUPPORTED_GAME");

export const sketchVersion = process.env.SKETCH_VERSION || "";
if (!sketchVersion) throw new TypeError("Invalid SKETCH_VERSION");

export const discordURL = "https://y9x.github.io/discord/";

export const docsURL = "https://sketch.sys32.dev/";

export const isDevelopment = process.env.NODE_ENV !== "production";

export const isNode = typeof require === "function";

export function getStorage() {
  if (isNode)
    return new FSJSONStorage(
      require("path").join(require("os").homedir(), ".photoshop.sketch")
    );
  else return new GMJSONStorage();
}

export function getExposedWindow() {
  return (isNode ? window : unsafeWindow) as typeof globalThis;
}

export const isKrunker = location.hostname === "krunker.io";

export function getDevURL() {
  const devHost = process.env.SKETCH_DEV_HOST || "";
  if (!devHost) throw new TypeError("Invalid devHost");

  const devPort = process.env.SKETCH_DEV_PORT || "";
  if (!devPort) throw new TypeError("Invalid devPort");

  return `http://${devHost}:${devPort}/`;
}

export function getDevApiURL() {
  const devHost = process.env.SKETCH_DEV_API_HOST || "";
  if (!devHost) throw new TypeError("Invalid api devHost");

  const devPort = process.env.SKETCH_DEV_API_PORT || "";
  if (!devPort) throw new TypeError("Invalid api devPort");

  return `http://${devHost}:${devPort}/`;
}

/*
mouseY,
mouseX,
movDir,
lMouse,
rMouse,
jump,
reload,
crouch,
scroll,
swap,
restK,
inter
*/

export const iInputs = {
  frame: 0,
  /**
   * capped at 0.1-33
   * source: var mAimTime = Math.max(varForeignSurface, Math.min(argChurchSteam[1], argCompletelyNearby.dltMx)) / this.deltaDiv;
   */
  delta: 1,
  xDir: 2,
  yDir: 3,
  moveDir: 4,
  shoot: 5,
  scope: 6,
  jump: 7,
  reload: 8,
  crouch: 9,
  weaponScroll: 10,
  weaponSwap: 11,
  moveLock: 12,
};
