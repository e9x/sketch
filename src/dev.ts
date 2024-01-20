/**
 * You must enable Tampermonkey's instant inject feature for this to load correctly!
 * Krunker has taken defensive measures against Tampermonkey.
 *
 * 1. Go to Tampermonkey Dashboard
 * 2. Click on settings
 * 3. Change Config mode to Advanced
 * 4. Scroll to the bottom of the dashboard and find "Experimental". Change Inject Mode to Instant
 */

const devHost = process.env.SKETCH_DEV_API_HOST || "";
if (!devHost) throw new TypeError("Invalid SKETCH_DEV_API_HOST");

const devPort = process.env.SKETCH_DEV_API_PORT || "";
if (!devPort) throw new TypeError("Invalid SKETCH_DEV_API_PORT");

const devApiURL = `http://${devHost}:${devPort}/`;

const http = new XMLHttpRequest();
http.open("GET", new URL("sketch.user.js", devApiURL), false);
http.setRequestHeader("cache-control", "no-cache");
http.send();
eval(
  http.response +
    `\n//# sourceMappingURL=${new URL("sketch.user.js.map", devApiURL)}`
);
