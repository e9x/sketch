/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type { Player, _canBSeen } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";

export interface Module<T = any> {
  exports: T;
  i: string;
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

let localPlayer: Player | undefined;

export function getLocalPlayer() {
  if (!localPlayer) throw new Error("Too early");
  return localPlayer;
}

export const inputHooks: ((inputs: number[]) => void)[] = [];

if (isDevelopment)
  Object.assign(new Function("return window")(), {
    getGame,
    getRender,
    getCanBSeen,
    getLocalPlayer,
  });

function doGameHooks() {
  console.log("Got game");

  const { add } = getGame().players;

  getGame().players.add = function (...args) {
    const player = add.call(this, ...args);

    if (player.isYou) localPlayer = player;

    return player;
  };

  const { push } = getGame().controls.tmpInpts;

  getGame().controls.tmpInpts.push = function (inputs) {
    for (const hook of inputHooks) hook(inputs);
    return push.call(this, inputs);
  };
}

matchers.push((module: Module<typeof Game>) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.players=")
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

    // we have to wait for the properties to be assigned
    setTimeout(() => {
      game = this;
      doGameHooks();
    });

    return result;
  };
});

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

export function matchModule(module: Module) {
  for (const matcher of matchers) matcher(module);
}

let canBSeen: string | undefined;

export function getCanBSeen(): typeof _canBSeen {
  if (!canBSeen) throw new TypeError("Too early");
  return canBSeen as unknown as typeof _canBSeen;
}

export function matchVars(src: string) {
  const [, , foundCanBSeen] =
    src.match(
      /if\((\w+)\.(\w+)\){var \w+=\1\.objInstances\.position\.clone\(/
    ) || [];

  canBSeen = foundCanBSeen;
}
