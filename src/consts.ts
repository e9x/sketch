export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid API_URL");

export const workInkURL = process.env.SKETCH_WORKINK_URL || "";
if (!workInkURL) throw new TypeError("Invalid API_URL");

export const gameVersion = process.env.SKETCH_GAME_VERSION || "";
if (!gameVersion) throw new TypeError("Invalid GAME_VERSION");

export function getDevURL() {
  const devHost = process.env.SKETCH_DEV_HOST || "";
  if (!devHost) throw new TypeError("Invalid devHost");

  const devPort = process.env.SKETCH_DEV_PORT || "";
  if (!devPort) throw new TypeError("Invalid devPort");

  return `http://${devHost}:${devPort}/`;
}
