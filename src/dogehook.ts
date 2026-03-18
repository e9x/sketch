import { mirrorAttributes } from "./hook";
import { getExposedWindow } from "./consts";

const window = getExposedWindow();

let tokenPromiseResolve: (url: string) => void;

const tokenPromise = new Promise<string>(resolve => tokenPromiseResolve = resolve);


let ifr: HTMLIFrameElement;

let { call: c } = (() => { }).bind;
// no get() allowed
c.bind = c.bind;
let str_in = c.bind(String.prototype.includes);
let ele_rm = c.bind(Element.prototype.removeChild);
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

    // @ts-ignore
    ifr.contentWindow.fetch = mirrorAttributes(function (url, init) {
        // if (ifr.contentWindow?.windows?.length > 0) {
        if (typeof url === "string" && str_in(url, "/seek-game")) {
            ele_rm(ifr);
            ele_rm(div);
            tokenPromiseResolve(url);
            return;
        }
        // @ts-ignore
        return ifr_fetch(this, url, init);
    } as typeof fetch, ifrFetch)
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
};

const ogFetch = window.fetch;
const _fetch = c.bind(ogFetch);

window.fetch = async function (url, init) {
    if (typeof url === "string" && str_in(url, "/seek-game")) {
        url = await tokenPromise;
    }
    return _fetch(this, url, init) as any;
};

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
                        node.remove();
                        loaded();
                    }
                }
            }
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });
});