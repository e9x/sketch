import type KrunkBox from "./KrunkBox";
import { isDevelopment } from "./consts";

/**
 * @returns modified src
 */
export type Hook = (
  src: string,
  krunkbox: KrunkBox,
  args: Record<string, any>
) => string;

export async function getInit(
  krunkbox: KrunkBox,
  hook: Hook
): Promise<
  | { success: false; error: [code: string, ...flags: any[]] }
  | { success: true; init: () => void }
  | undefined
> {
  const gameData = await krunkbox.gameData();
  if (!gameData.success) return gameData;

  // just a really long version of `any`
  (window as unknown as { skinfx: string }).skinfx = gameData.skins;

  const args: Record<string, any> = {};
  // args.WP_MMToken = token;
  args.WP_MMToken = "rape";

  gameData.source = hook(gameData.source, krunkbox, args);

  const game = new Function(
    ...Object.keys(args),
    gameData.source.replace("//# sourceMappingURL=app.js.map", "") +
    (isDevelopment ? "//# sourceURL=https://krunker.io/js/app.js" : "")
  ) as (...args: any[]) => void;

  return { success: true, init: () => game(...Object.values(args)) };
}
