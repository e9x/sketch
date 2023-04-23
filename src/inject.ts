import type KrunkBox from "./KrunkBox";
import { APIError } from "./KrunkBox";
import { hookContext, mirrorAttributes } from "./superHook";

type Hook<Data> = (dataArg: string, src: string) => { data: Data; src: string };

export async function getInit<Data>(krunkbox: KrunkBox, hook: Hook<Data>) {
  const [token, source] = await Promise.all([
    fetchToken(krunkbox),
    krunkbox.source(),
  ]);

  if (token === APIError.BadToken || source === APIError.BadToken)
    return APIError.BadToken;

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

export const gameLoad = new Promise<void>((resolve) => {
  hookContext(unsafeWindow as unknown as typeof globalThis, (context) => {
    const { fetch } = context;

    context.fetch = function (input, init) {
      if (typeof input === "string" && input.includes("loader.wasm")) {
        // game has loaded
        resolve();
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return new Promise(() => {});
      }

      return fetch(input, init);
    };

    mirrorAttributes(fetch, context.fetch);
  });
});
