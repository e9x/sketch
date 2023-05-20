import type { DataHook } from "../Config";
import Config, { useConfig } from "../Config";
import { getStorage } from "../consts";

export interface TrackerConfig {
  scale: number;
}

const defaultConfig: TrackerConfig = {
  scale: 1,
};

const trackerConfig = new Config<TrackerConfig>(defaultConfig, getStorage());

export const useTrackerConfig = <K extends keyof TrackerConfig>(
  key: K
): DataHook<TrackerConfig, K> => useConfig(trackerConfig, key);

export default trackerConfig;
