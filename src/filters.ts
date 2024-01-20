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

export interface Module<T = any> {
  exports: T;
  i: number;
}

type Matcher = (module: Module) => void;

const matchers: Matcher[] = [];

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

function doGameHooks() {
  const { add } = getGame().players;

  getGame().players.add = function (...args) {
    const player = add.call(this, ...args);

    if (player.isYou) localPlayer = player;

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

export function getMenuPlayer() {
  return menuPlayer;
}

/**
 * basically when menuPlayer is created
 */
export const playerConstructorHooks: ((player: Player) => void)[] = [];

matchers.push((module: Module<typeof Player>) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.deaths=") ||
    !module.exports.toString().includes("this.stats=")
  )
    return;

  const Player = module.exports;

  module.exports = class extends Player {
    constructor(...args: any[]) {
      super(...args);
      menuPlayer = this;
      for (const hook of playerConstructorHooks) hook(this);
    }
  };
});

matchers.push((module: Module<typeof Game>) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.players=new")
  )
    return;

  const Game = module.exports;

  // @ts-ignore
  module.exports = function (
    this: Game,
    ...args: ConstructorParameters<typeof Game>
  ) {
    const result = Game.call(this, ...args);

    // new Game()
    // game.controls = ...
    // game.ui = ...

    // can be determined by comparing the arguments to new Game();
    // on sandbox, the game is created twice...
    // args[1] is actually 0. this might be a host ID?
    const isMainGame = typeof args[1] === "number";

    // we have to wait for the properties to be assigned
    if (isMainGame)
      setTimeout(() => {
        game = this;
        doGameHooks();
      });

    return result;
  };
});

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

matchers.push((module: Module<typeof Overlay>) => {
  if (
    typeof module.exports !== "object" ||
    module.exports === null ||
    !("medalsList" in module.exports)
  )
    return;

  overlay = module.exports;
  doOverlayHooks();
});

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

matchers.push((module: Module<typeof MapObjectModule>) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.penetrable=")
  )
    return;

  MapObject = module.exports;
  doMapObjectHooks();
});

/**
 * After the 3D game is rendered
 * 2x faster than overlayRenderHooks
 * Used for THREE.js
 */
export const renderHooks: (() => void)[] = [];
export const preRenderHooks: (() => void)[] = [];

function doRenderHooks() {
  const { render } = getRender();

  getRender().render = function (...args) {
    if (localPlayer) for (const hook of preRenderHooks) hook();
    const result = render.call(this, ...args);
    if (localPlayer) for (const hook of renderHooks) hook();
    return result;
  };
}

matchers.push((module: Module<typeof RenderManager>) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.GEOS=")
  )
    return;

  const RenderManager = module.exports;

  // @ts-ignore
  module.exports = function (
    this: RenderManager,
    ...args: ConstructorParameters<typeof RenderManager>
  ) {
    const result = RenderManager.call(this, ...args);

    // new Game()
    // game.controls = ...
    // game.ui = ...

    // we have to wait for the properties to be assigned
    setTimeout(() => {
      render = this;
      doRenderHooks();
    });

    return result;
  };
});

let config: typeof configModule | undefined;

export function getConfig() {
  if (!config) throw new Error("Too early");
  return config;
}

matchers.push((module: Module<typeof configModule>) => {
  if (
    typeof module.exports !== "object" ||
    module.exports === null ||
    !("gameVersion" in module.exports)
  )
    return;

  config = module.exports;
});

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

matchers.push((module: Module<typeof ioModule>) => {
  if (
    typeof module.exports !== "object" ||
    module.exports === null ||
    !("ahNum" in module.exports)
  )
    return;

  io = module.exports;
  doIOHooks();
});

export function matchModule(module: Module) {
  for (const matcher of matchers) matcher(module);
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
