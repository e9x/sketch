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
import type * as IO from "./krunker/io";

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
      ent.z,
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

let io: typeof IO | undefined;

export function getIO() {
  if (!io) throw new Error("Too early");
  return io;
}

export const onIoHooks: ((socket: WebSocket) => void)[] = [];

export const data: Record<string, any> = {
  socket(t: typeof IO, prop: string | number, arg: string | URL) {
    io = t;
    const ws = new WebSocket(arg);
    // console.log({ io, ws, prop, arg });
    for (const hook of onIoHooks) hook(ws);
    // @ts-ignore
    t[prop] = ws;
    return ws;
  },
};

export const patches: Record<
  string,
  [
    match: RegExp | string,
    replacer: (substring: string, ...args: any[]) => string,
  ]
> = {};

export const dataArg = "_" + Math.random().toString(36).slice(2);

const v = /(?<![a-zA-Z0-9_])[iIìíîïÌÍÎÏ]+(?![a-zA-Z0-9_])/;

patches.io = [
  new RegExp(
    `(this|${v.source})\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=new WebSocket\\((${v.source})\\)`,
  ),
  (_, target, prop, arg) => `${dataArg}.socket(${target}, ${prop}, ${arg})`,
];

const fr = Object.freeze;
data.object = Object.create(Object);
data.object.freeze = mirrorAttributes(
  function freeze(o: any) {
    if (o && "gameVersion" in o) {
      config = o;
    }
    return fr(o);
  } as typeof Object.freeze,
  fr,
);

patches.freeze = [/Object\[/g, () => `${dataArg}.object[`];

// patches.lol = [new RegExp(`this\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=new WebSocket\\(`), (_, prop) => `this[${prop}] = ${dataArg}.socket = new WebSocket(`];

// patches.UseStrict = [/"use strict";/, () => ""];

/* javascript-obfuscator:disable */

// called before game init: get ya hooks in
export const beforeGame: (() => void)[] = [];
// called after game init: pull out!
export const afterGame: (() => void)[] = [];

beforeGame.push(() => {
  // hide our IDB database from indexedDB.databases()
  const ogDatabases = indexedDB.databases;
  indexedDB.databases = mirrorAttributes(
    async function databases(this: any) {
      const dbs = await ogDatabases.call(this);
      return dbs.filter((db) => db.name !== "TwTglensargent");
    } as typeof indexedDB.databases,
    ogDatabases,
  );

  const { getItem, setItem } = Storage.prototype;
  Storage.prototype.getItem = mirrorAttributes(function (
    this: Storage,
    key: string,
  ) {
    // catch fingerprinting crap
    let value = getItem.call(this, key);
    //console.log([key, value]);
    if (key === "conUID_") {
      // console.log("conUID blocked 👀");
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
    value: string,
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
      // console.log("conUID blocked 👀");
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
    gameState: any;
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
        if (isDevelopment) console.log("HOOK: render manager captured", Object.keys(this));
        render = this;
        doRenderHooks();
      }
      if ("medalsList" in this) {
        if (isDevelopment) console.log("HOOK: overlay captured", Object.keys(this));
        overlay = this;
        doOverlayHooks();
      }
    },
  });

  afterGame.push(() => delete Object.prototype.render);

  // Hook gameState (pos 101/103 in ctor) to capture the game object near end of construction
  defineProperty(Object.prototype, "gameState", {
    configurable: true,
    enumerable: false,
    set(value) {
      defineProperty(this, "gameState", {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });

      if ("players" in this && "isServer" in this) {
        if (isDevelopment) console.log("HOOK: game object captured via gameState", Object.keys(this));
        game = this;
        // defer so methods (canSee, broadcast, etc.) are assigned after properties
        Promise.resolve().then(doGameHooks);
      }
    },
  });

  afterGame.push(() => delete Object.prototype.gameState);
});

function doOverlayHooks() {
  if (isDevelopment) console.log("HOOK: setting up overlay render hooks");
  const overlay = getOverlay();
  const renderFn = overlay.render;

  overlay.render = mirrorAttributes(
    function (this: any, ...args: any[]) {
      if (localPlayer) for (const hook of preOverlayRenderHooks) hook();
      const result = renderFn.call(this, ...args);
      if (localPlayer) for (const hook of overlayRenderHooks) hook();
      return result;
    } as typeof renderFn,
    renderFn,
  );
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
    if (isDevelopment) console.error(e);
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
  if (isDevelopment) console.log("HOOK: setting up render hooks");
  const render = getRender();
  const { init } = render;

  // <patched, og>
  const maps = new WeakMap<any, any>();

  render.init = mirrorAttributes(
    function (this: any, config: any, mode: any, idk1: any, idk2: any) {
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
    } as typeof init,
    init,
  );

  let lastThirdPerson: boolean | undefined;
  let skyConf = ["mapOverrides", "mapOverridesCode", "skyColor", "skyColorHex"];
  sketchConfig.configTarget.addEventListener("change", (e) => {
    if (typeof e.configKey === "string" && skyConf.includes(e.configKey))
      redrawSky();
  });

  const renderFn = render.render;
  // we hook the render way too early
  render.render = mirrorAttributes(
    function (this: any, ...args: any[]) {
      if (game) {
        for (const player of game.players.list) delete player[canSee];
        for (const ai of game.AI.ais) delete ai[canSee];

        if (localPlayer) {
          for (const hook of preRenderHooks) hook();

          if (game.config.thirdPerson !== lastThirdPerson) {
            try {
              game.players.regenMeshes(getLocalPlayer());
              lastThirdPerson = game.config.thirdPerson;
            } catch {}
          }
        }
      }

      const result = renderFn.call(this, ...args);
      // if (localPlayer) for (const hook of gameRenderHooks) hook();
      return result;
    } as typeof renderFn,
    renderFn,
  );

  // toggle clouds
  defineProperty(render, "loadTexture", {
    configurable: true,
    set(value: RenderManager["loadTexture"]) {
      delete (render as any).loadTexture;

      render.loadTexture = mirrorAttributes(
        function (this: any, mat: any, id: any, data: any, crap: any) {
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
        } as typeof value,
        value,
      );
    },
  });

  const threeRenderFn = render.renderer.render;
  render.renderer.render = mirrorAttributes(
    function (this: any, scene: any, camera: any) {
      if (camera === render.camera) {
        render.scene.background = getTech();
        let ret = threeRenderFn.call(this, scene, camera);
        render.scene.background = null;
        return ret;
      }
      return threeRenderFn.call(this, scene, camera);
    } as typeof threeRenderFn,
    threeRenderFn,
  );

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
      render.add = mirrorAttributes(
        function (this: any, mesh: any, data: any) {
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
        } as typeof value,
        value,
      );
    },
  });
}

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
  if (isDevelopment) console.log("HOOK: setting up game hooks", Object.keys(getGame()));
  const game = getGame();

  for (const attach of game.attach) {
    if (!(hookAttach in attach)) {
      const { req } = attach;
      //console.log({ req });
      const hooked = (player: any, game: any) => {
        return (
          sketchConfig.get("skinHack") ||
          typeof req !== "function" ||
          req(player, game)
        );
      };
      attach.req =
        typeof req === "function" ? mirrorAttributes(hooked, req) : hooked;
      attach[hookAttach] = true;
    }
  }

  if (isDevelopment) console.log("HOOK: game.attach hooked", game.attach.length, "attachments");

  ogCanSee = game.canSee;

  // cansee determines whether to show nametags
  if (isDevelopment) console.log("HOOK: game.canSee hooked");
  game.canSee = mirrorAttributes(
    function (this: any, ...args: Parameters<Game["canSee"]>) {
      if (sketchConfig.get("newNametags")) return 1;
      if (sketchConfig.get("nametags")) return null;
      return ogCanSee!.call(this, ...args);
    } as typeof ogCanSee,
    ogCanSee!,
  );

  const { broadcast } = game;

  if (isDevelopment) console.log("HOOK: game.broadcast hooked");
  game.broadcast = mirrorAttributes(
    function (this: any, packet: any, ...data: any[]) {
      if (packet === "sp" && sprayingFakeServer && sketchConfig.get("skinHack"))
        game.addSpray(...data);
      else broadcast.call(this, packet, ...data);
    } as typeof broadcast,
    broadcast,
  );

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

  if (isDevelopment) console.log("HOOK: game.players.add hooked");
  game.players.add = mirrorAttributes(
    function (this: any, ...args: Parameters<typeof add>) {
      const player = add.call(this, ...args);

      if (player.isYou) localPlayer = player;

      return player;
    } as typeof add,
    add,
  );

  const tmpInptsPush = game.controls.tmpInpts.push;

  /*
  Order of calls:

  tmpInpts.push()
  player.procInputs()
  io.send('q')
  */

  if (isDevelopment) console.log("HOOK: game.controls.tmpInpts.push hooked");
  game.controls.tmpInpts.push = mirrorAttributes(
    function (this: any, inputs: any) {
      if (localPlayer) for (const hook of inputHooks) hook(inputs);
      return tmpInptsPush.call(this, inputs);
    } as typeof tmpInptsPush,
    tmpInptsPush,
  );

  const mapObjectsPush = game.map.manager.objects.push;

  if (isDevelopment) console.log("HOOK: game.map.manager.objects.push hooked");
  game.map.manager.objects.push = mirrorAttributes(
    function (this: any, obj: any) {
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
    } as typeof mapObjectsPush,
    mapObjectsPush,
  );
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
// let menuPlayer: Player | undefined;

// export function getMenuPlayer() {
//   return menuPlayer;
// }

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

/* javascript-obfuscator:enable */

export const hook: Hook = (
  src: string,
  ebox: KrunkBox,
  args: Record<string, any>,
) => {
  box = ebox;

  for (const name in patches) {
    const patch = patches[name];
    let ran = false;
    src = src.replace(patch[0], (...args) => {
      ran = true;
      return patch[1](...args);
    });
    if (isDevelopment) console.log("patching", name, "worked:", ran);
  }

  args[dataArg] = data;

  return src;
};

if (isDevelopment) {
  console.trace("DEV");

  Object.assign(getExposedWindow(), {
    getGame,
    getRender,
    getLocalPlayer,
    // getMenuPlayer,
    getOverlay,
    getConfig,
    getGameConfig,
    getIO,
  });
}
