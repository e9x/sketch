import { getExposedWindow } from "./consts";

const window = getExposedWindow();

let tokenPromiseResolve: (url: string) => void;

const tokenPromise = new Promise<string>(resolve => tokenPromiseResolve = resolve);
const ifr = document.createElement("iframe");
ifr.src = location.href;
ifr.style.display = "none";
document.documentElement.append(ifr);
// @ts-ignore
const ifrFetch = ifr.contentWindow.fetch;
Object.defineProperty(ifr.contentWindow, "fetch", {
    get() {
        // @ts-ignore
        if (ifr.contentWindow?.windows?.length > 0) {
            // @ts-ignore
            return function (url, init) {
                if (url.includes("/seek-game")) {
                    ifr.remove();
                    tokenPromiseResolve(url);
                    return;
                }
                // @ts-ignore
                return ifrFetch.call(this, url, init);
            };
        }
        return ifrFetch;
    }
});

const _fetch = window.fetch;
window.fetch = async function (url, init) {
    if (typeof url === "string" && url.includes("/seek-game")) {
        url = await tokenPromise;
    }
    return _fetch.call(this, url, init);
};

export const gameLoad = new Promise<void>((loaded) => {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                const node = mutation.addedNodes[i] as HTMLScriptElement;
                if (node.tagName === "SCRIPT") {
                    if (node.src.startsWith("https://krunker.io/static/index-")) {
                        node.remove();
                        loaded();

                        // const game = downloadFileSync(serverUrl + "/game_1_4.js?" + Math.random().toString().slice(2));
                        // window.addEventListener("load", () => {
                        //     Function(id + "();\n\n" + game)();
                        // }, 1000);
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