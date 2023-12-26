import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage } from "./consts";

export enum DIYStage {
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

export interface TokenConfig {
  diy?: DIYStage;
  diyToken?: [token: string, date: number];
  tmpToken: string;
  token?: string;
}

const defaultConfig: TokenConfig = {
  diy: DIYStage.false,
  tmpToken: "",
};

const storage = getStorage();

{
  interface OldTokenConfig {
    diy?: DIYStage;
    diyToken?: [token: string, date: number] | string;
  }

  const oldTokenConfig = new Config<OldTokenConfig>(defaultConfig, storage);

  const diyToken = oldTokenConfig.get("diyToken");

  // migrate
  if (typeof diyToken === "string") oldTokenConfig.delete("diyToken");
}

const tokenConfig = new Config<TokenConfig>(defaultConfig, storage);

export const useTokenConfig = <K extends keyof TokenConfig>(
  key: K
): DataHook<TokenConfig, K> => useConfig(tokenConfig, key);

export default tokenConfig;
