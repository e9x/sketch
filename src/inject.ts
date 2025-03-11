import type KrunkBox from "./KrunkBox";
import { getExposedWindow, isDevelopment } from "./consts";
import { hookContext, mirrorAttributes } from "./hook";
import tokenConfig from "./tokenConfig";

type Hook<Data> = (src: string) => { dataArg: string; data: Data; src: string };

let needsToken = false;

export async function getInit<Data>(
  krunkbox: KrunkBox,
  hook: Hook<Data>
): Promise<
  | { success: false; error: [code: string, ...flags: any[]] }
  | { success: true; init: () => void }
  | undefined
> {
  let token = "";

  if (new URLSearchParams(location.search).has("sandbox")) {
    tokenConfig.delete("diyToken");
  } else {
    const diyToken = tokenConfig.get("diyToken");

    if (!diyToken) {
      tokenConfig.delete("diyToken");
      fetchWASM();
      // location.reload();
      needsToken = true;
      return;
    }

    const interval = Date.now() - diyToken[1];

    if (interval > 60e3 * 2) {
      tokenConfig.delete("diyToken");
      location.reload();
      return;
    }

    token = diyToken[0];
    tokenConfig.delete("diyToken");
  }

  needsToken = false;

  const [source, skins] = await Promise.all([
    krunkbox.source(),
    krunkbox.skins(),
  ]);
  if (!source.success) return source;
  if (!skins.success) return skins;

  // just a really long version of `any`
  (window as unknown as { skinfx: string }).skinfx = skins.skins;

  const { src, data, dataArg } = hook(source.source);

  const game = new Function(
    "WP_MMToken",
    dataArg,
    src + (isDevelopment ? "//# sourceURL=https://krunker.io/js/game.js" : "")
  ) as (WP_MMToken: string, dataArg: Data) => void;

  return { success: true, init: () => game(token, data) };
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

            if (needsToken) {
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
