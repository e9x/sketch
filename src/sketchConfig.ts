import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage } from "./consts";

export interface SketchConfig {
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
  wallJump: boolean;
  nametags: boolean;
  boxes: boolean;
  chams: boolean;
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
}

/**
 * Default config. Also serves as a source of all the config keys (you can't iterate over an interface so this is the next best thing)
 */
const defaultConfig: SketchConfig = {
  aimbot: "off",
  hitbox: "head",
  bot: false,
  wallbangs: false,
  fovCheck: true,
  aimKey: -1,
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
  tracers: false,
  forceAuto: false,
  recoilControl: false,
  recoilControlKey: -1,
  recoilSmoothFactor: 0.4,
  triggerbot: false,
  triggerbotKey: -1,
  triggerbotMin: 0,
  triggerbotMax: 0,
  menuKey: -1,
  menuButton: true,
  silentFail: false,
  noAdsFovMlt: false,
  multiPoint: false,
  multiPointScale: 0.5,
  skinHack: false,
  keybindOverlay: false,
  healthBars: false,
};

const sketchConfig = new Config<SketchConfig>(defaultConfig, getStorage());

export const useSketchConfig = <K extends keyof SketchConfig>(
  key: K
): DataHook<SketchConfig, K> => useConfig(sketchConfig, key);

export default sketchConfig;
