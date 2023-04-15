import type KrunkBox from "./KrunkBox";
import { APIError } from "./KrunkBox";

export type Hook<Data> = (
  dataArg: string,
  src: string
) => { data: Data; src: string };

export async function getInit<Data>(krunkbox: KrunkBox, hook: Hook<Data>) {
  const [token, source] = await Promise.all([
    fetchToken(krunkbox),
    krunkbox.source(),
  ]);

  if (token === APIError.BadToken) throw new Error("Bad token!");

  const dataArg = "_" + Math.random().toString(36).slice(2);

  const { src, data } = hook(dataArg, source);

  const game = new Function("WP_MMToken", dataArg, src) as (
    WP_MMToken: string,
    dataArg: Data
  ) => void;

  return () => game(token, data);
}

export async function fetchToken(krunkbox: KrunkBox) {
  const token = await (
    await fetch("https://matchmaker.krunker.io/generate-token")
  ).text();

  return await krunkbox.hash(token);
}

export function waitForGameLoad() {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver((mutations, observer) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLScriptElement &&
            node.textContent?.includes("Yendis Entertainment")
          ) {
            // Clear the script's textContent to prevent loading.
            node.textContent = "";

            // Resolve the promise to indicate the game is ready to load.
            resolve();

            // The observer no longer needs to check for new elements because the WASM loading has been stopped.
            observer.disconnect();
          }
        }
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
    });
  });
}
