import { hookContext, mirrorAttributes } from "./hook";
import { getExposedWindow } from "./consts";

const window = getExposedWindow();

hookContext(window);

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

function unspoofSeekUrl(url: string): string {
  try {
    const raw = sessionStorage.getItem("_sk_spoof");
    if (!raw) return url;
    const data = JSON.parse(raw) as { fake: string; real: string };
    if (data.fake && data.real && url.includes(encodeURIComponent(data.fake))) {
      return url.replace(encodeURIComponent(data.fake), encodeURIComponent(data.real));
    }
    if (data.fake && data.real && url.includes(data.fake)) {
      return url.replace(data.fake, data.real);
    }
  } catch {}
  return url;
}
function cleanStack(e: any): never {
  if (e instanceof Error && e.stack) {
    e.stack = e.stack
      .split("\n")
      .filter(
        (line) =>
          !line.trimStart().startsWith("at ") || line.includes("krunker.io"),
      )
      .join("\n");
  }
  throw e;
}
function makeFrame() {
  ifr = document.createElement("iframe");
  ifr.src = location.href;
  ifr.style.display = "none";
  const div = document.createElement("div");
  document.documentElement.append(div);
  const realm = div.attachShadow({ mode: "closed" });
  realm.append(ifr);
  // @ts-ignore
  const ifrFetch = ifr.contentWindow.fetch;
  const ifr_fetch = c.bind(ifrFetch);
  // Object.defineProperty(ifr.contentWindow, "fetch", {
  //     value:
  //         configurable: true,
  //         writable: true,
  //     });

  ifr.contentWindow!.fetch = mirrorAttributes(
    function (this: any, url, init) {
      // if (ifr.contentWindow?.windows?.length > 0) {
      if (typeof url === "string" && str_in(url, "/seek-game")) {
        ele_rm(ifr);
        ele_rm(div);
        const realUrl = unspoofSeekUrl(url);
        const p = _fetch(this, realUrl, init) as Promise<Response>;
        p.then(tokenPromiseResolve).catch(tokenPromiseReject);
      }
      // @ts-ignore
      return (ifr_fetch(this, url, init) as Promise<Response>).catch(
        cleanStack,
      );
    } as typeof fetch,
    ifrFetch,
  );
  // Object.defineProperty(ifr.contentWindow, "fetch", {
  //     get() {
  //         // @ts-ignore
  //         if (ifr.contentWindow?.windows?.length > 0) {
  //             // @ts-ignore
  //             return xnxx;
  //         }
  //         return ifrFetch;
  //     },
  //     set(v) {
  //         console.log("ASSIGNINMG TO FETCH:", v);
  //         xnxx = v;
  //     },
  //     configurable: true,
  //     writable: true,
  // });
}

const ogFetch = window.fetch;
const _fetch = c.bind(ogFetch);

window.fetch = mirrorAttributes(
  async function (this: any, url, init) {
    if (typeof url === "string" && str_in(url, "/seek-game")) {
      //   console.log("it wants to fetch", url);
      const xx = await tokenPromise.catch(cleanStack);
      //   console.log("done fetchin on main", xx, url, init);
      return xx;
    }
    return (_fetch(this, url, init) as Promise<Response>).catch(cleanStack);
  } as typeof fetch,
  ogFetch,
);

let addedFr = false;

export const gameLoad = new Promise<void>((loaded) => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (!addedFr && document.documentElement) {
        makeFrame();
        addedFr = true;
      }

      for (var i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i] as HTMLScriptElement;
        if (node.tagName === "SCRIPT") {
          if (node.src.startsWith("https://krunker.io/static/index-")) {
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
