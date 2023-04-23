import type KrunkBox from "./KrunkBox";
import { APIError } from "./KrunkBox";
import { configDelete, configGet, configSet } from "./config";
import { hookContext, mirrorAttributes } from "./superHook";

type Hook<Data> = (dataArg: string, src: string) => { data: Data; src: string };

enum DIYStage {
  false,
  /**
   * Get the token
   */
  token,
  /**
   * Ready to use "token" in config
   */
  ready,
}

const defaultDIY = DIYStage.false;

export async function getInit<Data>(krunkbox: KrunkBox, hook: Hook<Data>) {
  if (configGet<DIYStage>("diy", defaultDIY) === DIYStage.token)
    return APIError.DIY;

  const [token, source] = await Promise.all([
    fetchToken(krunkbox),
    krunkbox.source(),
  ]);

  if (token === APIError.BadToken || source === APIError.BadToken)
    return APIError.BadToken;

  if (token === APIError.DIY) {
    configSet("diy", DIYStage.token);
    location.reload();
    return APIError.DIY;
  }

  const dataArg = "_" + Math.random().toString(36).slice(2);

  const { src, data } = hook(dataArg, source);

  const game = new Function("WP_MMToken", dataArg, src) as (
    WP_MMToken: string,
    dataArg: Data
  ) => void;

  return () => game(token, data);
}

export async function fetchToken(krunkbox: KrunkBox) {
  if (configGet<DIYStage>("diy", defaultDIY) === DIYStage.ready) {
    const diyToken = configGet<string>("diyToken");
    if (!diyToken) throw new TypeError("No token");

    configDelete("diyToken");
    configDelete("diy");

    return diyToken;
  } else
    return await krunkbox.hash(
      await (await fetch("https://matchmaker.krunker.io/generate-token")).text()
    );
}

export const gameLoad = new Promise<void>((resolveGameLoad) =>
  hookContext(unsafeWindow as unknown as typeof globalThis, (context) => {
    const { fetch } = context;

    context.fetch = function (input, init) {
      const inputURL = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
        location.toString()
      );

      if (configGet<DIYStage>("diy", defaultDIY) === DIYStage.token) {
        if (
          inputURL.origin === "https://matchmaker.krunker.io" &&
          inputURL.pathname === "/seek-game"
        ) {
          const validationToken = inputURL.searchParams.get("validationToken");
          if (!validationToken) throw new TypeError("");
          const diyToken = String.fromCharCode(
            ...validationToken.split("").map((e) => e.charCodeAt(0) + 10)
          );

          configSet("diyToken", diyToken);
          configSet("diy", DIYStage.ready);
          location.reload();
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          return new Promise(() => {});
        }
      } else {
        if (
          inputURL.origin === location.origin &&
          inputURL.pathname === "/pkg/loader.wasm"
        ) {
          // game has loaded
          resolveGameLoad();
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          return new Promise(() => {});
        }
      }

      return fetch(input, init);
    };

    mirrorAttributes(fetch, context.fetch);
  })
);
