import { mirrorAttributes } from "./hook";
import { getExposedWindow } from "./consts";

const window = getExposedWindow();

let tokenPromiseResolve: (res: Response) => void;
let tokenPromiseReject: (e: any) => void;

const tokenPromise = new Promise<Response>((resolve, reject) => {
  tokenPromiseResolve = resolve;
  tokenPromiseReject = reject;
});

let ifr: HTMLIFrameElement;

let { call: c } = (() => {}).bind;
// no get() allowed
c.bind = c.bind;
let str_in = c.bind(String.prototype.includes);
let ele_rm = c.bind(Element.prototype.remove);
let getSrc = c.bind(
  Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src")!.get!,
);
async function makeFrame() {
  // 1. Fetch the HTML of the current page immediately
  const response = await fetch(location.href);
  const html = await response.text();

  // 2. Create the iframe but DO NOT set .src
  const ifr = document.createElement("iframe");
  ifr.style.display = "none";

  const div = document.createElement("div");
  document.documentElement.append(div);
  const realm = div.attachShadow({ mode: "closed" });
  realm.append(ifr);

  const w = ifr.contentWindow! as any;
  const d = ifr.contentDocument!;

  // 3. Attach your MutationObserver to the iframe's document
  // BEFORE we write any HTML to it.
  const observer = new w.MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof w.Element)) continue;
        const tn = (node as any).tagName;
        if (["LINK", "STYLE"].includes(tn)) {
          ele_rm(node);
        }
        if (["SCRIPT"].includes(tn)) {
          const src = getSrc(node);
          if (src !== loader) ele_rm(node);
        }
      }
    }
  });

  observer.observe(d, {
    childList: true,
    subtree: true,
  });

  // 4. Hook the fetch inside the iframe
  const ifrFetch = w.fetch;
  const ifr_fetch = c.bind(ifrFetch);
  w.fetch = mirrorAttributes(function (this: any, url: any, init: any) {
    if (typeof url === "string" && str_in(url, "/seek-game")) {
      const p = _fetch(this, url, init) as Promise<Response>;
      p.then(tokenPromiseResolve).catch(tokenPromiseReject);
      ele_rm(ifr);
      ele_rm(div);
      throw void [0];
    }
    return ifr_fetch(this, url, init) as Promise<Response>;
  }, ifrFetch);

  // 5. THE KEY STEP: Synchronously write the HTML.
  // This triggers the MutationObserver immediately for every tag in the string.
  // The location.href remains correct (the parent URL).
  d.open();
  d.write(html);
  d.close();

  const s = d.createElement("style");
  s.textContent = `* { background-image: none !IMPORTANT } img { display: none !IMPORTANT }`;
  d.documentElement.append(s);
}

const ogFetch = window.fetch;
const _fetch = c.bind(ogFetch);

window.fetch = mirrorAttributes(
  async function (this: any, url, init) {
    if (typeof url === "string" && str_in(url, "/seek-game"))
      return await tokenPromise;
    return _fetch(this, url, init) as any;
  } as typeof fetch,
  ogFetch,
);

let addedFr = false;

let loader: string;

// let frame;

export const gameLoad = new Promise<void>((loaded) => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (!addedFr && document.documentElement) {
        makeFrame();
        addedFr = true;
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement)) continue;
        if (node.tagName === "SCRIPT") {
          if (node.src.startsWith("https://krunker.io/static/index-")) {
            loader = getSrc(node) as string;
            ele_rm(node);
            loaded();
          }
        }
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
});
