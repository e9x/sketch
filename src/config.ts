/* eslint-disable @typescript-eslint/no-explicit-any */
const configTarget = new EventTarget();
const valueCache = new Map<string, unknown>();

/*export function configGet<T = any>(key: string): T | undefined;

export function configGet<T = any>(key: string, defaultValue: T): T;

export function configGet<T = any>(key: string, defaultValue?: T): T {
  if (valueCache.has(key)) return valueCache.get(key) as T;
  const value = GM_getValue(key, defaultValue);
  valueCache.set(key, value);
  return value;
}

export function configSet<T>(key: string, value: T) {
  valueCache.set(key, value);
  GM_setValue(key, value);
  configTarget.dispatchEvent(new Event(key));
}

export function configDelete(key: string) {
  valueCache.delete(key);
  GM_deleteValue(key);
  configTarget.dispatchEvent(new Event(key));
}*/

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

export interface Config {
  token?: string;
  aimbot: "off" | "smooth" | "silent";
  hitbox: "head" | "chest";
  bot: boolean;
  wallbangs: boolean;
  fovCheck: boolean;
  aimKey: number;
  fovRadius: number;
  smoothFactor: number;
  drawFOV: boolean;
  targetOnAimKey: boolean;
  bhop: boolean;
  slidehop: boolean;
  esp: boolean;
  forceAuto: boolean;
  recoilControl: boolean;
  recoilControlKey: number;
  recoilSmoothFactor: number;
  triggerbot: boolean;
  triggerbotKey: number;
  triggerbotMin: number;
  triggerbotMax: number;
  menuKey: number;
  menuButton: boolean;
  diy: DIYStage;
  diyToken?: string;
  noAdsFovMlt: boolean;
}

/**
 * Default config. Also serves as a source of all the config keys (you can't iterate over an interface so this is the next best thing)
 */
const defaultConfig: Config = {
  aimbot: "off",
  hitbox: "head",
  bot: false,
  wallbangs: false,
  fovCheck: true,
  aimKey: -1,
  fovRadius: 150,
  smoothFactor: 1,
  drawFOV: false,
  targetOnAimKey: false,
  bhop: false,
  slidehop: false,
  esp: false,
  forceAuto: false,
  recoilControl: false,
  recoilControlKey: -1,
  recoilSmoothFactor: 0.9,
  triggerbot: false,
  triggerbotKey: -1,
  triggerbotMin: 0,
  triggerbotMax: 0,
  menuKey: -1,
  menuButton: true,
  diy: DIYStage.false,
  noAdsFovMlt: false,
};

export function configGet<T extends keyof Config>(key: T) {
  if (valueCache.has(key)) return valueCache.get(key) as Config[T];
  const value = GM_getValue(key, defaultConfig[key]);
  valueCache.set(key, value);
  return value;
}

export function configSet<T extends keyof Config>(key: T, value: Config[T]) {
  valueCache.set(key, value);
  GM_setValue(key, value);
  configTarget.dispatchEvent(new Event(key));
}

export function configDelete(key: keyof Config) {
  valueCache.delete(key);
  GM_deleteValue(key);
  configTarget.dispatchEvent(new Event(key));
}

export function configReset() {
  for (const key in defaultConfig) configDelete(key as keyof Config);
}

export function configImport(config: Config) {
  for (const key in defaultConfig)
    if (key in config) {
      configSet(key as keyof Config, config[key as keyof Config]);
    } else configDelete(key as keyof Config);
}

export function configExport() {
  const exported: Partial<Config> = {};
  for (const key in defaultConfig)
    exported[key as keyof Config] = configGet(key as keyof Config) as any;
  return exported as Config;
}

// internal
// passing no arguments to the callback will result in the key being deleted
// checked by (...args) and args.length

export default function useConfig<T extends keyof Config>(
  key: T
): [Config[T], (...args: [Config[T]] | []) => void] {
  // trigger re-render with useState
  const [state, setState] = React.useState(configGet(key));

  React.useEffect(() => {
    function listener() {
      setState(configGet(key));
    }

    configTarget.addEventListener(key, listener, { once: true });

    return () => configTarget.removeEventListener(key, listener);
  });

  return [
    state,
    (...args) => {
      if (args.length === 0) {
        configDelete(key);
        setState(defaultConfig[key]);
      } else {
        configSet(key, args[0]);
        setState(args[0]);
      }
    },
  ];
}
