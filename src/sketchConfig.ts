import { MapData } from "./krunker/GameMap";
import type { DataHook } from "./Config";
import Config, { useConfig } from "./Config";
import { getStorage, isChromeOS, isNode, hasGM } from "./consts";
import { keyboardMap } from "./krunker-ui/keys";
import tokenConfig from "./tokenConfig";
import migrationConfig, { initMigrationConfig } from "./migrationConfig";
import { IDBJSONStorage } from "./values";

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

const skyboxSources: Array<[key: string, folder: string, name: string]> = [
  ["galaxy", "galaxy", "Galaxy"],
  ["lean", "lean", "Lean"],
  ["night", "night", "Night"],
  ["sunset", "sunset", "Sunset"],
  ["jew", "jew", "Jew"],
  ["jew2", "jew2", "Jew2"],
  ["nigga", "nigga", "Nigga"],
  ["max", "max", "Sexy Femboy"],
  [
    "mountainyNight",
    "136465089093652_Mountainy_night_time_skybox",
    "Mountainy Night Time Skybox",
  ],
  ["rain", "1064861992_Rain_Skybox", "Rain Skybox"],
  ["poisonFog", "1864979969_Poison_Fog_Skybox", "Poison Fog Skybox"],
  ["space", "15619750970_Space_Skybox", "Space Skybox"],
  ["purpleNebula", "230057997_Purple_Nebula_Skybox", "Purple Nebula Skybox"],
  [
    "cloudAtmospheric",
    "71056550510292_Cloud_Skybox_Atmospheric_Aesthetic_Pbr_Blur",
    "Cloud Atmospheric Blur Skybox",
  ],
  [
    "cloudyRealistic",
    "108995333026041_Skybox_Cloudy_Realistic_Aesthetic_Pbr_Fun",
    "Cloudy Realistic Skybox",
  ],
];

export const skyboxes: Record<string, SketchSkybox> = Object.fromEntries(
  skyboxSources.map(([key, folder, name]) => [
    key,
    {
      name,
      faces: [
        `https://eli.gift/skybox/${folder}/SkyboxFt.png`,
        `https://eli.gift/skybox/${folder}/SkyboxBk.png`,
        `https://eli.gift/skybox/${folder}/SkyboxUp.png`,
        `https://eli.gift/skybox/${folder}/SkyboxDn.png`,
        `https://eli.gift/skybox/${folder}/SkyboxRt.png`,
        `https://eli.gift/skybox/${folder}/SkyboxLf.png`,
      ],
    },
  ]),
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
  tracersEnemy: boolean;
  tracersFriendly: boolean;
  tracerThickness: number;
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
  badgeRainbow: boolean;
  keybindOverlay: boolean;
  healthBars: boolean;
  adblock: boolean;
  thirdPerson: boolean;
  skyColor: boolean;
  skyColorHex: string;
  mapOverrides: boolean;
  mapOverridesCode: MapData;
  mapOverridesHue: number;
  skybox: string;
  skyboxHue: number;
  watermark: boolean;
  spinbot: "off" | "physical" | "visual";
  triggerbotDistance: number;
  targetList: AimbotTarget[];
  targetListMode:
    | "off"
    | "guestOnly"
    | "playerOnly"
    | "whitelist"
    | "blacklist";
  badColor: string;
  goodColor: string;
  espRainbowEnemy: boolean;
  espRainbowFriendly: boolean;
  espWallDarkness: number;
  hideClouds: boolean;

  // LEGACY:
  espOpacity?: number;
  tracers?: boolean;

  mouseLockX: number;
  mouseLockY: number;
  noSpread: boolean;
  vibrator: boolean;
  autoSpawn: boolean;
  espMenu: boolean;

  aiReply: boolean;
  aiEndpoint: string;
  aiKey: string;
  aiPrompt: string;
  aiModel: string;
  spectatorsOverlay: boolean;
}

/**
 * Default config. Also serves as a source of all the config keys (you can't iterate over an interface so this is the next best thing)
 */
const defaultConfig: SketchConfig = {
  aimbot: "silent",
  aimbotEnabled: false,
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
  tracersEnemy: false,
  tracersFriendly: false,
  tracerThickness: 1.5,
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
  badgeRainbow: false,
  keybindOverlay: false,
  healthBars: false,
  adblock: true,
  thirdPerson: false,
  skyColor: false,
  skyColorHex: "#000",
  mapOverrides: false,
  mapOverridesCode: lean,
  mapOverridesHue: 0,
  skybox: "off",
  skyboxHue: 0,
  watermark: false,
  spinbot: "off",
  triggerbotDistance: 0.5,
  targetList: [],
  targetListMode: "off",
  badColor: "#ff0000",
  goodColor: "#00ff00",
  espRainbowEnemy: false,
  espRainbowFriendly: false,
  espWallDarkness: 0.7,
  hideClouds: false,
  mouseLockX: 0,
  mouseLockY: 0,
  noSpread: false,
  vibrator: false,
  autoSpawn: false,
  espMenu: true,
  aiReply: false,
  spectatorsOverlay: false,
  aiEndpoint: "https://chat.openai.com/v1/chat/completions",
  aiKey: "SK_YOUR_KEY",
  aiPrompt:
    "skip the niceties you're here to talk shit. be brutally concise; ditch the fluff. use only lowercase; reserve ALL CAPS for punches and Initial Letter Capitalization to mock ProperNouns. ditch obscure vocab opt for sharp, plain insults. be clever, not tryhard wit over wank. send at most one or two bangers per response. lean on late-millennial slang; slip a random zoomer buzzword to keep them on edge. no preambles, no compliments, no disclaimers output only the roast. keep it under 250 characters.",
  aiModel: "gpt-4.1",
};

const sketchConfig = new Config<SketchConfig>(defaultConfig, getStorage());

export async function initSketchConfig() {
  await initMigrationConfig();
  await sketchConfig.init();

  // --- bing localStorage loader migration ---
  // the old loader stored all settings as JSON in localStorage['bing']
  {
    if (!migrationConfig.get("bingMigrated")) {
      try {
        const raw = localStorage.getItem("bing");
        if (raw) {
          const data = JSON.parse(raw);
          if (data && typeof data === "object") {
            sketchConfig.import(data, false);
          }
          localStorage.removeItem("bing");
        }
      } catch {}
      migrationConfig.set("bingMigrated", true);
    }
  }

  // --- .photoshop.sketch file migration ---
  {
    if (!migrationConfig.get("fsMigrated")) {
      try {
        if (isNode) {
          const fs = require("fs");
          const path = require("path").join(
            require("os").homedir(),
            ".photoshop.sketch"
          );
          if (fs.existsSync(path)) {
            const data = JSON.parse(fs.readFileSync(path, "utf-8"));
            if (data && typeof data === "object") {
              sketchConfig.import(data, false);
            }
            fs.unlinkSync(path);
          }
        }
      } catch {}
      migrationConfig.set("fsMigrated", true);
    }
  }

  // --- GM_* → IDB migration (only when NOT running under a userscript manager) ---
  // if GM_info exists, GMJSONStorage is already the primary backend — no migration needed
  {
    if (!hasGM && !migrationConfig.get("gmMigrated")) {
      try {
        if (typeof GM_listValues === "function") {
          const keys = GM_listValues();
          for (const key of keys) {
            if (key in defaultConfig) {
              const value = GM_getValue(key);
              sketchConfig.set(key as keyof SketchConfig, value as never);
            }
          }
          // also migrate token data
          for (const key of ["token", "diyToken", "keyFromUrl"] as const) {
            if (keys.includes(key)) {
              tokenConfig.set(key, GM_getValue(key));
            }
          }
        }
      } catch {}
      migrationConfig.set("gmMigrated", true);
    }
  }

  // --- IDB → GM migration (when GM APIs are available and selected as primary storage) ---
  {
    if (
      hasGM &&
      (!migrationConfig.get("idbToGmMigrated") ||
        !migrationConfig.get("idbTokenToGmMigrated"))
    ) {
      try {
        const idbStore = new IDBJSONStorage("_appCache");
        await idbStore.init();

        const idbKeys = new Set(idbStore.listValues());

        if (!migrationConfig.get("idbToGmMigrated")) {
          for (const key in defaultConfig) {
            const typedKey = key as keyof SketchConfig;
            if (!idbKeys.has(key)) continue;

            const current = sketchConfig.get(typedKey);
            const fallback = defaultConfig[typedKey];

            // Only backfill GM when current value is still default.
            if (Object.is(current, fallback)) {
              const migratedValue = idbStore.getValue(key, fallback);
              sketchConfig.set(typedKey, migratedValue as never);
            }
          }

          migrationConfig.set("idbToGmMigrated", true);
        }

        if (!migrationConfig.get("idbTokenToGmMigrated")) {
          for (const key of ["token", "diyToken", "keyFromUrl"] as const) {
            if (!idbKeys.has(key)) continue;

            const current = tokenConfig.get(key);
            if (typeof current !== "undefined") continue;

            const migratedValue = idbStore.getValue(key, undefined);
            if (typeof migratedValue !== "undefined") {
              tokenConfig.set(key, migratedValue);
            }
          }

          migrationConfig.set("idbTokenToGmMigrated", true);
        }
      } catch {}
    }
  }

  // --- legacy migrations (moved from module top-level) ---
  {
    const spinbot = sketchConfig.get("spinbot");
    if (typeof spinbot === "boolean") {
      sketchConfig.set("spinbot", spinbot ? "physical" : "off");
    }

    const espOpacity = sketchConfig.get("espOpacity");

    if (typeof espOpacity === "number") {
      sketchConfig.delete("espOpacity");
      sketchConfig.set("chamsOpacity", espOpacity);
      sketchConfig.set("overlayOpacity", espOpacity);
    }

    const legacyTracers = sketchConfig.get("tracers");
    if (typeof legacyTracers === "boolean") {
      sketchConfig.set("tracersEnemy", legacyTracers);
      sketchConfig.set("tracersFriendly", legacyTracers);
      sketchConfig.delete("tracers");
    }

    // Wipe localStorage keys flagged by CHEAT_CHECK payload (runs once)
    if (!migrationConfig.get("skincMigrated")) {
      const CC_FLAGGED_KEYS = [
        // Skin spoofer signatures
        "savedIndexes",
        "ownedIDs",
        // Lombre matchmaker extension
        "lombre_precise_matchmaker_version",
        "lombre_precise_matchmaker_all_region",
        "lombre_precise_matchmaker_status",
        "lombre_precise_matchmaker_min_players",
        "lombre_precise_matchmaker_max_players",
        "lombre_precise_matchmaker_min_time",
        "lombre_precise_matchmaker_max_results",
        "lombre_precise_matchmaker_fav_maps",
        "lombre_precise_matchmaker_auto_join_fav",
        "lombre_settings",
      ];
      for (const key of CC_FLAGGED_KEYS) {
        localStorage.removeItem(key);
      }
      migrationConfig.set("skincMigrated", true);
    }
  }
}

export const useSketchConfig = <K extends keyof SketchConfig>(
  key: K,
): DataHook<SketchConfig, K> => useConfig(sketchConfig, key);

export default sketchConfig;
