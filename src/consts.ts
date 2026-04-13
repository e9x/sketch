import {
  FSJSONStorage,
  GMJSONStorage,
  type JSONStorage,
} from "./values";

export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid SKETCH_API_URL");

export const supportedGame = process.env.SKETCH_SUPPORTED_GAME || "";
if (!supportedGame) throw new TypeError("Invalid SKETCH_SUPPORTED_GAME");

export const sketchVersion = process.env.SKETCH_VERSION || "";
if (!sketchVersion) throw new TypeError("Invalid SKETCH_VERSION");

export const isChromeOS = /\bCrOS\b/.test(navigator.userAgent);

export const discordURL = "https://y9x.github.io/discord/";

export const docsURL = "https://krunker.zip/";

export const isDevelopment = process.env.NODE_ENV !== "production";

let isNode: boolean;

try {
  require("os");
  isNode = true;
} catch (err) {
  isNode = false;
}

const hasGM =
  typeof GM_getValue === "function" && typeof GM_setValue === "function";

function createStorage(): JSONStorage {
  if (isNode)
    return new FSJSONStorage(
      require("path").join(require("os").homedir(), ".photoshop.sketch"),
    );
  if (hasGM) return new GMJSONStorage();
  throw new Error("No storage backend available");
}

const storage = createStorage();

export function getStorage() {
  return storage;
}

export { hasGM };

export function getExposedWindow() {
  return (isNode ? window : unsafeWindow) as typeof globalThis;
}

export { isNode };

export const isKrunker =
  window === top &&
  ["proxy.krunk.cc", "krunker.io"].includes(location.hostname);

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
