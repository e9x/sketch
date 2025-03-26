import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObject from "./krunker/Object";
import { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as ioModule from "./krunker/io";
import type * as Overlay from "./krunker/overlay";
import sketchConfig from "./sketchConfig";
import type * as THREE from "three";
import { console, defineProperty } from "./crashout";
import { mirrorAttributes } from "./hook";
import type KrunkBox from "./KrunkBox";
import { MapData } from "./krunker/GameMap";

const { freeze } = Object;

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

patches["👀"] = [/getSavedVal\("conUID_"\)/g, () => "null"];

/* javascript-obfuscator:disable */

// called before game init: get ya hooks in
export const beforeGame: (() => void)[] = [];
// called after game init: pull out!
export const afterGame: (() => void)[] = [];

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
      console.log("game config:", config);
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

beforeGame.push(() => {
  defineProperty(Object.prototype, "render", {
    configurable: true,
    enumerable: false,
    set(value) {
      // console.log({ value });
      if (!("medalsList" in this))
        return Object.defineProperty(this, "render", {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });

      delete Object.prototype.render;
      this.render = value;
      console.log("we render c:", this);
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

// patches.GetOverlay = [
//   /,(\w+)\.medalsList=\[/,
//   (match, module) => `,${dataArg}.overlay(${module}).medalsList=[`,
// ];
// data.overlay = function (module: any) {
//   overlay = module;
//   doOverlayHooks();
//   return module;
// };

// hook routine to define class getters/setters on constructor

// easier to patch like this:
// patches.GetIO = [
//   /(\w+)={ahNum:0,.*?this\.captchaHolder=null\)\}\};/,
//   (match, ioVar) => `${match}${dataArg}.molestIO(${ioVar});`,
// ];

// data.molestIO = function (lol: any) {
//   io = lol;
//   doIOHooks();
// };

/**
 * When the result of the hook is false, the packet won't be sent
 */
// export const ioSendHooks: ((packet: string, data: any) => boolean | void)[] =
//   [];

/**
 * When the result of the hook is false, the packet won't be propagated to the game
 */
// export const ioDispatchHooks: ((
//   packet: string,
//   data: any
// ) => boolean | void)[] = [];

// let io: typeof ioModule | undefined;

// export function getIO() {
//   if (!io) throw new Error("Too early");
//   return io;
// }

// function doIOHooks() {
//   const { send, _dispatchEvent } = getIO();

//   getIO().send = function (packet, ...data) {
//     for (const hook of ioSendHooks) if (hook(packet, data) === false) return;
//     return send.call(this, packet, ...data);
//   };

//   getIO()._dispatchEvent = function (packet, ...data) {
//     for (const hook of ioDispatchHooks)
//       if (hook(packet, data) === false) return;
//     return _dispatchEvent.call(this, packet, ...data);
//   };
// }

/*
patches.GetRender = [
  /=(\w+)\.THREE,(\w+=window\.SOUND=)/,
  (match, RenderManager, crap) =>
    `=(${dataArg}.molestRender(${RenderManager})).THREE,` + crap,
];

data.molestRender = function (module: RenderManager) {
  render = module;
  doRenderHooks();
  return render;
};
*/

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

const rgbSky = () =>
  ({
    skyDome: false,
    sky: parseInt(sketchConfig.get("skyColorHex").slice(1), 16),
  }) as MapData;

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
  const renderFn = render.render;

  render.render = function (...args) {
    if (localPlayer) for (const hook of preRenderHooks) hook();
    const result = renderFn.call(this, ...args);
    if (localPlayer) for (const hook of renderHooks) hook();
    return result;
  };

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
    if (sketchConfig.get("skyColor")) Object.assign(nConfig, rgbSky());
    maps.set(nConfig, config);

    init.call(this, nConfig, mode, idk1, idk2);
  };

  // Object.defineProperty(render, "skyDome", {
  //   set(value: THREE.Object3D) {
  //     // remove descriptor
  //     delete (render as any).skyDome;
  //     render.skyDome = value;

  //     let { visible } = value;

  //     Object.defineProperty(value, "visible", {
  //       get: () => (sketchConfig.get("skyColor") ? false : visible),
  //       set: (v) => (visible = v),
  //     });
  //   },
  //   configurable: true,
  // });

  const genericAdsArray = [...Array(64)].fill(0);
  let ogAds = render.adsFov;
  Object.defineProperty(render, "adsFov", {
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
      if (!("clearSkyDome" in this))
        return Object.defineProperty(this, "skyDomeInit", {
          configurable: true,
          enumerable: true,
          value,
        });

      console.log("thy render is", this);
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
        Object.defineProperty(this, "config", {
          get() {
            return gameConfig;
          },
          set(config: Game["config"]) {
            gameConfig = config;

            let realThirdPerson = config.thirdPerson;

            Object.defineProperty(config, "thirdPerson", {
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
        Object.defineProperty(this, "controls", {
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
    delete Object.prototype.skyDomeInit;
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
    Object.defineProperty(obj, "transparent", {
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
  Object.defineProperty(Object.prototype, "bundleMedalFilters", {
    enumerable: false,
    configurable: true,
    set(value) {
      if (!("tmp" in this))
        return Object.defineProperty(this, "bundleMedalFilters", {
          configurable: true,
          enumerable: true,
          value,
        });
      delete Object.prototype.bundleMedalFilters;
      this.bundleMedalFilters = value;

      // force the game to calculate FPS if the watermark is enabled
      // this works because the game hides the FPS element even if this code is ran
      let { showFPS } = this.tmp;
      Object.defineProperty(this.tmp, "showFPS", {
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

// before .init()
// game.players.add()
// before skin/hat properties are set
// patches.HookPlayer = [
//   /(\(\w+=new \w+\(\w+,this,\w+\)\))(\.sid=\w+)/,
//   (match, newGamePlayer, shit) =>
//     `${dataArg}.molestNewGamePlayer(${newGamePlayer})` + shit,
// ];

// export const newGamePlayerHooks: ((player: Player) => void)[] = [];

// data.molestNewGamePlayer = function (player: any) {
//   for (const hook of newGamePlayerHooks) hook(player);

//   return player;
// };

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
  data.fent = box.slop.bind(box);

  // ssssh
  src = src.replace(
    /\w+=new \w+\((\w+),(\w+),null\),saveVal\("krunker_id",\1\),/,
    (match, username, id) => match + `${dataArg}.fent(${username},${id}),`
  );

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
