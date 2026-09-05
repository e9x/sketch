import type KrunkBox from "./KrunkBox";
import { isDevelopment } from "./consts";

/**
 * @returns modified src
 */
export type Hook = (
  src: string,
  krunkbox: KrunkBox,
  args: Record<string, any>,
) => string;

export interface PreparedSource {
  success: true;
  source: string;
  injectArgs: Record<string, any>;
}

export async function prepareSource(
  krunkbox: KrunkBox,
  hook: Hook,
): Promise<
  | { success: false; error: [code: string, ...flags: any[]] }
  | PreparedSource
  | undefined
> {
  const gameData = await krunkbox.gameData();
  if (!gameData.success) return gameData;

  const window = globalThis;
  // @ts-ignore — set up renamed globals (e.g. JfCzGzvGIQB8rrJX = setTimeout)
  for (let i in gameData.renamed) window[gameData.renamed[i]] = window[i];

  const args: Record<string, any> = {};
  // Sentinel only: the prologue prefers the real token from arguments[0], but the
  // key must exist or no `var WP_MMToken` is emitted and the game source throws.
  args.WP_MMToken = "__sketch_no_token__";

  gameData.source = hook(gameData.source, krunkbox, args);

  if (isDevelopment) {
    gameData.source =
      gameData.source.replace("//# sourceMappingURL=app.js.map", "") +
      "//# sourceURL=https://krunker.io/js/app.js";
  } else {
    gameData.source = gameData.source.replace(
      "//# sourceMappingURL=app.js.map",
      "",
    );
  }

  return { success: true, source: gameData.source, injectArgs: args };
}
