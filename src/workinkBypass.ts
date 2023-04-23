import { aboutURL, isKrunker } from "./consts";

if (isKrunker) {
  if (!GM.info.script.matches.includes("https://work.ink/4lH/krunker"))
    location.href = aboutURL;
} else
  unsafeWindow.decodeURIComponent = (encodedURIComponent) => {
    if (encodedURIComponent === location.pathname.slice(1)) {
      location.href = aboutURL;
      throw new DOMException("lol");
    } else return decodeURIComponent(encodedURIComponent);
  };
