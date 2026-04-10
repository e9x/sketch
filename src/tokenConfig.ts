import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage } from "./consts";

export enum DIYStage {
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
  diyToken?: [token: string, date: number];
  token?: string;
  keyFromUrl?: string; // grabbed from /key/:SHIT: portion of url on api
}

const defaultConfig: TokenConfig = {};

const tokenConfig = new Config<TokenConfig>(defaultConfig, getStorage());

export async function initTokenConfig() {
  await tokenConfig.init();
}

export const useTokenConfig = <K extends keyof TokenConfig>(
  key: K
): DataHook<TokenConfig, K> => useConfig(tokenConfig, key);

export default tokenConfig;
