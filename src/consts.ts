export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid SKETCH_API_URL");

export const workInkURL = process.env.SKETCH_WORKINK_URL || "";
if (!workInkURL) throw new TypeError("Invalid SKETCH_API_URL");

export const gameVersion = process.env.SKETCH_GAME_VERSION || "";
if (!gameVersion) throw new TypeError("Invalid SKETCH_GAME_VERSION");

export const sketchVersion = process.env.SKETCH_VERSION || "";
if (!sketchVersion) throw new TypeError("Invalid SKETCH_VERSION");

export const discordURL = "https://y9x.github.io/discord/";

export const docsURL = "https://sketch.sys32.dev/";

export const isDevelopment = process.env.NODE_ENV !== "PRODUCTION";

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

export const iInputs = {
  frame: 0,
  delta: 1, // capped at 0.1-33
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
