import Config from "./Config";
import { workInkBypassURL, isKrunker, isWorkInk } from "./consts";

interface BypassConfig {
  showedBypassNag: boolean;
}

const defaultConfig: BypassConfig = {
  showedBypassNag: false,
};

const bypassConfig = new Config<BypassConfig>(defaultConfig);

if (isKrunker) {
  // detect if user removed the work.ink matcher from the script
  if (!GM.info.script.matches.includes("https://work.ink/4lH/krunker"))
    showBypassNag();
} else if (isWorkInk) {
  // detect if a bypasser is enabled
  unsafeWindow.decodeURIComponent = (encodedURIComponent) => {
    if (encodedURIComponent === location.pathname.slice(1)) showBypassNag();
    return decodeURIComponent(encodedURIComponent);
  };
}

function showBypassNag() {
  if (!bypassConfig.get("showedBypassNag")) {
    GM_openInTab(workInkBypassURL, { active: true });
    bypassConfig.set("showedBypassNag", true);
  }
}
