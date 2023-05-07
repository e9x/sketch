import sample from "lodash/sample.js";

const firstChars = ["i", "I"];
const secondChars = ["î", "i", "ï", "í", "ì"];

export function generateIdentifier() {
  /**
   * @type {string}
   */
  let id = sample(firstChars);

  for (let i = 0; i < 6; i++) {
    /**
     * @type {string}
     */
    const second = sample(secondChars);

    id += second;
  }

  return id;
}
