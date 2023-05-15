import { linkvertisePage } from "./consts";
import tokenConfig from "./tokenConfig";

// they went to the linkvertise

// wait a little bit
// like right after the bypasser redirects them
if (location.toString().startsWith(linkvertisePage))
  setTimeout(() => {
    tokenConfig.set("lv", true);
  }, 1e3);

// export a highly obfuscated function
export function wentToLV() {
  return new Promise<void>((resolve) => {
    if (tokenConfig.get("lv")) resolve();
    // infinitely wait
  });
}
