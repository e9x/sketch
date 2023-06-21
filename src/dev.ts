import { getDevApiURL } from "./consts";

/**
 * You must enable Tampermonkey's instant inject feature for this to load correctly!
 * Krunker has taken defensive measures against Tampermonkey.
 *
 * 1. Go to Tampermonkey Dashboard
 * 2. Click on settings
 * 3. Change Config mode to Advanced
 * 4. Scroll to the bottom of the dashboard and find "Experimental". Change Inject Mode to Instant
 */

const http = new XMLHttpRequest();
http.open("GET", new URL("sketch.user.js", getDevApiURL()), false);
http.setRequestHeader("cache-control", "no-cache");
http.send();
eval(
  http.response +
    `\n//# sourceMappingURL=${new URL("sketch.user.js.map", getDevApiURL())}`
);
