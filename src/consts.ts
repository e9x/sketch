export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid SKETCH_API_URL");

export const linkvertiseURL = process.env.SKETCH_LINKVERTISE_URL || "";
if (!linkvertiseURL) throw new TypeError("Invalid SKETCH_LINKVERTISE_URL");

export const supportedGame = process.env.SKETCH_SUPPORTED_GAME || "";
if (!supportedGame) throw new TypeError("Invalid SKETCH_SUPPORTED_GAME");

export const sketchVersion = process.env.SKETCH_VERSION || "";
if (!sketchVersion) throw new TypeError("Invalid SKETCH_VERSION");

export const aboutURL = "https://sketch.sys32.dev/about";

export const discordURL = "https://y9x.github.io/discord/";

export const docsURL = "https://sketch.sys32.dev/";

export const isDevelopment = process.env.NODE_ENV !== "production";

export const isKrunker = location.hostname === "krunker.io";

export function getDevURL() {
  const devHost = process.env.SKETCH_DEV_HOST || "";
  if (!devHost) throw new TypeError("Invalid devHost");

  const devPort = process.env.SKETCH_DEV_PORT || "";
  if (!devPort) throw new TypeError("Invalid devPort");

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

export enum iInputs {
  frame = 0,
  /**
   * capped at 0.1-33
   * source: var mAimTime = Math.max(varForeignSurface, Math.min(argChurchSteam[1], argCompletelyNearby.dltMx)) / this.deltaDiv;
   */
  delta = 1,
  xDir = 2,
  yDir = 3,
  moveDir = 4,
  shoot = 5,
  scope = 6,
  jump = 7,
  reload = 8,
  crouch = 9,
  weaponScroll = 10,
  weaponSwap = 11,
  moveLock = 12,
}
