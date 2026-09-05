import { chromium } from "/home/user/src/krunkbox/node_modules/patchright/index.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROXY = "http://127.0.0.1:8888";
const TIMEOUT = 120_000;

async function main() {
  console.log("[e2e] reading sketch bundle...");
  const sketchBundle = await readFile(join(__dirname, "dist/sketch.user.js"), "utf-8");
  const sketchCode = sketchBundle.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, "");
  console.log(`[e2e] sketch bundle: ${sketchCode.length} chars`);

  console.log("[e2e] launching browser...");
  const browser = await chromium.launch({
    headless: true,
    proxy: { server: PROXY },
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") console.error("[browser]", text);
    else console.log(`[browser:${type}]`, text);
  });
  page.on("pageerror", (err) => console.error("[browser:pageerror]", err));

  const gmShim = `
    if (typeof unsafeWindow === "undefined") window.unsafeWindow = window;
    if (typeof GM_getValue === "undefined") {
      const _store = {};
      window.GM_getValue = (k, d) => k in _store ? _store[k] : d;
      window.GM_setValue = (k, v) => { _store[k] = v; };
      window.GM_deleteValue = (k) => { delete _store[k]; };
      window.GM_listValues = () => Object.keys(_store);
    }
    if (typeof GM_openInTab === "undefined") {
      window.GM_openInTab = (url) => window.open(url);
    }
    if (typeof GM_xmlhttpRequest === "undefined") {
      window.GM_xmlhttpRequest = (opts) => {
        const ctrl = new AbortController();
        fetch(opts.url, {
          method: opts.method || "GET",
          headers: opts.headers || {},
          body: opts.data || opts.body || undefined,
          signal: ctrl.signal,
        }).then(async (res) => {
          const text = await res.text();
          const resp = {
            status: res.status,
            statusText: res.statusText,
            responseHeaders: [...res.headers].map(([k,v]) => k+": "+v).join("\\r\\n"),
            responseText: text,
            response: text,
            finalUrl: res.url,
          };
          if (opts.onload) opts.onload(resp);
        }).catch((err) => {
          if (opts.onerror) opts.onerror(err);
        });
        return { abort: () => ctrl.abort() };
      };
    }
  `;

  const initScript = `<script>${gmShim}\n${sketchCode}<\/script>`;
  let injected = false;

  await page.route("**/*", async (route) => {
    const req = route.request();
    let url;
    try { url = new URL(req.url()); } catch { return route.abort(); }

    const isKru = url.hostname === "krunker.io" || url.hostname.endsWith(".krunker.io");
    const isSketchApi = url.hostname === "kru.eli.gift";
    if (!isKru && !isSketchApi) {
      return route.abort();
    }

    // inject sketch into the main-frame HTML only (not the dogehook iframe)
    if (!injected && url.hostname === "krunker.io" && url.pathname === "/"
        && req.resourceType() === "document") {
      try {
        const res = await route.fetch();
        let html = (await res.body()).toString("utf-8");
        const headIdx = html.indexOf("<head>");
        if (headIdx !== -1) {
          html = html.slice(0, headIdx + 6) + initScript + html.slice(headIdx + 6);
        } else {
          html = initScript + html;
        }
        injected = true;
        console.log("[e2e] injected sketch into HTML");
        return route.fulfill({ response: res, body: html });
      } catch (err) {
        console.error("[e2e] injection fetch failed:", err);
        return route.continue();
      }
    }

    // all other requests: pass through the browser proxy
    return route.continue();
  });

  console.log("[e2e] navigating to https://krunker.io/ ...");
  await page.goto("https://krunker.io/", { waitUntil: "load", timeout: 60000 });
  console.log("[e2e] page loaded, waiting for game...");

  // accept the consent gate
  try {
    await page.evaluate(() => {
      if (typeof checkTerms === "function") checkTerms(1);
    }, undefined, undefined, false);
  } catch {}

  const deadline = Date.now() + TIMEOUT;
  let gameLoaded = false;
  while (Date.now() < deadline) {
    try {
      gameLoaded = await page.evaluate(() => {
        return !!(window.gameLoaded || window.Game);
      }, undefined, undefined, false);
    } catch { break; }
    if (gameLoaded) break;
    await new Promise(r => setTimeout(r, 2000));
  }

  if (gameLoaded) {
    console.log("[e2e] \x1b[32mSUCCESS: game loaded with Sketch injected\x1b[0m");
    const state = await page.evaluate(() => ({
      gameLoaded: !!window.gameLoaded,
      hasGame: !!window.Game,
      hasGUI: !!window.GUI,
    }), undefined, undefined, false).catch(() => ({}));
    console.log("[e2e] Game state:", state);
  } else {
    console.error("[e2e] \x1b[31mFAILED: game did not load within", TIMEOUT / 1000, "seconds\x1b[0m");
    const state = await page.evaluate(() => ({
      title: document.title,
      bodyLen: document.body?.innerHTML?.length || 0,
      hasConsentBlock: !!document.getElementById("consentBlock"),
      consentVisible: document.getElementById("consentBlock")?.style?.display !== "none",
      hasInstructionHolder: !!document.getElementById("instructionHolder"),
      hasMenuHolder: !!document.getElementById("menuHolder"),
      scriptCount: document.querySelectorAll("script").length,
      iframeCount: document.querySelectorAll("iframe").length,
      errors: (window.__e2eErrors || []).slice(-5),
      bodySnippet: document.body?.innerHTML?.slice(0, 500) || "",
    }), undefined, undefined, false).catch((e) => ({ error: String(e) }));
    console.log("[e2e] Page state:", JSON.stringify(state, null, 2));
  }

  await browser.close();
  process.exit(gameLoaded ? 0 : 1);
}

main().catch((err) => {
  console.error("[e2e] Fatal:", err);
  process.exit(1);
});
