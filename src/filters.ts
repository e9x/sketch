/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObjectModule from "./krunker/Object";
import type { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as ioModule from "./krunker/io";
import type * as Overlay from "./krunker/overlay";
import sketchConfig from "./sketchConfig";
import type * as THREE from "three";

const { freeze } = Object;

export const data: Record<string, any> = {};

export const hook = (dataArg: string, src: string) => {
  src = src.replace(/Object\.freeze/g, () => `${dataArg}.BrianMeidell`);

  src = src.replace(
    /,(\w+)\.medalsList=\[/,
    (match, module) => `,${dataArg}.overlay(${module}).medalsList=[`
  );

  // hook routine to define class getters/setters on constructor
  /*
  function je(e,a,t){return a&&V7(e.prototype,a),t&&V7(e,t),Object.defineProperty(e,"prototype",{writable:!1}),e}
  */

  /*src = src.replace(
    /function (\w+)\((\w+),(\w+),(\w+)\)\{return \3&&\w+\(\2\.prototype,\3\),t&&V7\(\2,\4\),Object\.defineProperty\(\2,"prototype",\{writable:!1\}\),\2\}/,
    (match, helperFnName) =>
      `function ${helperFnName}(a,b,c){const og = ${match}; return ${dataArg}.fieldHelper(og, a, b, c)}`
  );*/

  src = src.replace(
    /(\w+)={ahNum:0,.*?this\.captchaHolder=null\)\}\};/,
    (match, ioVar) => `${match}${dataArg}.molestIO(${ioVar});`
  );

  /*src = src.replace(
    /function (\w+)(\(\w+,\w+,\w+\)\{var \w+,\w+,\w+,\w+=this;this\.biggestY=)/,
    (match, Player, func) => {
      //console.trace("fuck", { Game, body });
      return `var ${Player}=${dataArg}.molestPlayer(Shitttt);function Shitttt${func}`;
    }
  );*/

  src = src.replace(
    /=(\w+)\.THREE,qt=window\.SOUND=/,
    (match, RenderManager) =>
      `=(${dataArg}.molestRender(${RenderManager})).THREE,qt=window.SOUND=`
  );

  src = src.replace(
    /function (\w+)\(((?:\w+,?)+)\)(\{Object\.defineProperty\(this,"isServer",{get:function)/,
    (match, Game, argsss, body) =>
      `var ${Game}=${dataArg}.molestGame(Fuck);function Fuck(${argsss})${body}`
  );

  src = src.replace(
    /function (\w+)\(\w+,\w+=null\)\{.*?this\.penetrable=/,
    (match, MapObject) => `${dataArg}.MapObject(${MapObject});${match}`
  );

  src = src.replace(
    /!(\w+)\.isYou&&\1\.objInstances\){if\(\1\.canBSeen\){/,
    (match, player) =>
      `!${player}.isYou&&${player}.objInstances){if(${player}.canBSeen||${dataArg}.nametags){`
  );

  // force the game to calculate FPS if the watermark is enabled
  // this works because the game hides the FPS element even if this code is ran
  src = src.replace(
    /if\((\w+)\.tmp\.showFPS\)\{for\(/,
    (match, settings) =>
      `if(${dataArg}.watermark||${settings}.tmp.showFPS){for(`
  );

  // *r.adsFov[r.getPlayerWeaponId(t)]
  src = src.replace(
    /\*(\w+)\.adsFov/g,
    (match, render) => `*(${dataArg}.noAdsFov?${dataArg}:${render}).adsFov`
  );

  src = src.replace(
    /(\w+)\.init\(0,0,0,"preview",!1\),/,
    (match, menuPlayer) => match + `${dataArg}.molestMenuPlayer(${menuPlayer}),`
  );

  // hook helper func that returns the list of skins that the target plr has
  // function helper(player, unkown)
  // returns {ind:number,cnt:number}[]
  // used for ui to list owned items

  src = src.replace(
    /((\w+)\.isDev\?\w+:)(\2\?\2\.skins:\[\])/,
    (match, crap, player, skinArray) =>
      crap + `${dataArg}.uiSkins(${skinArray})`
  );

  // before .init()
  // game.players.add()
  // before skin/hat properties are set
  src = src.replace(
    /(\(\w+=new \w+\(\w+,this,\w+\)\))(\.sid=\w+)/,
    (match, newGamePlayer, shit) =>
      `${dataArg}.molestNewGamePlayer(${newGamePlayer})` + shit
  );

  // force the loadout menu to render "owned" skins, even logged out
  // so schizo..
  src = src.replace(
    /(\w+)&&(\(\w+\[\w+\.loadout\[0\]\]!=null)/,
    (match, player, crap) => `(${dataArg}.skinHack||${player})&&${crap}`
  );

  // now do customize...
  src = src.replace(
    /(\(\w+)\|\|(_.store\.skins)/,
    (match, con1, con2) => `${con1}||${dataArg}.skinHack||${con2}`
  );

  // NOW SKIN tone chicken bone
  // (ee && ee.premiumT > 0 ? "<input class='skinColorItem
  src = src.replace(
    /(\((\w+)&&\2.premiumT>0)\?("<input class='skinColorItem)/g,
    (match, con1, player, out1) => `${con1}||${dataArg}.skinHack?${out1}`
  );

  // bypass premium check for skinz
  //:3
  src = src.replace(
    /((\w+)&&\2.premiumT>0);(_\.isSandbox)/,
    (match, condition, player, crap) =>
      `${dataArg}.skinHack||${condition};` + crap
  );

  const genericAdsArray = [...Array(64)].fill(0);

  /* javascript-obfuscator:disable */
  Object.assign(data, {
    molestIO(lol: any) {
      io = lol;
      doIOHooks();
    },
    molestNewGamePlayer(player: any) {
      for (const hook of newGamePlayerHooks) hook(player);
      return player;
    },
    molestMenuPlayer(player: any) {
      menuPlayer = player;
    },
    molestRender(module: RenderManager) {
      render = module;
      doRenderHooks();
      return render;
    },
    molestGame(module: typeof Game) {
      return hookGame(module);
    },
    MapObject(map: any) {
      MapObject = map;
      doMapObjectHooks();
      return module;
    },
    overlay(module: any) {
      overlay = module;
      doOverlayHooks();
      return module;
    },
    BrianMeidell(obj: any) {
      if ("gameVersion" in obj) config = obj;
      return freeze(obj);
    },
    get watermark() {
      return sketchConfig.get("watermark");
    },
    get noAdsFov() {
      return sketchConfig.get("noAdsFovMlt");
    },
    get adsFov() {
      try {
        const ads: number[] = [];

        ads[getRender().getPlayerWeaponId(getLocalPlayer())] = 0;

        return ads;
      } catch {
        return genericAdsArray;
      }
    },
    get nametags() {
      return sketchConfig.get("nametags");
    },
  });

  return {
    data,
    src,
  };
  /* javascript-obfuscator:enable */
};

let render: RenderManager | undefined;

export function getRender() {
  if (!render) throw new Error("Too early");
  return render;
}

let game: Game | undefined;

export function getGame() {
  if (!game) throw new Error("Too early");
  return game;
}

// in-game player, not menu player
let localPlayer: Player | undefined;

export function getLocalPlayer() {
  if (!localPlayer) throw new Error("Too early");
  return localPlayer;
}

/**
 * When the result of the hook is false, inputs will be blocked
 */
export const inputHooks: ((inputs: number[]) => boolean | void)[] = [];

let blockedInputs = false;

export const newGamePlayerHooks: ((player: Player) => void)[] = [];

export const addPlayerHooks: ((player: Player) => void)[] = [];

function doGameHooks() {
  const { add } = getGame().players;

  getGame().players.add = function (...args) {
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

    for (const hook of addPlayerHooks) {
      hook(player);
    }

    return player;
  };

  const { push } = getGame().controls.tmpInpts;

  /*
  Order of calls:

  tmpInpts.push()
  player.procInputs()
  io.send('q')
  */

  getGame().controls.tmpInpts.push = function (inputs) {
    if (localPlayer)
      for (const hook of inputHooks)
        if (hook(inputs) === false) {
          blockedInputs = true;
          return 0;
        }

    return push.call(this, inputs);
  };

  ioSendHooks.push((packet) => {
    if (packet === "q" && blockedInputs) {
      blockedInputs = false;
      return false;
    }
  });
}

/**
 * player created while in the menu
 * basically local player but it never spawns
 * and it's not the localPlayer
 *
 * menuPlayer can be undefined when the player isn't signed in
 */
let menuPlayer: Player | undefined;
export const menuPlayerHooks: (() => void)[] = [];

export function getMenuPlayer() {
  return menuPlayer;
}

/**
 * basically when menuPlayer is created
 */
export const playerConstructorHooks: ((player: Player) => void)[] = [];

function hookGame(value: typeof Game) {
  const Game = value;

  // @ts-ignore
  return function (this: Game, ...args: ConstructorParameters<typeof Game>) {
    // console.trace("Fuck", args, this);
    const result = Game.call(this, ...args);

    // new Game()
    // game.controls = ...
    // game.ui = ...

    // can be determined by comparing the arguments to new Game();
    // on sandbox, the game is created twice...
    // args[1] is actually 0. this might be a host ID?
    const isMainGame = typeof args[1] === "number";

    if (isMainGame) {
      // need to hook config IMMEDIATELY (for sandbox)
      let realConfig = this.config;

      Object.defineProperty(this, "config", {
        get() {
          return realConfig;
        },
        set(config: Game["config"]) {
          realConfig = config;

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

      // we have to wait for the properties to be assigned for other hooks
      setTimeout(() => {
        game = this;
        doGameHooks();
      });
    }

    return result;
  };
}

/**
 * After the overlay is rendered
 * 2x slower than renderHooks
 * Used for game UI overlay
 */
export const overlayRenderHooks: (() => void)[] = [];
export const preOverlayRenderHooks: (() => void)[] = [];

function doOverlayHooks() {
  const { render } = getOverlay();

  getOverlay().render = function (...args) {
    if (localPlayer) for (const hook of preOverlayRenderHooks) hook();
    const result = render.call(this, ...args);
    if (localPlayer) for (const hook of overlayRenderHooks) hook();
    return result;
  };
}

let overlay: typeof Overlay | undefined;

export function getOverlay() {
  if (!overlay) throw new Error("Too early");
  return overlay;
}

let MapObject: typeof MapObjectModule | undefined;

function doMapObjectHooks() {
  const transparentMap = new WeakMap<MapObjectModule, number | undefined>();
  Object.defineProperty(getMapObject().prototype, "transparent", {
    get(this: MapObjectModule) {
      if (sketchConfig.get("wallbangs")) return this.penetrable ? 1 : 0;
      return transparentMap.get(this);
    },
    set(this: MapObjectModule, value) {
      transparentMap.set(this, value);
    },
  });
}

export function getMapObject() {
  if (!MapObject) throw new Error("Too early");
  return MapObject;
}

/**
 * After the 3D game is rendered
 * 2x faster than overlayRenderHooks
 * Used for THREE.js
 */
export const renderHooks: (() => void)[] = [];
export const preRenderHooks: (() => void)[] = [];

let realClearColor: THREE.ColorRepresentation | undefined;

export function getRealClearColor() {
  if (!realClearColor) throw new Error("Too early");
  return realClearColor;
}

function doRenderHooks() {
  const { render } = getRender();

  getRender().render = function (...args) {
    if (localPlayer) for (const hook of preRenderHooks) hook();
    const result = render.call(this, ...args);
    if (localPlayer) for (const hook of renderHooks) hook();
    return result;
  };

  const renderer = getRender().renderer;

  Object.defineProperty(getRender(), "skyDome", {
    set(value: THREE.Object3D) {
      // remove descriptor
      delete (getRender() as any).skyDome;
      getRender().skyDome = value;

      let { visible } = value;

      Object.defineProperty(value, "visible", {
        get: () => (sketchConfig.get("skyColor") ? false : visible),
        set: (v) => (visible = v),
      });
    },
    configurable: true,
  });

  if (renderer) {
    const { setClearColor } = renderer;

    renderer.setClearColor = (color: any) => {
      realClearColor = color;
      setClearColor.call(
        renderer,
        sketchConfig.get("skyColor") ? sketchConfig.get("skyColorHex") : color
      );
    };
  }
}

let config: typeof configModule | undefined;

export function getConfig() {
  if (!config) throw new Error("Too early");
  return config;
}

/**
 * When the result of the hook is false, the packet won't be sent
 */
export const ioSendHooks: ((packet: string, data: any) => boolean | void)[] =
  [];

/**
 * When the result of the hook is false, the packet won't be propagated to the game
 */
export const ioDispatchHooks: ((
  packet: string,
  data: any
) => boolean | void)[] = [];

let io: typeof ioModule | undefined;

export function getIO() {
  if (!io) throw new Error("Too early");
  return io;
}

function doIOHooks() {
  const { send, _dispatchEvent } = getIO();

  getIO().send = function (packet, ...data) {
    for (const hook of ioSendHooks) if (hook(packet, data) === false) return;
    return send.call(this, packet, ...data);
  };

  getIO()._dispatchEvent = function (packet, ...data) {
    for (const hook of ioDispatchHooks)
      if (hook(packet, data) === false) return;
    return _dispatchEvent.call(this, packet, ...data);
  };
}

if (isDevelopment) {
  console.trace("DEV");

  Object.assign(getExposedWindow(), {
    getGame,
    getRender,
    getLocalPlayer,
    getMenuPlayer,
    getOverlay,
    getConfig,
    getIO,
  });
}
