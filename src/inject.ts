import type KrunkBox from "./KrunkBox";
import { APIError } from "./KrunkBox";
import { getExposedWindow, isDevelopment } from "./consts";
import { hookContext, mirrorAttributes } from "./hook";
import tokenConfig, { DIYStage } from "./tokenConfig";

type Hook<Data> = (src: string) => { dataArg: string; data: Data; src: string };

let hasToken = false;

export async function getInit<Data>(
  krunkbox: KrunkBox,
  hook: Hook<Data>
): Promise<APIError.DIY | APIError.BadToken | (() => void)> {
  let token = "";

  if (new URLSearchParams(location.search).has("sandbox")) {
    tokenConfig.delete("diyToken");
  } else {
    const diyToken = tokenConfig.get("diyToken");

    if (!diyToken) {
      tokenConfig.delete("diyToken");
      fetchWASM();
      // location.reload();
      return APIError.DIY;
    }

    const interval = Date.now() - diyToken[1];

    if (interval > 60e3 * 2) {
      tokenConfig.delete("diyToken");
      location.reload();
      return APIError.DIY;
    }

    token = diyToken[0];
    tokenConfig.delete("diyToken");
  }

  hasToken = true;

  const [source, skins] = await Promise.all([
    krunkbox.source(),
    krunkbox.skins(),
  ]);
  if (source === APIError.BadToken) return source;
  if (skins === APIError.BadToken) return skins;

  // just a really long version of `any`
  (window as unknown as { skinfx: string }).skinfx = skins;

  const { src, data, dataArg } = hook(source);

  const game = new Function(
    "WP_MMToken",
    dataArg,
    src + (isDevelopment ? "//# sourceURL=https://krunker.io/js/game.js" : "")
  ) as (WP_MMToken: string, dataArg: Data) => void;

  return () => game(token, data);
}

let doFetchWASM: (() => void) | undefined;

let fetchWASMInstantly = false;

export function fetchWASM() {
  if (doFetchWASM) doFetchWASM();
  else fetchWASMInstantly = true;
}

export const gameLoad = new Promise<void>((resolveGameLoad) =>
  hookContext(getExposedWindow(), (context) => {
    const { fetch } = context;

    // use short-hand method so .prototype isn't created
    context.fetch = mirrorAttributes(
      (
        {
          fetch(input, init) {
            const inputURL = new URL(
              typeof input === "string" || input instanceof URL
                ? input
                : input.url,
              location.toString()
            );

            if (!hasToken) {
              if (
                inputURL.origin === "https://matchmaker.krunker.io" &&
                inputURL.pathname === "/seek-game"
              ) {
                const validationToken =
                  inputURL.searchParams.get("validationToken");
                if (!validationToken) throw new TypeError("");
                const diyToken = String.fromCharCode(
                  ...validationToken.split("").map((e) => e.charCodeAt(0) + 10)
                );
                tokenConfig.set("diyToken", [diyToken, Date.now()]);
                location.reload();
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                return new Promise(() => {});
              }
            } else {
              if (
                inputURL.origin === location.origin &&
                inputURL.pathname.startsWith("/pkg/loader")
              ) {
                // game has loaded
                resolveGameLoad();
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                return new Promise((resolve, reject) => {
                  doFetchWASM = () =>
                    fetch(input, init).then(resolve).catch(reject);
                  if (fetchWASMInstantly) doFetchWASM();
                });
              }
            }

            return fetch(input, init);
          },
        } as { fetch: typeof fetch }
      ).fetch,
      fetch
    );
  })
);
