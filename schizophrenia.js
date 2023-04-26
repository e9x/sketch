import sample from "lodash/sample.js";

const firstChars = ["i", "I"];
const secondChars = ["î", "i", "ï", "í", "ì"];

/**
 *
 * @returns {string}
 */
export function generateIdentifier() {
  let id = sample(firstChars);
  for (let i = 0; i < 6; i++) id += sample(secondChars);
  return id;
}
