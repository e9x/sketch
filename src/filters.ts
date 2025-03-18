import KrunkBox from "KrunkBox";
import { getExposedWindow, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import type MapObjectModule from "./krunker/Object";
import { Player } from "./krunker/Player";
import type RenderManager from "./krunker/RenderManager";
import type configModule from "./krunker/config";
import type * as ioModule from "./krunker/io";
import type * as Overlay from "./krunker/overlay";
import sketchConfig from "./sketchConfig";
import type * as THREE from "three";
import * as console from "./crashout";

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

/* javascript-obfuscator:disable */
patches.FreezeHook = [/Object\.freeze/g, () => `${dataArg}.BrianMeidell`];

data.BrianMeidell = function (obj: any) {
  if ("gameVersion" in obj) config = obj;
  return freeze(obj);
};

let config: typeof configModule | undefined;

export function getConfig() {
  if (!config) throw new Error("Too early");
  return config;
}

patches.GetOverlay = [
  /,(\w+)\.medalsList=\[/,
  (match, module) => `,${dataArg}.overlay(${module}).medalsList=[`,
];
data.overlay = function (module: any) {
  overlay = module;
  doOverlayHooks();
  return module;
};

/**
 * After the overlay is rendered
 * 2x slower than renderHooks
 * Used for game UI overlay
 */
export const overlayRenderHooks: (() => void)[] = [];
export const preOverlayRenderHooks: (() => void)[] = [];

function doOverlayHooks() {
  const overlay = getOverlay();

  Object.defineProperty(overlay, "render", {
    configurable: true,
    set: (render) => {
      delete (overlay as any).render;
      overlay.render = function (...args) {
        if (localPlayer) for (const hook of preOverlayRenderHooks) hook();
        const result = render.call(this, ...args);
        if (localPlayer) for (const hook of overlayRenderHooks) hook();
        return result;
      };
    },
  });
}

let overlay: typeof Overlay | undefined;

export function getOverlay() {
  if (!overlay) throw new Error("Too early");
  return overlay;
}

// hook routine to define class getters/setters on constructor
/*
  function je(e,a,t){return a&&V7(e.prototype,a),t&&V7(e,t),Object.defineProperty(e,"prototype",{writable:!1}),e}
  */

/*patches.FieldHelper = [
    /function (\w+)\((\w+),(\w+),(\w+)\)\{return \3&&\w+\(\2\.prototype,\3\),t&&V7\(\2,\4\),Object\.defineProperty\(\2,"prototype",\{writable:!1\}\),\2\}/,
    (match, helperFnName) =>
      `function ${helperFnName}(a,b,c){const og = ${match}; return ${dataArg}.fieldHelper(og, a, b, c)}`
  ];*/

patches.GetIO = [
  /(\w+)={ahNum:0,.*?this\.captchaHolder=null\)\}\};/,
  (match, ioVar) => `${match}${dataArg}.molestIO(${ioVar});`,
];

data.molestIO = function (lol: any) {
  io = lol;
  doIOHooks();
};

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

patches.GetGame = [
  /function (\w+)\(((?:\w+,?)+)\)(\{Object\.defineProperty\(this,"isServer",{get:function)/,
  (match, Game, argsss, body) =>
    `var ${Game}=${dataArg}.molestGame(Fuck);function Fuck(${argsss})${body}`,
];

data.molestGame = function (module: typeof Game) {
  // console.log("trace");
  return hookGame(module);
};

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

function doGameHooks() {
  const { add, generateMeshes } = getGame().players;
  // console.log("penis");

  const vvv = [
    "dyeIndex",
    "bodyIndex",
    "backIndex",
    "waistIndex",
    "hatIndex",
    "headIndex",
    "faceIndex",
    "shoeIndex",
    "petIndex",
    "wristIndex",
    "skinCol",
    "skinColIndex",
    "shirtCol",
    "sleeveCol",
    "pantsCol",
    "waistCol",
    "shoeCol",
    "hairCol",
    "meleeIndex",
  ];

  const game = getGame();

  game.players.generateMeshes = function (player, ...args) {
    if (player.isYou) {
      const s: Record<any, any> = {};
      for (const vanity of vvv) {
        s[vanity] = (player as any)[vanity];
        let val = (menuPlayer as any)[vanity];
        (player as any)[vanity] = val;
      }
      const classCfg = game.classConfig[player.classIndex];
      const c = classCfg.loadout;
      const savedSkins = getSavedVal("skins");
      const oa: Record<string, number> = savedSkins
        ? JSON.parse(savedSkins)
        : savedSkins;
      const w = oa[c[0]];
      const secondaryInd = getSavedVal("secondaryInd") || 2;
      const skins = [
        w != null ? w : -1,
        oa[secondaryInd] != null && classCfg.secondary ? oa[secondaryInd] : -1,
      ];
      const savedCharms = getSavedVal("charms");
      const vn = savedCharms ? JSON.parse(savedCharms) : [];

      let favList: number[] = [];

      const Tr = getSavedVal("krk_favList") || "[]";
      try {
        favList = JSON.parse(Tr);
      } catch {}

      function va<T>(e: T[]) {
        return e[dt(0, e.length - 1)];
      }
      function dt(e: number, a: number) {
        return Math.floor(Math.random() * (a - e + 1)) + e;
      }
      function Nn(e?: number, a?: number, t?: number) {
        var n = game.store.skins
            .map((_, i) => ({ ind: i, cnt: 1 }))
            .filter((lol) => {
              const s = game.store.skins[lol.ind];
              return (
                s &&
                (a !== undefined ? s.type == a : !s.type && s.weapon === e) &&
                (s.classIndex === undefined ||
                  s.classIndex == player.classIndex) &&
                t === undefined
              );
            }),
          r = n.filter(function (s) {
            return favList.indexOf(s.ind) >= 0;
          });
        return r.length ? va(r).ind || -1 : (n.length && va(n).ind) || -1;
      }

      const charms = [
        vn[0] == -2 ? Nn(undefined, 12) : parseInt(vn[0]),
        vn[1] != null && classCfg.secondary
          ? vn[1] == -2
            ? Nn(undefined, 12)
            : parseInt(vn[1])
          : -1,
      ];

      // console.log(player.skins);
      player.skins = skins;
      player.charms = charms;
      generateMeshes.call(this, player, ...args);

      for (const vanity of vvv) (player as any)[vanity] = s[vanity];
    } else {
      generateMeshes.call(this, player, ...args);
    }

    return player.objInstances;
  };

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

let gameConfig: Game["config"] | undefined;

export function getGameConfig() {
  if (!gameConfig) throw new Error("Too early");
  return gameConfig;
}

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

      // we have to wait for the properties to be assigned for other hooks
      setTimeout(() => {
        game = this;
        doGameHooks();
      });
    }

    return result;
  };
}

patches.GetMapObject = [
  /function (\w+)\(\w+,\w+=null\)\{.*?this\.penetrable=/,
  (match, MapObject) => `${dataArg}.MapObject(${MapObject});${match}`,
];
data.MapObject = function (map: any) {
  MapObject = map;
  doMapObjectHooks();
  return module;
};

let MapObject: typeof MapObjectModule | undefined;

export function getMapObject() {
  if (!MapObject) throw new Error("Too early");
  return MapObject;
}

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

patches.Nametags = [
  /!(\w+)\.isYou&&\1\.objInstances\){if\(\1\.canBSeen\){/,
  (match, player) =>
    `!${player}.isYou&&${player}.objInstances){if(${player}.canBSeen||${dataArg}.nametags){`,
];
Object.defineProperty(data, "nametags", {
  get: () => sketchConfig.get("nametags"),
});

// force the game to calculate FPS if the watermark is enabled
// this works because the game hides the FPS element even if this code is ran
patches.WatermarkFPS = [
  /if\((\w+)\.tmp\.showFPS\)\{for\(/,
  (match, settings) => `if(${dataArg}.watermark||${settings}.tmp.showFPS){for(`,
];
Object.defineProperty(data, "watermark", {
  get: () => sketchConfig.get("watermark"),
});

// *r.adsFov[r.getPlayerWeaponId(t)]
patches.FuckAdsFov = [
  /\*(\w+)\.adsFov/g,
  (match, render) => `*(${dataArg}.noAdsFov?${dataArg}:${render}).adsFov`,
];

Object.defineProperty(data, "noAdsFov", {
  get: () => sketchConfig.get("noAdsFovMlt"),
});

const genericAdsArray = [...Array(64)].fill(0);
Object.defineProperty(data, "adsFov", {
  get: () => {
    try {
      const ads: number[] = [];

      ads[getRender().getPlayerWeaponId(getLocalPlayer())] = 0;

      return ads;
    } catch {
      return genericAdsArray;
    }
  },
});

patches.GetMenuPlayer = [
  /(\w+)\.init\(0,0,0,"preview",!1\),/,
  (match, menuPlayer) => match + `${dataArg}.molestMenuPlayer(${menuPlayer}),`,
];

data.molestMenuPlayer = function (player: any) {
  // console.log("👅👅");
  menuPlayer = player;
  /*setTimeout(() => {
    if (localPlayer) {
      console.log(localPlayer, localPlayer.hasAnims);
    }
  });*/
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
patches.HookPlayer = [
  /(\(\w+=new \w+\(\w+,this,\w+\)\))(\.sid=\w+)/,
  (match, newGamePlayer, shit) =>
    `${dataArg}.molestNewGamePlayer(${newGamePlayer})` + shit,
];

export const newGamePlayerHooks: ((player: Player) => void)[] = [];

data.molestNewGamePlayer = function (player: any) {
  for (const hook of newGamePlayerHooks) hook(player);

  return player;
};

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

/*let schizoServer = false;
export function setSchizoServer(value: boolean) {
  console.warn("🦁𝓣𝓱𝓮 𝓛𝓲𝓸𝓷 𝓡𝓪𝓹𝓮𝓼 𝓽𝓱𝓮 𝓢𝓶𝓪𝓵𝓵 𝓓𝓸𝓰 𝓦𝓱𝓮𝓷 𝓘𝓽 𝓑𝓪𝓻𝓴𝓼");
  schizoServer = value;
}*/

// data.rapeProperty = (cunt: any, t: string, o: any) => {
//   console.log(cunt, t, o);
//   let finalDesc = { ...o };
//   // not the player list, is the game
//   if (t === "isServer") {
//     // !("list" in cunt)
//     console.log("rape rape rape rape rape rape rape raoe", o.get(), cunt, o, t);

//     // finalDesc.get = () => schizoServer || o.get();
//   }

//   return Object.defineProperty(cunt, t, finalDesc);
// };

// patches.TheLionRapesTheLittleDog = [
//   /Object\.defineProperty/g,
//   (match) => `${dataArg}.rapeProperty`,
// ];

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
    //getIO,
  });
}
