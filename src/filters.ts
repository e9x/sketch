import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObject from "./krunker/Object";
import { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as Overlay from "./krunker/overlay";
import sketchConfig, { skyboxes } from "./sketchConfig";
import { console, defineProperty } from "./crashout";
import { mirrorAttributes } from "./hook";
import type KrunkBox from "./KrunkBox";
import type * as THREE from "three";
import type { MapData } from "./krunker/GameMap";
import type { Hook } from "./inject";
import { AI } from "./krunker/AI";

const canSee = Symbol();
let checkingCanSee = false;

export function canISeeEnt(ent: Player | AI) {
  if (canSee in ent) return ent[canSee];
  const game = getGame();
  const localPlayer = getLocalPlayer();

  checkingCanSee = true;
  const s =
    ogCanSee!.call(
      game,
      window.spectating && game.controls.spect.target
        ? game.controls.spect.target
        : localPlayer,
      ent.x,
      ent.y,
      ent.z
    ) === null;
  checkingCanSee = false;
  ent[canSee] = s;
  return s;
}

declare module "./krunker/Player" {
  interface Player {
    [canSee]?: boolean;
  }
}

declare module "./krunker/AI" {
  interface AI {
    [canSee]?: boolean;
  }
}

// export const data: any[] & Record<string, any> = [];
// export const data: Record<string, any> = {};

// export const patches: Record<
//   string,
//   [
//     match: RegExp | string,
//     replacer: (substring: string, ...args: any[]) => string,
//   ]
// > = {};

// export const dataArg = "_" + Math.random().toString(36).slice(2);

// patches.UseStrict = [/"use strict";/, () => ""];

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
    //console.log([key, value]);
    if (key === "conUID_") {
      console.log("conUID blocked 👀");
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
      defineProperty(this, "render", {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });

      if ("skyDomeInit" in this) {
        console.log("RENDER: render");
        render = this;
        doRenderHooks();
      }
      if ("medalsList" in this) {
        overlay = this;
        doOverlayHooks();
      }
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

// this exists for hooking some rendering methods for stuff like skyboxes
export const renderObjHooks: (() => void)[] = [];

/**
 * After the 3D game is rendered
 * 2x faster than overlayRenderHooks
 * Used for THREE.js
 */
// export const gameRenderHooks: (() => void)[] = [];
export const preRenderHooks: (() => void)[] = [];

let conf: MapData | undefined;

export function getActiveMap() {
  if (!conf) throw new Error("Too early");
  return conf;
}

export function redrawSky() {
  try {
    // trigger an update

    // getRender().renderer.setClearColor(getRealClearColor());
    const render = getRender();
    const game = getGame();
    if (!conf) return;
    //  console.warn("FUCK");
    const id = render.lastEnvId;
    render.lastEnvId = null;
    render.init(conf, game.mode, true);
    render.updateShadowMap();
    render.lastEnvId = id;
    render.updateLightMap(conf);
  } catch (e) {
    //
    console.error(e);
  }
}

const loadedSkyboxes: Record<string, THREE.Texture> = {};
function getTech() {
  const skybox = sketchConfig.get("skybox");
  if (skybox === "off") return null;
  const s = skyboxes[skybox];
  if (!s) return null;
  let tech = loadedSkyboxes[skybox];
  if (!tech) {
    // 'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'
    const render = getRender();
    const THREE = render.THREE;
    const textureLoader = new THREE.CubeTextureLoader();
    tech = textureLoader.load(s.faces);
    loadedSkyboxes[skybox] = tech;
  }
  return tech;
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

    conf = config;
    nConfig = { ...config };
    if (sketchConfig.get("mapOverrides"))
      Object.assign(nConfig, sketchConfig.get("mapOverridesCode"));
    if (sketchConfig.get("skyColor"))
      Object.assign(nConfig, {
        skyDome: false,
        sky: sketchConfig.get("skyColorHex"),
      });
    maps.set(nConfig, config);

    // console.log("map config:", [nConfig]);

    init.call(this, nConfig, mode, idk1, idk2);
  };

  let lastThirdPerson: boolean | undefined;
  let skyConf = ["mapOverrides", "mapOverridesCode", "skyColor", "skyColorHex"];
  sketchConfig.configTarget.addEventListener("change", (e) => {
    if (typeof e.configKey === "string" && skyConf.includes(e.configKey))
      redrawSky();
  });

  const renderFn = render.render;
  // we hook the render way too early
  render.render = function (...args) {
   const game = getGame();
    for (const player of game.players.list) delete player[canSee];
    for (const ai of game.AI.ais) delete ai[canSee];

    if (localPlayer) {
      for (const hook of preRenderHooks) hook();

      if (game.config.thirdPerson !== lastThirdPerson) {
        try {
          game.players.regenMeshes(getLocalPlayer());
          lastThirdPerson = game.config.thirdPerson;
        } catch { }
      }
    }

    const result = renderFn.call(this, ...args);
    // if (localPlayer) for (const hook of gameRenderHooks) hook();
    return result;
  };

  // toggle clouds
  defineProperty(render, "loadTexture", {
    configurable: true,
    set(value: RenderManager["loadTexture"]) {
      delete (render as any).loadTexture;

      render.loadTexture = function (mat, id, data, crap) {
        const ret = value.call(this, mat, id, data, crap);
        // console.log("load tex", mat, id, data, crap);
        if (data.src === "clouds_0" || data.emissive === "#FFC980") {
          let visible = mat.visible;
          // console.log("got cloud", mat, id, data, crap);
          Object.defineProperty(mat, "visible", {
            get: () => (sketchConfig.get("hideClouds") ? false : visible),
            set: (v) => (visible = v),
          });
        }

        return ret;
      };
    },
  });

  const threeRenderFn = render.renderer.render;
  render.renderer.render = function (scene, camera) {
    if (camera === render.camera) {
      render.scene.background = getTech();
      let ret = threeRenderFn.call(this, scene, camera);
      render.scene.background = null;
      return ret;
    }
    return threeRenderFn.call(this, scene, camera);
  };

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

  //console.log(render, "LO!L!!");
  defineProperty(render, "add", {
    configurable: true,
    set(value: RenderManager["add"]) {
      delete (render as any).add;
      //console.log("add:", value);
      const hookNHide = /^clouds_|lightcone_/;
      render.add = function (mesh, data) {
        value.call(this, mesh, data);
        // console.log("The Fucking Object:", mesh, data);
        if (typeof data === "object" && hookNHide.test(data.src)) {
          let visible = mesh.visible;
          //console.log("got cloud", mesh, data);
          Object.defineProperty(mesh, "visible", {
            get: () => (sketchConfig.get("hideClouds") ? false : visible),
            set: (v) => (visible = v),
          });
        }
      };
    },
  });
}

beforeGame.push(() => {
  defineProperty(Object.prototype, "controls", {
    configurable: true,
    enumerable: false,
    get() {
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

  return () => delete Object.prototype.controls;
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

// in-game player, not menu player
let localPlayer: Player | undefined;

export function getLocalPlayer() {
  if (!localPlayer) throw new Error("Too early");
  return localPlayer;
}

export const onGameHooks: (() => void)[] = [];

let sprayingFakeServer = false;

let ogCanSee: Game["canSee"] | undefined;

const hookAttach = Symbol();

function doGameHooks() {
  const game = getGame();

  for (const attach of game.attach) {
    if (!(hookAttach in attach)) {
      const { req } = attach;
      //console.log({ req });
      attach.req = (player, game) => {
        return (
          sketchConfig.get("skinHack") ||
          typeof req !== "function" ||
          req(player, game)
        );
      };
      attach[hookAttach] = true;
    }
  }

  const { sprayPosition } = game.players;

  ogCanSee = game.canSee;

  // cansee determines whether to show nametags
  game.canSee = function (...args) {
    if (sketchConfig.get("newNametags")) return 1;
    if (sketchConfig.get("nametags")) return null;
    return ogCanSee!.call(this, ...args);
  };

  const { broadcast } = game;

  game.broadcast = function (packet, ...data) {
    if (packet === "sp" && sprayingFakeServer && sketchConfig.get("skinHack"))
      game.addSpray(...data);
    else broadcast.call(this, packet, ...data);
  };

  game.players.sprayPosition = function (...args) {
    sprayingFakeServer = true;
    sprayPosition.call(this, ...args);
    sprayingFakeServer = false;
  };

  let gameConfig = game.config;

  defineProperty(game, "config", {
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

  const { add } = getGame().players;

  for (const hook of onGameHooks) hook();

  game.players.add = function (...args) {
    const player = add.call(this, ...args);

    if (player.isYou) localPlayer = player;

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

    return tmpInptsPush.call(this, inputs);
  };

  const mapObjectsPush = game.map.manager.objects.push;

  game.map.manager.objects.push = function (obj) {
    let trans = obj.transparent;
    defineProperty(obj, "transparent", {
      get(this: MapObject) {
        if (sketchConfig.get("wallbangs") && checkingCanSee)
          return this.penetrable ? 1 : 0;
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

// patches.UISkins = [
//   /((\w+)\.isDev\?\w+:)(\2\?\2\.skins:\[\])/,
//   (match, crap, player, skinArray) => crap + `${dataArg}.uiSkins(${skinArray})`,
// ];

// force the loadout menu to render "owned" skins, even logged out
// so schizo..
// patches.ForceLoadout = [
//   /(\w+)&&(\(\w+\[\w+\.loadout\[0\]\]!=null)/,
//   (match, player, crap) => `(${dataArg}.skinHack||${player})&&${crap}`,
// ];

// now do customize...
// patches.Skins = [
//   /(\(\w+)\|\|(_.store\.skins)/,
//   (match, con1, con2) => `${con1}||${dataArg}.skinHack||${con2}`,
// ];

// NOW SKIN tone chicken bone
// (ee && ee.premiumT > 0 ? "<input class='skinColorItem
// patches.PremiumSkinColors = [
//   /(\((\w+)&&\2.premiumT>0)\?("<input class='skinColorItem)/g,
//   (match, con1, player, out1) => `${con1}||${dataArg}.skinHack?${out1}`,
// ];

// bypass premium check for skinz
//:3
// patches.PremiumSkins = [
//   /((\w+)&&\2.premiumT>0);(_\.isSandbox)/,
//   (match, condition, player, crap) =>
//     `${dataArg}.skinHack||${condition};` + crap,
// ];

// patches["𝓯𝓻𝓮𝓪𝓴𝔂 𝓼𝓹𝓻𝓪𝔂"] = [
//   /(\w+)\.isSandbox\?(\w+)\.players\.spray\((.*?)\):(\w+)\.send/g,
//   (match, gameVar, dumbGameVar, sprayArgs, ioVar) =>
//     `${gameVar}.isSandbox?${dumbGameVar}.players.spray(${sprayArgs}):${dataArg}.skinHack?${dataArg}.spraySemen(${sprayArgs}):${ioVar}.send`,
// ];

// game checks for premium on press and release
// patches["skin picker wheel"] = [
//   /sprayWheel\.isKey\(\w+\)&&\(\w+\.isSandbox\|\|/g,
//   (match) => match + `${dataArg}.skinHack||`,
// ];

let box: KrunkBox | undefined;

export function getBox() {
  if (!box) throw new Error("Too early");
  return box;
}

// https://convertcase.net/unicode-text-converter/

//
// patches["🦁𝓣𝓱𝓮 𝓛𝓲𝓸𝓷 𝓡𝓪𝓹𝓮𝓼 𝓽𝓱𝓮 𝓢𝓶𝓪𝓵𝓵 𝓓𝓸𝓰 𝓦𝓱𝓮𝓷 𝓘𝓽 𝓑𝓪𝓻𝓴𝓼"] = [
//   /if\((\w+)\.isSandbox\|\|(\w+)\.account&&\2\.account\.premiumT>0\)\{var (\w+)=/,
//   (match, gameVar, accVar, skinFreeVar) =>
//     `if(${dataArg}.skinHack||${gameVar}.isSandbox||${accVar}.account&&${accVar}.account.premiumT>0){var ${skinFreeVar}=${dataArg}.skinHack||`,
// ];

const fakeObj = function (this: any, a: any) {
  return Object.call(this, a);
};

const descs = Object.getOwnPropertyDescriptors(Object);

descs.defineProperty.value = ((o: Player, k: string, a: PropertyDescriptor) => {
  // console.log(o, k, a);
  if (k === "isServer") {
    const { get } = a;
    a.get = function () {
      return sprayingFakeServer || get!.call(this);
    };
  }

  if (k === "inventory" && typeof o === "object" && o !== null && o.id === -1) {
    defineProperty(o, "init", {
      configurable: true,
      set: (init) => {
        // console.trace("set init", init);
        delete (o as any).init;
        o.init = function (...args) {
          const menuSig = [0, 0, 0, "preview", false];
          if (menuSig.every((v, i) => args[i] === v)) {
            // console.trace("IM THE MENU PLAYER");
            menuPlayer = o;
          }
          return init.call(this, ...args);
        };
      },
    });
  }

  return defineProperty(o, k, a);
}) as any;

// console.log(descs);

const freeze = descs.freeze.value!;

descs.freeze.value = (o: any) => {
  if ("gameVersion" in o) {
    config = o;
    // console.log("game config:", config);
  }

  return freeze(o);
};

Object.defineProperties(fakeObj, descs);

/* javascript-obfuscator:enable */

export const hook: Hook = (
  src: string,
  ebox: KrunkBox,
  args: Record<string, any>
) => {
  box = ebox;

  args.Object = fakeObj;

  // for (const name in patches) {
  //   const patch = patches[name];
  //   let ran = false;
  //   src = src.replace(patch[0], (...args) => {
  //     ran = true;
  //     return patch[1](...args);
  //   });
  //   //if (isDevelopment)
  //   console.log("patching", name, "worked:", ran);
  // }

  // args[dataArg] = data;

  return src;
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
