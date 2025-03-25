import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage, isChromeOS } from "./consts";
import { keyboardMap } from "./krunker-ui/keys";

export type AimbotTarget = [name: string, id: string];

export interface SketchConfig {
  aimbot: "off" | "smooth" | "silent";
  hitbox: "head" | "chest" | "auto";
  bot: boolean;
  wallbangs: boolean;
  fovCheck: boolean;
  aimKey: number;
  aimReactionTime: number;
  fovRadius: number;
  smoothFactor: number;
  drawFOV: boolean;
  targetOnAimKey: boolean;
  bhop: boolean;
  slidehop: boolean;
  wallJump: boolean;
  nametags: boolean;
  boxes: boolean;
  chams: boolean;
  espOpacity: number;
  tracers: boolean;
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
  silentFail: boolean;
  noAdsFovMlt: boolean;
  multiPoint: boolean;
  multiPointScale: number;
  skinHack: boolean;
  keybindOverlay: boolean;
  healthBars: boolean;
  adblock: boolean;
  thirdPerson: boolean;
  skyColor: boolean;
  skyColorHex: string;
  watermark: boolean;
  spinbot: boolean;
  triggerbotDistance: number;
  targetList: AimbotTarget[];
  targetListMode: "off" | "whitelist" | "blacklist";
  badColor: string;
  goodColor: string;
}

/**
 * Default config. Also serves as a source of all the config keys (you can't iterate over an interface so this is the next best thing)
 */
const defaultConfig: SketchConfig = {
  aimbot: "off",
  hitbox: "auto",
  bot: false,
  wallbangs: false,
  fovCheck: true,
  aimKey: -1,
  aimReactionTime: 0,
  fovRadius: 150,
  smoothFactor: 0.7,
  drawFOV: false,
  targetOnAimKey: false,
  bhop: false,
  slidehop: false,
  wallJump: true,
  nametags: false,
  boxes: false,
  chams: false,
  espOpacity: 0.7,
  tracers: false,
  forceAuto: false,
  recoilControl: false,
  recoilControlKey: -1,
  recoilSmoothFactor: 0.4,
  triggerbot: false,
  triggerbotKey: -1,
  triggerbotMin: 0,
  triggerbotMax: 0,
  menuKey: isChromeOS ? keyboardMap.indexOf("[") : keyboardMap.indexOf("F1"),
  menuButton: true,
  silentFail: false,
  noAdsFovMlt: false,
  multiPoint: false,
  multiPointScale: 0.5,
  skinHack: false,
  keybindOverlay: false,
  healthBars: false,
  adblock: false,
  thirdPerson: false,
  skyColor: false,
  skyColorHex: "#000",
  watermark: false,
  spinbot: false,
  triggerbotDistance: 0.5,
  targetList: [],
  targetListMode: "off",
  badColor: "#ff0000",
  goodColor: "#00ff00",
};

const sketchConfig = new Config<SketchConfig>(defaultConfig, getStorage());

export const useSketchConfig = <K extends keyof SketchConfig>(
  key: K
): DataHook<SketchConfig, K> => useConfig(sketchConfig, key);

export default sketchConfig;
