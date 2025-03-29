import type KrunkBox from "./KrunkBox";
import { getExposedWindow, isDevelopment } from "./consts";
import { hookContext, mirrorAttributes } from "./hook";
import tokenConfig from "./tokenConfig";

/**
 * @returns modified src
 */
export type Hook = (
  src: string,
  krunkbox: KrunkBox,
  args: Record<string, any>
) => string;

let needsToken = false;

export async function getInit(
  krunkbox: KrunkBox,
  hook: Hook
): Promise<
  | { success: false; error: [code: string, ...flags: any[]] }
  | { success: true; init: () => void }
  | undefined
> {
  let token = "";

  const fromEditor =
    opener &&
    opener.location.origin === location.origin &&
    opener.location.pathname === "/editor.html";

  if (fromEditor || new URLSearchParams(location.search).has("sandbox")) {
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

  const gameData = await krunkbox.gameData();
  if (!gameData.success) return gameData;

  // just a really long version of `any`
  (window as unknown as { skinfx: string }).skinfx = gameData.skins;

  const args: Record<string, any> = {};
  args.WP_MMToken = token;

  gameData.source = hook(gameData.source, krunkbox, args);

  const game = new Function(
    ...Object.keys(args),
    gameData.source +
      (isDevelopment ? "//# sourceURL=https://krunker.io/js/game.js" : "")
  ) as (...args: any[]) => void;

  return { success: true, init: () => game(...Object.values(args)) };
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
            }

            if (
              inputURL.origin === location.origin &&
              inputURL.pathname.startsWith("/pkg/loader")
            ) {
              // game has loaded
              resolveGameLoad();
              return new Promise((resolve, reject) => {
                doFetchWASM = () =>
                  fetch(input, init).then(resolve).catch(reject);
                if (fetchWASMInstantly) doFetchWASM();
              });
            }

            return fetch(input, init);
          },
        } as { fetch: typeof fetch }
      ).fetch,
      fetch
    );
  })
);
