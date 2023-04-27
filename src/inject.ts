import type KrunkBox from "./KrunkBox";
import { APIError } from "./KrunkBox";
import { DIYStage, configDelete, configGet, configSet } from "./config";
import { hookContext, mirrorAttributes } from "./superHook";

type Hook<Data> = (dataArg: string, src: string) => { data: Data; src: string };

export async function getInit<Data>(krunkbox: KrunkBox, hook: Hook<Data>) {
  let token: string;

  switch (configGet("diy")) {
    case DIYStage.false:
    case DIYStage.token:
      configSet("diy", DIYStage.token);
      fetchWASM();
      return APIError.DIY;
    case DIYStage.ready:
      {
        const diyToken = configGet("diyToken");
        if (!diyToken) throw new TypeError("No token");
        token = diyToken;
        configDelete("diyToken");
        configDelete("diy");
      }
      break;
  }

  const source = await krunkbox.source();

  if (source === APIError.BadToken) return APIError.BadToken;

  const dataArg = "_" + Math.random().toString(36).slice(2);

  const { src, data } = hook(dataArg, source);

  const game = new Function("WP_MMToken", dataArg, src) as (
    WP_MMToken: string,
    dataArg: Data
  ) => void;

  return () => game(token, data);
}

let doFetchWASM: (() => void) | undefined;

let fetchWASMInstantly = false;

function fetchWASM() {
  if (doFetchWASM) doFetchWASM();
  else fetchWASMInstantly = true;
}

export const gameLoad = new Promise<void>((resolveGameLoad) =>
  hookContext(unsafeWindow as unknown as typeof globalThis, (context) => {
    const { fetch } = context;

    context.fetch = function (input, init) {
      const inputURL = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
        location.toString()
      );

      if (configGet("diy") === DIYStage.token) {
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
          return new Promise((resolve, reject) => {
            doFetchWASM = () => fetch(input, init).then(resolve).catch(reject);
            if (fetchWASMInstantly) doFetchWASM();
          });
        }
      }

      return fetch(input, init);
    };

    mirrorAttributes(fetch, context.fetch);
  })
);
