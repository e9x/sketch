import KrunkBox, { ProcessTokenErors } from "./KrunkBox";
import { isDevelopment, linkvertiseURL } from "./consts";
import tokenConfig from "./tokenConfig";

if (
  location.hostname === "sketch.sys32.dev" &&
  location.pathname === "/theatre/"
)
  sys32();

async function sys32() {
  if (!isDevelopment && document.referrer !== "https://linkvertise.com/")
    return location.replace(linkvertiseURL);

  // console.trace(document.referrer, [...location.ancestorOrigins]); // hmmm
  // debugger;

  const lvToken = new URLSearchParams(location.search).get("lv");
  const tmpToken = tokenConfig.get("tmpToken");

  if (!lvToken || !tmpToken) return location.replace("https://krunker.io/");

  const token = await KrunkBox.processToken(lvToken, tmpToken);
  if (token === ProcessTokenErors.BadToken)
    return location.replace("https://krunker.io/");

  tokenConfig.delete("tmpToken");
  tokenConfig.set("token", token);
  location.replace("https://krunker.io/");
}
