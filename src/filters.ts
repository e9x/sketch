import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObject from "./krunker/Object";
import { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as Overlay from "./krunker/overlay";
import sketchConfig from "./sketchConfig";
import { console, defineProperty } from "./crashout";
import { mirrorAttributes } from "./hook";
import type KrunkBox from "./KrunkBox";
import { MapData } from "./krunker/GameMap";

// export const data: any[] & Record<string, any> = [];
export const data: Record<string, any> = {};

export const patches: Record<
  string,
  [
    match: RegExp | string,
    replacer: (substring: string, ...args: any[]) => string,
  ]
> = {};

export const dataArg = "_" + Math.random().toString(36).slice(2);

patches.UseStrict = [/"use strict";/, () => ""];

/* javascript-obfuscator:disable */

// called before game init: get ya hooks in
export const beforeGame: (() => void)[] = [];
// called after game init: pull out!
export const afterGame: (() => void)[] = [];

beforeGame.push(() => {
  const { getItem, setItem } = Storage.prototype;
  Storage.prototype.getItem = mirrorAttributes(function (
    this: Storage,
    key: string
  ) {
    // catch fingerprinting crap
    let value = getItem.call(this, key);
    if (key === "conUID_") {
      console.trace("conUID blocked 👀");
      value = null;
    }
    return value;
  }, getItem);

  // analytics: collect account name + id
  /*          (ee = new HI(a, t, null)),
          saveVal("krunker_id", a),
          saveVal("krunker_username", t),*/
  let loginFrame: string | undefined;
  Storage.prototype.setItem = mirrorAttributes(function (
    this: Storage,
    key: string,
    value: string
  ) {
    if (key === "krunker_id") {
      // for some reason is passed as an integer
      loginFrame = String(value);
      setTimeout(() => (loginFrame = undefined));
    }

    if (key === "krunker_username" && typeof loginFrame === "string") {
      getBox().slop(loginFrame, value);
      loginFrame = undefined;
    }

    // catch fingerprinting crap
    if (key === "conUID_") {
      console.log("conUID blocked 👀");
      return;
    }

    setItem.call(this, key, value);
  }, setItem);
});

let config: typeof configModule | undefined;

export function getConfig() {
  if (!config) throw new Error("Too early");
  return config;
}

beforeGame.push(() => {
  const { freeze } = Object;

  Object.freeze = mirrorAttributes(function (obj: any) {
    if ("gameVersion" in obj) {
      config = obj;
      // console.log("game config:", config);
    }
    return freeze(obj);
  }, freeze);

  afterGame.push(() => (Object.freeze = freeze));
});

/**
 * After the overlay is rendered
 * 2x slower than renderHooks
 * Used for game UI overlay
 */
export const overlayRenderHooks: (() => void)[] = [];
export const preOverlayRenderHooks: (() => void)[] = [];

let overlay: typeof Overlay | undefined;

export function getOverlay() {
  if (!overlay) throw new Error("Too early");
  return overlay;
}

declare global {
  interface Object {
    render: any;
    controls: any;
    skyDomeInit: any;
    bundleMedalFilters: any;
  }
}

beforeGame.push(() => {
  defineProperty(Object.prototype, "render", {
    configurable: true,
    enumerable: false,
    set(value) {
      // console.log({ value });
      if (!("medalsList" in this))
        return defineProperty(this, "render", {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });

      delete Object.prototype.render;
      this.render = value;
      overlay = this;
      doOverlayHooks();
    },
  });

  afterGame.push(() => delete Object.prototype.render);
});

function doOverlayHooks() {
  const overlay = getOverlay();
  const renderFn = overlay.render;

  overlay.render = function (...args) {
    if (localPlayer) for (const hook of preOverlayRenderHooks) hook();
    const result = renderFn.call(this, ...args);
    if (localPlayer) for (const hook of overlayRenderHooks) hook();
    return result;
  };
}

let render: RenderManager | undefined;

export function getRender() {
  if (!render) throw new Error("Too early");
  return render;
}

/**
 * After the 3D game is rendered
 * 2x faster than overlayRenderHooks
 * Used for THREE.js
 */
export const renderHooks: (() => void)[] = [];
export const preRenderHooks: (() => void)[] = [];

export function redrawSky() {
  try {
    // trigger an update

    // getRender().renderer.setClearColor(getRealClearColor());
    const render = getRender();
    const id = render.lastEnvId;
    render.lastEnvId = undefined;
    getRender().updateGameEnvironment(-1, id);
  } catch (e) {
    //
    console.error(e);
  }
}

function doRenderHooks() {
  const render = getRender();

  const { init } = render;
  // <patched, og>
  const maps = new WeakMap<any, any>();
  render.init = function (config, mode, idk1, idk2) {
    // console.trace("lol init ez", [config, mode, idk1, idk2]);
    if (maps.has(config)) config = maps.get(config);

    let nConfig = config;

    // stargaze
    nConfig = { ...config };
    if (sketchConfig.get("mapOverrides"))
      Object.assign(nConfig, sketchConfig.get("mapOverridesCode"));
    if (sketchConfig.get("skyColor"))
      Object.assign(nConfig, {
        skyDome: false,
        sky: sketchConfig.get("skyColorHex"),
      });
    maps.set(nConfig, config);

    console.log("map config:", nConfig);

    init.call(this, nConfig, mode, idk1, idk2);
  };

  // we hook the render way too early
  defineProperty(render, "render", {
    set(value: RenderManager["render"]) {
      // remove descriptor
      delete (render as any).render;
      render.render = function (...args) {
        if (localPlayer) for (const hook of preRenderHooks) hook();
        const result = value.call(this, ...args);
        if (localPlayer) for (const hook of renderHooks) hook();
        return result;
      };
    },
    configurable: true,
  });

  const genericAdsArray = [...Array(64)].fill(0);
  let ogAds = render.adsFov;
  defineProperty(render, "adsFov", {
    get: () => {
      if (!sketchConfig.get("noAdsFovMlt")) return ogAds;
      try {
        const ads: number[] = [];

        ads[render.getPlayerWeaponId(getLocalPlayer())] = 0;

        return ads;
      } catch {
        return genericAdsArray;
      }
    },
    set: (value) => {
      ogAds = value;
    },
  });
}

beforeGame.push(() => {
  defineProperty(Object.prototype, "skyDomeInit", {
    configurable: true,
    enumerable: false,
    set(this: RenderManager, value) {
      if (!("skyDomeInit" in this))
        return defineProperty(this, "skyDomeInit", {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });

      // console.log("thy render is", this);
      delete Object.prototype.skyDomeInit;
      this.skyDomeInit = value;
      render = this;
      doRenderHooks();
      // now hoook it
    },
  });

  defineProperty(Object.prototype, "controls", {
    configurable: true,
    enumerable: false,
    get() {
      // console.log("retard", this);
      return null;
    },
    set(value) {
      if ("isServer" in this) {
        if (value === null) return;
        // so at this point value either null or the controls class
        // once its set to the class, unhook global and fire events , until then just stay put
        delete Object.prototype.controls;
        this.controls = value;
        game = this;
        // need to hook config IMMEDIATELY (for sandbox)
        gameConfig = this.config;
        defineProperty(this, "config", {
          get() {
            return gameConfig;
          },
          set(config: Game["config"]) {
            gameConfig = config;

            let realThirdPerson = config.thirdPerson;

            defineProperty(config, "thirdPerson", {
              get() {
                return sketchConfig.get("thirdPerson") || realThirdPerson;
              },
              set(value) {
                realThirdPerson = value;
              },
            });
          },
        });
        doGameHooks();
      } else {
        defineProperty(this, "controls", {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    },
  });

  return () => {
    delete Object.prototype.controls;
    delete Object.prototype.render;
  };
});

let game: Game | undefined;

export function getGame() {
  if (!game) throw new Error("Too early");
  return game;
}

/**
 * When the result of the hook is false, inputs will be blocked
 */
export const inputHooks: ((inputs: number[]) => boolean | void)[] = [];

let blockedInputs = false;

// in-game player, not menu player
let localPlayer: Player | undefined;

export function getLocalPlayer() {
  if (!localPlayer) throw new Error("Too early");
  return localPlayer;
}

export const onGameHooks: (() => void)[] = [];

function doGameHooks() {
  const game = getGame();

  const { add } = getGame().players;

  console.trace("hooker");
  for (const hook of onGameHooks) hook();

  game.players.add = function (...args) {
    const player = add.call(this, ...args);

    if (player.isYou) {
      localPlayer = player;
    }

    const { procInputs } = player;

    player.procInputs = function (...args) {
      if (blockedInputs) {
        if (getGame().isSandbox) blockedInputs = false;
        return;
      }
      return procInputs.call(this, ...args);
    };

    return player;
  };

  const tmpInptsPush = game.controls.tmpInpts.push;

  /*
  Order of calls:

  tmpInpts.push()
  player.procInputs()
  io.send('q')
  */

  game.controls.tmpInpts.push = function (inputs) {
    if (localPlayer) for (const hook of inputHooks) hook(inputs);
    // if (hook(inputs) === false) {
    //   blockedInputs = true;
    //   return 0;
    // }

    return tmpInptsPush.call(this, inputs);
  };

  // ioSendHooks.push((packet) => {
  //   if (packet === "q" && blockedInputs) {
  //     blockedInputs = false;
  //     return false;
  //   }
  // });

  const mapObjectsPush = game.map.manager.objects.push;

  game.map.manager.objects.push = function (obj) {
    let trans = obj.transparent;
    defineProperty(obj, "transparent", {
      get(this: MapObject) {
        if (sketchConfig.get("wallbangs")) return this.penetrable ? 1 : 0;
        return trans;
      },
      set(this: MapObject, value) {
        trans = value;
      },
    });

    return mapObjectsPush.call(this, obj);
  };
}

let gameConfig: Game["config"] | undefined;

export function getGameConfig() {
  if (!gameConfig) throw new Error("Too early");
  return gameConfig;
}

beforeGame.push(() => {
  defineProperty(Object.prototype, "bundleMedalFilters", {
    enumerable: false,
    configurable: true,
    set(value) {
      if (!("tmp" in this))
        return defineProperty(this, "bundleMedalFilters", {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      delete Object.prototype.bundleMedalFilters;
      this.bundleMedalFilters = value;

      // force the game to calculate FPS if the watermark is enabled
      // this works because the game hides the FPS element even if this code is ran
      let { showFPS } = this.tmp;
      defineProperty(this.tmp, "showFPS", {
        get: () => sketchConfig.get("watermark") || showFPS,
        set: (v) => {
          showFPS = v;
        },
      });
    },
  });

  return () => delete Object.prototype.bundleMedalFilters;
});

patches.GetMenuPlayer = [
  /(\w+)\.init\(0,0,0,"preview",!1\),/,
  (match, menuPlayer) => match + `${dataArg}.molestMenuPlayer(${menuPlayer}),`,
];

data.molestMenuPlayer = function (player: any) {
  menuPlayer = player;
  return menuPlayer;
};

/**
 * player created while in the menu
 * basically local player but it never spawns
 * and it's not the localPlayer
 * menuPlayer can be undefined when the player isn't signed in
 */
let menuPlayer: Player | undefined;

export function getMenuPlayer() {
  return menuPlayer;
}

// hook helper func that returns the list of skins that the target plr has
// function helper(player, unkown)
// returns {ind:number,cnt:number}[]
// used for ui to list owned items

patches.UISkins = [
  /((\w+)\.isDev\?\w+:)(\2\?\2\.skins:\[\])/,
  (match, crap, player, skinArray) => crap + `${dataArg}.uiSkins(${skinArray})`,
];

// force the loadout menu to render "owned" skins, even logged out
// so schizo..
patches.ForceLoadout = [
  /(\w+)&&(\(\w+\[\w+\.loadout\[0\]\]!=null)/,
  (match, player, crap) => `(${dataArg}.skinHack||${player})&&${crap}`,
];

// now do customize...
patches.Skins = [
  /(\(\w+)\|\|(_.store\.skins)/,
  (match, con1, con2) => `${con1}||${dataArg}.skinHack||${con2}`,
];

// NOW SKIN tone chicken bone
// (ee && ee.premiumT > 0 ? "<input class='skinColorItem
patches.PremiumSkinColors = [
  /(\((\w+)&&\2.premiumT>0)\?("<input class='skinColorItem)/g,
  (match, con1, player, out1) => `${con1}||${dataArg}.skinHack?${out1}`,
];

// bypass premium check for skinz
//:3
patches.PremiumSkins = [
  /((\w+)&&\2.premiumT>0);(_\.isSandbox)/,
  (match, condition, player, crap) =>
    `${dataArg}.skinHack||${condition};` + crap,
];

patches["𝓯𝓻𝓮𝓪𝓴𝔂 𝓼𝓹𝓻𝓪𝔂"] = [
  /(\w+)\.isSandbox\?(\w+)\.players\.spray\((.*?)\):(\w+)\.send/g,
  (match, gameVar, dumbGameVar, sprayArgs, ioVar) =>
    `${gameVar}.isSandbox?${dumbGameVar}.players.spray(${sprayArgs}):${dataArg}.skinHack?${dataArg}.spraySemen(${sprayArgs}):${ioVar}.send`,
];

// game checks for premium on press and release
patches["skin picker wheel"] = [
  /sprayWheel\.isKey\(\w+\)&&\(\w+\.isSandbox\|\|/g,
  (match) => match + `${dataArg}.skinHack||`,
];

patches.ChangeGender = [
  /this.isServer&&\((\w+)\.broadcast\("sp",/,
  (match, ioVar) =>
    `(${dataArg}.BroadcastTheFuckingShitLikeAGoodBoy(this.isServer,${ioVar},`,
];

let box: KrunkBox | undefined;

export function getBox() {
  if (!box) throw new Error("Too early");
  return box;
}

// https://convertcase.net/unicode-text-converter/

//
patches["🦁𝓣𝓱𝓮 𝓛𝓲𝓸𝓷 𝓡𝓪𝓹𝓮𝓼 𝓽𝓱𝓮 𝓢𝓶𝓪𝓵𝓵 𝓓𝓸𝓰 𝓦𝓱𝓮𝓷 𝓘𝓽 𝓑𝓪𝓻𝓴𝓼"] = [
  /if\((\w+)\.isSandbox\|\|(\w+)\.account&&\2\.account\.premiumT>0\)\{var (\w+)=/,
  (match, gameVar, accVar, skinFreeVar) =>
    `if(${dataArg}.skinHack||${gameVar}.isSandbox||${accVar}.account&&${accVar}.account.premiumT>0){var ${skinFreeVar}=${dataArg}.skinHack||`,
];

/* javascript-obfuscator:enable */

export const hook = (ebox: KrunkBox, src: string) => {
  box = ebox;

  for (const name in patches) {
    const patch = patches[name];
    let ran = false;
    src = src.replace(patch[0], (...args) => {
      ran = true;
      return patch[1](...args);
    });
    //if (isDevelopment)
    console.log("patching", name, "worked:", ran);
  }

  return {
    dataArg,
    data,
    src,
  };
};

if (isDevelopment) {
  console.trace("DEV");

  Object.assign(getExposedWindow(), {
    getGame,
    getRender,
    getLocalPlayer,
    getMenuPlayer,
    getOverlay,
    getConfig,
    getGameConfig,
    // getIO,
  });
}
