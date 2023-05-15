import { linkvertisePage } from "./consts";
import tokenConfig from "./tokenConfig";

// they went to the linkvertise
if (location.toString().startsWith(linkvertisePage))
  tokenConfig.set("lv", true);

// export a highly obfuscated function
export function wentToLV() {
  return new Promise<void>((resolve) => {
    if (tokenConfig.get("lv")) resolve();
    // infinitely wait
  });
}
