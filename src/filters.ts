import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObject from "./krunker/Object";
import { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as Overlay from "./krunker/overlay";
import sketchConfig, { skyboxes } from "./sketchConfig";
import { console, defineProperty } from "./crashout";
import { hookContext, mirrorAttributes } from "./hook";
import type KrunkBox from "./KrunkBox";
import type * as THREE from "three";
import type { MapData } from "./krunker/GameMap";
import type { Hook } from "./inject";
import { AI } from "./krunker/AI";
import type * as IO from "./krunker/io";
import { waitFor } from "./util";

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
    if (isDevelopment) console.log("[sketch] data.socket called:", { target: typeof t, prop, url: String(arg) });
    io = t;
    // Page-realm constructor: frames must be page-realm ArrayBuffers or msgpack decoding fails
    const ws = new (getExposedWindow().WebSocket)(arg);
    if (isDevelopment) {
      ws.addEventListener("open", () => console.log("[sketch] ws open"));
      ws.addEventListener("error", (e) => console.error("[sketch] ws error", e));
      ws.addEventListener("close", (e) =>
        console.error("[sketch] ws close", {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        }),
      );
    }
    // console.log({ io, ws, prop, arg });
    for (const hook of onIoHooks) hook(ws);
    // @ts-ignore
    t[prop] = ws;
    return ws;
  },

  /**
   * Game constructor capture. The patch site is mid-constructor, so `attach`
   * and `players` don't exist yet -- defer the hooks until it's actually built.
   */
  captureGame(g: Game) {
    if (game) return g;
    game = g;
    if (isDevelopment) console.log("[sketch] captured game");

    // Runs mid-constructor: anything thrown here aborts Game's boot, and the
    // game swallows it, so the only symptom is a later "socket error".
    try {
      if (isDevelopment) {
        const w = getExposedWindow();
        w.addEventListener("error", (e) =>
          console.error("[sketch] uncaught:", e.message, e.filename, e.lineno),
        );
        w.addEventListener("unhandledrejection", (e) =>
          console.error("[sketch] unhandled rejection:", e.reason),
        );
      }

      waitFor(
        () =>
          game &&
          (game as any).attach &&
          (game as any).players &&
          (game as any).controls &&
          (game as any).map,
        50,
        30e3,
      ).then(
        () => {
          try {
            doGameHooks();
          } catch (e) {
            if (isDevelopment) console.error("[sketch] doGameHooks failed:", e);
          }
        },
        (e) => {
          if (isDevelopment) console.error("[sketch] waitFor game failed:", e);
        },
      );
    } catch (e) {
      if (isDevelopment) console.error("[sketch] captureGame failed:", e);
    }

    return g;
  },

  /** render.sceneInit -> this.skyDomeInit(config); `this` is the RenderManager */
  captureRender(r: RenderManager) {
    if (render) return r;
    render = r;
    if (isDevelopment) console.log("[sketch] captured render");

    // Captured mid-sceneInit, so scene/camera/renderer don't exist yet and the
    // render wrapper reads game.players every frame.
    try {
      waitFor(
        () =>
          render &&
          (render as any).scene &&
          (render as any).camera &&
          (render as any).renderer &&
          game &&
          (game as any).players,
        50,
        30e3,
      ).then(
        () => {
          try {
            doRenderHooks();
            if (isDevelopment) console.log("[sketch] render hooks installed");
          } catch (e) {
            if (isDevelopment) console.error("[sketch] doRenderHooks failed:", e);
          }
        },
        (e) => {
          if (isDevelopment) console.error("[sketch] waitFor render failed:", e);
        },
      );
    } catch (e) {
      if (isDevelopment) console.error("[sketch] captureRender failed:", e);
    }

    return r;
  },

  /** overlay module init -> overlay.hideNames */
  captureOverlay(o: typeof Overlay) {
    if (overlay) return o;
    overlay = o;
    if (isDevelopment) console.log("[sketch] captured overlay");

    // hideNames is assigned ~640 lines before overlay.render. Wrapping now
    // would close over undefined and then be overwritten by the game's own
    // render assignment, so the overlay hooks would never run.
    try {
      waitFor(
        () => overlay && typeof (overlay as any).render === "function",
        50,
        30e3,
      ).then(
        () => {
          try {
            doOverlayHooks();
            if (isDevelopment) console.log("[sketch] overlay hooks installed");
          } catch (e) {
            if (isDevelopment)
              console.error("[sketch] doOverlayHooks failed:", e);
          }
        },
        (e) => {
          if (isDevelopment)
            console.error("[sketch] waitFor overlay failed:", e);
        },
      );
    } catch (e) {
      if (isDevelopment) console.error("[sketch] captureOverlay failed:", e);
    }

    return o;
  },

  /** SETTINGS constructor -> this['tmp']={},this['bundleMedalFilters']=... */
  captureSettings(s: Settings) {
    if (settings) return s;
    settings = s;
    if (isDevelopment) console.log("[sketch] captured settings");

    // Runs mid-constructor, so a throw here would abort SETTINGS' boot.
    try {
      doSettingsHooks();
    } catch (e) {
      if (isDevelopment) console.error("[sketch] doSettingsHooks failed:", e);
    }
    return s;
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

// Game constructor. The Players constructor also assigns this['isServer'], but
// that one is followed by this['liveObjects'], so anchoring on this['isClient']
// uniquely selects Game. Capture inside the existing comma chain.
patches.game = [
  new RegExp(`this\\['isServer'\\]=!!(${v.source}),this\\['isClient'\\]`),
  (_: string, arg: string) =>
    `this['isServer']=!!${arg},${dataArg}.captureGame(this),this['isClient']`,
];

// Render manager constructor: `,this['clearSkyDome']=function(){...}`, a method
// definition inside the constructor's comma chain, so it runs unconditionally at
// module init. The old skyDomeInit call site was gated on the map having a
// skyDome and no skyCol override, so it fired late or never. 'clearSkyDome' has
// exactly one literal occurrence outside the obfuscator string array.
patches.render = [
  new RegExp(`,this\\['clearSkyDome'\\]=function\\(\\)`),
  () => `,${dataArg}.captureRender(this),this['clearSkyDome']=function()`,
];

// Overlay module init chain: `<overlay>[..]=null,<overlay>['hideNames']=!0x1,`.
// Unconditional at module init, unlike the old updateMedalIcon anchor, which
// only ran on medal-icon update and so never fired. The other 'hideNames'
// literals are settings setters assigning a variable rather than !0x1, and the
// leading `]=null,` pins this to the init chain.
patches.overlay = [
  new RegExp(`\\]=null,(${v.source})\\['hideNames'\\]=!0x1,`),
  (_: string, target: string) =>
    `]=null,${dataArg}.captureOverlay(${target})['hideNames']=!0x1,`,
];

// SETTINGS constructor: `this['tmp']={},this['bundleMedalFilters']=function(){`.
// The self-alias assigned just before it (`<var>=this`) is what the filter body
// closes over, confirming `tmp` and `bundleMedalFilters` share one owner, so
// `this` here is SETTINGS. Exactly one literal occurrence in the source.
patches.settings = [
  new RegExp(
    `this\\['tmp'\\]=\\{\\},this\\['bundleMedalFilters'\\]=function\\(\\)`,
  ),
  () =>
    `this['tmp']={},${dataArg}.captureSettings(this),this['bundleMedalFilters']=function()`,
];

// patches.lol = [new RegExp(`this\\[(${v.source}\\(0x[0-9a-f]+\\))\\]=new WebSocket\\(`), (_, prop) => `this[${prop}] = ${dataArg}.socket = new WebSocket(`];

// patches.UseStrict = [/"use strict";/, () => ""];

/* javascript-obfuscator:disable */

// called before game init: get ya hooks in
export const beforeGame: (() => void)[] = [];
// called after game init: pull out!
export const afterGame: (() => void)[] = [];

let ranBeforeGame = false;

export function runBeforeGameOnce() {
  if (ranBeforeGame) return;
  ranBeforeGame = true;
  // Isolated so one failing hook can't skip the rest.
  for (const bg of beforeGame) {
    try {
      bg();
    } catch (e) {
      if (isDevelopment) console.error("[sketch] beforeGame hook failed:", e);
    }
  }
}

// Must run first: every mirrorAttributes spoof below is inert until
// Function.prototype.toString is hooked to read the functionStrings map.
beforeGame.push(() => {
  hookContext(getExposedWindow(), undefined, false);
});

beforeGame.push(() => {
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

type Settings = { tmp: Record<string, any>; bundleMedalFilters: () => void };

let settings: Settings | undefined;

export function getSettings() {
  if (!settings) throw new Error("Too early");
  return settings;
}

function doSettingsHooks() {
  const settings = getSettings();
  // `this['tmp']` was assigned `{}` immediately before our capture point, so
  // showFPS isn't set yet and the game's later write lands on the setter below.
  // The read covers the reverse order in case the anchor ever moves.
  let showFPS = settings.tmp?.showFPS;

  // Force the game to calculate FPS when the watermark is enabled. Safe because
  // the game still hides its own FPS element, so nothing extra becomes visible.
  defineProperty(settings.tmp, "showFPS", {
    enumerable: true,
    configurable: true,
    get: () => sketchConfig.get("watermark") || showFPS,
    set: (v) => {
      showFPS = v;
    },
  });
}

// NOTE: render/overlay used to be captured with an Object.prototype "render"
// accessor. That is unusable: the loader calls Object.preventExtensions on
// Object.prototype before the game source runs, and even when the trap did
// install (at document-start) the mere existence of an accessor named
// "render" hung the Emscripten loader, because every object then reports
// `'render' in obj === true`. Both are now captured via source patches
// (patches.render / patches.overlay) instead.

function doOverlayHooks() {
  const overlay = getOverlay();
  const renderFn = overlay.render;

  overlay.render = function (...args) {
    if (localPlayer) runHooks("preOverlayRenderHook", preOverlayRenderHooks);
    const result = renderFn.call(this, ...args);
    if (localPlayer) runHooks("overlayRenderHook", overlayRenderHooks);
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
      runHooks("preRenderHook", preRenderHooks);

      if (game.config.thirdPerson !== lastThirdPerson) {
        try {
          game.players.regenMeshes(getLocalPlayer());
          lastThirdPerson = game.config.thirdPerson;
        } catch {}
      }
    }

    const result = renderFn.call(this, ...args);
    // if (localPlayer) for (const hook of gameRenderHooks) hook();
    return result;
  };

  // toggle clouds
  const wrapLoadTexture = (
    value: RenderManager["loadTexture"],
  ): RenderManager["loadTexture"] =>
    function (this: any, mat, id, data, crap) {
      const ret = value.call(this, mat, id, data, crap);
      if (data.src === "clouds_0" || data.emissive === "#FFC980") {
        let visible = mat.visible;
        Object.defineProperty(mat, "visible", {
          get: () => (sketchConfig.get("hideClouds") ? false : visible),
          set: (v) => (visible = v),
        });
      }

      return ret;
    };

  // These hooks can run after the game already assigned the property, in which
  // case a write-only accessor would make every read return undefined.
  if (typeof (render as any).loadTexture === "function") {
    render.loadTexture = wrapLoadTexture(render.loadTexture);
  } else {
    defineProperty(render, "loadTexture", {
      configurable: true,
      set(value: RenderManager["loadTexture"]) {
        delete (render as any).loadTexture;
        render.loadTexture = wrapLoadTexture(value);
      },
    });
  }

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

  const hookNHide = /^clouds_|lightcone_/;
  const wrapAdd = (value: RenderManager["add"]): RenderManager["add"] =>
    function (this: any, mesh, data) {
      value.call(this, mesh, data);
      if (typeof data === "object" && hookNHide.test(data.src)) {
        let visible = mesh.visible;
        Object.defineProperty(mesh, "visible", {
          get: () => (sketchConfig.get("hideClouds") ? false : visible),
          set: (v) => (visible = v),
        });
      }
    };

  if (typeof (render as any).add === "function") {
    render.add = wrapAdd(render.add);
  } else {
    defineProperty(render, "add", {
      configurable: true,
      set(value: RenderManager["add"]) {
        delete (render as any).add;
        render.add = wrapAdd(value);
      },
    });
  }
}

// NOTE: game used to be captured with an Object.prototype "controls" accessor.
// Same failure mode as the "render" trap above -- see patches.game, which
// anchors on the Game constructor's this['isServer']/this['isClient'] pair.

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

const reportedHookErrors = new Set<string>();

// Per-frame hooks: log each distinct failure once instead of every frame.
function reportHookError(label: string, e: unknown) {
  if (!isDevelopment) return;
  const key = label + ":" + (e instanceof Error ? e.message : String(e));
  if (reportedHookErrors.has(key)) return;
  reportedHookErrors.add(key);
  console.error(`[sketch] ${label} failed:`, e);
}

function runHooks(label: string, hooks: Array<() => void>) {
  for (const hook of hooks) {
    try {
      hook();
    } catch (e) {
      reportHookError(label, e);
    }
  }
}

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

  gameConfig = game.config;

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

  runHooks("onGameHooks", onGameHooks);

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
    if (localPlayer)
      for (const hook of inputHooks) {
        try {
          hook(inputs);
        } catch (e) {
          reportHookError("inputHook", e);
        }
      }
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

// NOTE: showFPS used to be forced through an Object.prototype
// "bundleMedalFilters" setter trap. That could never install, because
// Object.prototype is already non-extensible by the time beforeGame runs, so it
// only ever logged a failure. SETTINGS is now captured directly via
// patches.settings and the accessor is installed in doSettingsHooks.

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

const fakeObj = function (this: any, a: any) {
  return Object.call(this, a);
};

const descs = Object.getOwnPropertyDescriptors(Object);

// descs.defineProperty.value = ((o: Player, k: string, a: PropertyDescriptor) => {
//   // console.log(o, k, a);
//   if (k === "isServer") {
//     const { get } = a;
//     a.get = function () {
//       return sprayingFakeServer || get!.call(this);
//     };
//   }

//   if (k === "inventory" && typeof o === "object" && o !== null && o.id === -1) {
//     console.log({a}, "got cll");
// debugger;
//     defineProperty(o, "init", {
//       configurable: true,
//       set: (init) => {
//         // console.trace("set init", init);
//         delete (o as any).init;
//         o.init = function (...args) {
//           const menuSig = [0, 0, 0, "preview", false];
//           if (menuSig.every((v, i) => args[i] === v)) {
//             // console.trace("IM THE MENU PLAYER");
//             menuPlayer = o;
//           }
//           return init.call(this, ...args);
//         };
//       },
//     });
//   }

//   return defineProperty(o, k, a);
// }) as any;

// console.log(descs);

const freeze = descs.freeze.value!;

descs.freeze.value = (o: any) => {
  if ("gameVersion" in o) {
    config = o;
  }
  return freeze(o);
};

const origPreventExt = descs.preventExtensions.value!;
descs.preventExtensions.value = (o: any) => {
  // Don't let game code lock down Object.prototype — we need it extensible for hooks
  try { if (o && o.constructor && o.constructor.prototype === o) return o; } catch {}
  return origPreventExt(o);
};

Object.defineProperties(fakeObj, descs);

/* javascript-obfuscator:enable */

export const hook: Hook = (
  src: string,
  ebox: KrunkBox,
  args: Record<string, any>,
) => {
  box = ebox;

  args.Object = fakeObj;

  for (const name in patches) {
    const patch = patches[name];
    let ran = false;
    src = src.replace(patch[0], (...args) => {
      ran = true;
      return patch[1](...args);
    });
    if (isDevelopment) console.log("[DEV] patching", name, "worked:", ran);
  }

  args[dataArg] = data;

  return src;
};

if (isDevelopment) {
  console.trace("[DEV]");

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
