import { MapData } from "./krunker/GameMap";
import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage, isChromeOS } from "./consts";
import { keyboardMap } from "./krunker-ui/keys";

export type AimbotTarget = [name: string, id: string];

// random test map with the sexy colorz
const stargaze: MapData = {
  skyDome: true,
  skyDomeCol0: "#000000",
  skyDomeCol1: "#111E23",
  skyDomeCol2: "#DCE8ED",
  skyDomeEmis: "#FF0000",
  skyDomeEmisTex: "43028",
  skyDomeTex: true,
  skyDomeTexA: 43028,
  skyDomeMovD: "0",
  skyDomeMovT: -8,
  ambient: "#97a0a8",
  light: "#203dbe",
  lightD: 2145,
  lightI: 0.5,
  sky: "#dce8ed",
  sunAngX: null,
  sunAngY: null,
  fog: "#8d9aa0",
  fogD: 2000,
};

const lean: MapData = {
  skyDome: false,
  light: "#894060",
  ambient: "#8f3ad3",
  sky: "#748e75",
  fog: "#6f3569",
};

export interface SketchSkybox {
  name: string;
  // 'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'
  faces: string[];
}

export const skyboxes: Record<string, SketchSkybox> = Object.fromEntries(
  ["galaxy", "lean", "night", "sunset", "jew", "jew2", "nigga"].map((e) => [
    e,
    {
      name: e[0].toUpperCase() + e.slice(1),
      faces: [
        `https://eli.gift/skybox/${e}/SkyboxFt.png`,
        `https://eli.gift/skybox/${e}/SkyboxBk.png`,
        `https://eli.gift/skybox/${e}/SkyboxUp.png`,
        `https://eli.gift/skybox/${e}/SkyboxDn.png`,
        `https://eli.gift/skybox/${e}/SkyboxRt.png`,
        `https://eli.gift/skybox/${e}/SkyboxLf.png`,
      ],
    },
  ])
);

export interface SketchConfig {
  aimbot: "smooth" | "silent";
  aimbotEnabled: boolean;
  toggleAimbotKey: number;
  hitbox: "head" | "chest" | "feet" | "auto";
  bot: boolean;
  botCrouch: boolean;
  botAim: boolean;
  wallbangs: boolean;
  fovCheck: boolean;
  aimKey: number;
  aimReactionTime: number;
  fovRadius: number;
  smoothFactor: number;
  drawFOV: boolean;
  targetOnAimKey: boolean;
  bhop: boolean;
  rampAccel: boolean;
  slidehop: boolean;
  autoSlide: boolean;
  wallJump: boolean;
  nametags: boolean;
  newNametags: boolean;
  boxes: boolean;
  chams: boolean;
  overlayOpacity: number;
  chamsOpacity: number;
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
  mapOverrides: boolean;
  mapOverridesCode: MapData;
  skybox: string;
  watermark: boolean;
  spinbot: "off" | "physical" | "visual";
  triggerbotDistance: number;
  targetList: AimbotTarget[];
  targetListMode: "off" | "guestOnly" | "playerOnly" | "whitelist" | "blacklist";
  badColor: string;
  goodColor: string;
  hideClouds: boolean;

  // LEGACY:
  espOpacity?: number;

  mouseLockX: number;
  mouseLockY: number;
  noSpread: boolean;
  vibrator: boolean;
}

/**
 * Default config. Also serves as a source of all the config keys (you can't iterate over an interface so this is the next best thing)
 */
const defaultConfig: SketchConfig = {
  aimbot: "silent",
  aimbotEnabled: true,
  toggleAimbotKey: -1,
  hitbox: "auto",
  bot: false,
  botCrouch: true,
  botAim: true,
  wallbangs: false,
  fovCheck: true,
  aimKey: -1,
  aimReactionTime: 0,
  fovRadius: 150,
  smoothFactor: 0.7,
  drawFOV: false,
  targetOnAimKey: false,
  bhop: false,
  rampAccel: false,
  slidehop: false,
  autoSlide: false,
  wallJump: true,
  nametags: false,
  newNametags: false,
  boxes: false,
  chams: false,
  overlayOpacity: 1,
  chamsOpacity: 0.6,
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
  adblock: true,
  thirdPerson: false,
  skyColor: false,
  skyColorHex: "#000",
  mapOverrides: false,
  mapOverridesCode: lean,
  skybox: "off",
  watermark: false,
  spinbot: "off",
  triggerbotDistance: 0.5,
  targetList: [],
  targetListMode: "off",
  badColor: "#ff0000",
  goodColor: "#00ff00",
  hideClouds: false,
  mouseLockX: 0,
  mouseLockY: 0,
  noSpread: false,
  vibrator: false,
};

const sketchConfig = new Config<SketchConfig>(defaultConfig, getStorage());

// legacy migrations
{
  const spinbot = sketchConfig.get("spinbot");
  if (typeof spinbot === "boolean") {
    sketchConfig.set("spinbot", spinbot ? "physical" : "off");
    console.log("migrated spinbot");
  }

  const espOpacity = sketchConfig.get("espOpacity");

  if (typeof espOpacity === "number") {
    sketchConfig.delete("espOpacity");
    sketchConfig.set("chamsOpacity", espOpacity);
    sketchConfig.set("overlayOpacity", espOpacity);
    // console.log("migrated esp opacity");
  }
}

export const useSketchConfig = <K extends keyof SketchConfig>(
  key: K
): DataHook<SketchConfig, K> => useConfig(sketchConfig, key);

export default sketchConfig;
