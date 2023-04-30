import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";

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
  diyToken?: string;
  token?: string;
}

const defaultConfig: TokenConfig = {
  diy: DIYStage.false,
};

const tokenConfig = new Config<TokenConfig>(defaultConfig);

export const useTokenConfig = <K extends keyof TokenConfig>(
  key: K
): DataHook<TokenConfig, K> => useConfig(tokenConfig, key);

export default tokenConfig;
