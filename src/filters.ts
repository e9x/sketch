/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Game, Config, Player, World, Socket } from "./krunker";

export interface Module {
  exports: any;
  i: string;
}

export interface ModuleUI extends Module {
  exports: {
    render: (...args: unknown[]) => unknown;
    scale: number;
    canvas: HTMLCanvasElement;
  };
}

export interface ModulePlayers extends Module {
  exports: {
    manager: {
      new (...args: unknown[]): unknown;
    };
    Player: Player;
  };
}

export interface ModuleWorld extends Module {
  exports: () => unknown;
}

export interface ModuleGameInstance extends Module {
  exports: (this: Game, ...args: unknown[]) => Game;
}

export interface ModuleConfig extends Module {
  exports: Config;
}

type Matcher = (module: Module) => void;

const matchers: Matcher[] = [];

matchers.push((module: ModuleConfig) => {
  if (typeof module.exports?.gameVersion === "string") {
    console.log("Found config", module);
  }
});

matchers.push((module: ModuleUI) => {
  if (
    typeof module.exports?.render === "function" &&
    typeof module.exports.canvas === "object"
  ) {
    console.log("Found UI", module);
  }
});

let game: Game | undefined;

export function getGame() {
  return game;
}

let localPlayer: Player | undefined;

export function getLocalPlayer() {
  return localPlayer;
}

matchers.push((module: ModuleGameInstance) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("this.players=")
  )
    return;

  const Game = module.exports;

  module.exports = function (...args) {
    const result = Game.call(this, ...args);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    game = this;

    const { add } = this.players;

    this.players.add = function (...args) {
      const player = add.call(this, ...args);

      if (player.isYou) localPlayer = player;

      return player;
    };

    return result;
  };
});

export const inputHooks: ((inputs: number[]) => void)[] = [];

matchers.push((module: ModuleWorld) => {
  if (
    typeof module.exports !== "function" ||
    !module.exports.toString().includes("pchObjc=")
  )
    return;

  const World = module.exports;

  // @ts-ignore
  module.exports = function (
    this: World,
    ...args: [
      render: Module, // identical to render lib: genBody, invisMat, GEOS
      endscreen: Module, // identical to endscreen lib: showEndScreen, isMobile
      utils: Module, // identical to utils lib: emptyString, compressNumArray, byte shift stuff
      server: Module, // identical to servers lib: capFlag, addScripts, AI
      config: Module, // identical to config data: apiURL, esportNews, assets
      socket: Socket, // identical to socket lib: ahNum, socket, send
      overlay: Module // identical to overlay lib: bloodCustom, ctx, canvas
    ]
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    const result = (World as unknown as Function).call(this, ...args);

    const { push } = this.tmpInpts;

    this.tmpInpts.push = function (inputs) {
      for (const hook of inputHooks) hook(inputs);
      return push.call(this, inputs);
    };

    return result;
  };
});

export function matchModule(module: Module) {
  for (const matcher of matchers) matcher(module);
}
