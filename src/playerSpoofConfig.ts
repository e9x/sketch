import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage } from "./consts";
import type { JSONStorage } from "./values";

export interface PlayerSpoofEdit {
  displayName: string;
  verified: boolean;
  premium: boolean;
  vip: boolean;
  badgeIndex: number;
  clan: string;
  rainbowClan: boolean;
}

export interface PlayerSpoofConfig {
  edits: Record<string, PlayerSpoofEdit>;
}

class PrefixJSONStorage implements JSONStorage {
  constructor(
    private readonly prefix: string,
    private readonly base: JSONStorage,
  ) {}

  private key(name: string) {
    return this.prefix + name;
  }

  setValue(name: string, value: unknown): void {
    this.base.setValue(this.key(name), value);
  }

  getValue<TValue>(name: string, defaultValue?: TValue): TValue {
    return this.base.getValue(this.key(name), defaultValue);
  }

  deleteValue(name: string): void {
    this.base.deleteValue(this.key(name));
  }

  listValues(): string[] {
    return this.base
      .listValues()
      .filter((name) => name.startsWith(this.prefix))
      .map((name) => name.slice(this.prefix.length));
  }
}

const defaultConfig: PlayerSpoofConfig = {
  edits: {},
};

const playerSpoofStorage = new PrefixJSONStorage("playerSpoof.", getStorage());

const playerSpoofConfig = new Config<PlayerSpoofConfig>(
  defaultConfig,
  playerSpoofStorage,
);

export async function initPlayerSpoofConfig() {
  await playerSpoofConfig.init();
}

export const usePlayerSpoofConfig = <K extends keyof PlayerSpoofConfig>(
  key: K,
): DataHook<PlayerSpoofConfig, K> => useConfig(playerSpoofConfig, key);

export default playerSpoofConfig;
