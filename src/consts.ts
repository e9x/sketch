export const apiURL = process.env.SKETCH_API_URL || "";
if (!apiURL) throw new TypeError("Invalid API_URL");

export const workInkURL = process.env.SKETCH_WORKINK_URL || "";
if (!workInkURL) throw new TypeError("Invalid API_URL");
