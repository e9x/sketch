/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// JSON.parse is easy hook
// there's no strict mode on JSON modules
// start to end: module.exports = JSON.parse('"4FgX6d931s0EzfUWGtZ4QkiJglWpDl5V"');
// see, no use strict
// but it can be tripped like:
// JSON.parse({ toString() { console.log("Got you:", new Error().stack); } })
// JSON.parse("1", () => { console.log("Got you:", new Error().stack); })
// Object.create(() => { }, new Proxy({}, { ownKeys: () => { console.log("Got you:", new Error().stack); } }))

import type Game from "../krunker/Game";
import { hookContext, mirrorAttributes } from "../superHook";
import { hookInputs } from "./inputs";

type WebpackModule = {
  i: number;
  l: boolean;
  exports: any;
};

type WebpackModuleFactory = (
  this: WebpackModule,
  module: WebpackModule,
  exports: WebpackModule["exports"],
  require: WebpackRequire
) => void;

type WebpackRequire = ((i: number) => unknown) & {
  m: (WebpackModuleFactory | undefined)[];
};

function isWebpackRequire(e: unknown): e is WebpackRequire {
  return typeof e === "function" && "c" in e && "m" in e && Array.isArray(e.m);
}

let hookedRequire = false;

function hookWebpackRequire(require: WebpackRequire) {
  if (hookedRequire) return;

  for (let i = 0; i < require.m.length; i++) {
    const entry = require.m[i];

    if (entry?.toString().includes("this.players=new ")) {
      // hook the toString value for anything else hooking this module based on this.players=
      require.m[i] = mirrorAttributes(entry, function (
        module,
        exports,
        require
      ) {
        entry.call(this, module, exports, require);

        const oldExports = module.exports;

        module.exports = mirrorAttributes(
          oldExports,
          function (this: any, ...args: any[]) {
            const result = oldExports.call(this, ...args);
            setTimeout(() => hookGame(this));
            return result;
          }
        );
      } as WebpackModuleFactory);

      hookedRequire = true;
    }
  }
}

// 1.js calls Object.keys
// 1.js doesn't have 'use strict';
// but Object.keys trips Proxy stuff...

// Hooking Math.anything won't work because arguments have [Symbol.toPrimitive] called
// Math.round({ [Symbol.toPrimitive](){ console.log("Got you:", new Error().stack); }})

// We need a global method that only accepts an object as the argument, doesn't do any primitive object stuff, and is called very early in the bundle without strict mode
// Object.create
// Array.prototype.concat
// Array.prototype.* (arrays don't do really anything with objects!)
// Typed Array methods too

// 143.js:
/*
var mExports = require('./6.js');
var p_Buffer = mExports.Buffer;
function funcAreShinning(argCloudQuestion, argHopePush) {
    for (var varDistanceStar in argCloudQuestion) {
        argHopePush[varDistanceStar] = argCloudQuestion[varDistanceStar];
    }
}
if (p_Buffer.from && p_Buffer.alloc && p_Buffer.allocUnsafe && p_Buffer.allocUnsafeSlow) {
    module.exports = mExports;
} else {
    funcAreShinning(mExports, exports);
    exports.Buffer = mBuffer;
}
function mBuffer(argDistanceNow, argAngrySoil, argConsiderTell) {
    return p_Buffer(argDistanceNow, argAngrySoil, argConsiderTell);
}
mBuffer.prototype = Object.create(p_Buffer.prototype);
*/

// Hook some global class that accepts NO PARAMETERS

// 292.js:
// - no use strict
// - new Image
// hook the setter/getter? no, prototype will be there

// new Image({ [Symbol.toPrimitive](){ console.log("Got you:", new Error().stack); } });

// find a constructor that has NO arguments.
// Hook all the Error constructors.... but won't fix errors thrown from the engine
// eg new HTMLElement() will return an error that was constructed without using the constructor
// and Error.captureStackTrace

// const freak = Reflect.construct(Image, [], HTMLDocument)??

hookContext(unsafeWindow as unknown as typeof globalThis, (context) => {
  const { Image } = context;

  const HookedImage = new Function(
    "kpal",
    "_81xd",
    "return function Image(){try{kpal(arguments.callee.caller.arguments)}catch{}return _81xd(arguments, new.target)}"
  )(
    (calleeCallerArgs: IArguments | undefined) => {
      try {
        if (calleeCallerArgs?.length === 3) {
          // this.players=new
          const webpackRequire = [...calleeCallerArgs].find(isWebpackRequire);
          if (webpackRequire) hookWebpackRequire(webpackRequire);
        }
      } catch (err) {
        console.error(err);
      }
    },
    (args: IArguments, newTarget: HTMLImageElement) => {
      if (!newTarget)
        throw new TypeError(
          "Failed to construct 'Image': Please use the 'new' operator, this DOM object constructor cannot be called as a function."
        );
      // @ts-ignore
      return Reflect.construct(Image, args, newTarget);
    }
  ) as any;

  mirrorAttributes(context.Image, HookedImage, true);

  HookedImage.prototype = Image.prototype;

  context.Image = HookedImage;
});

// Error.captureStackTrace(new Proxy(new Error(), { defineProperty: console.trace }))

function hookGame(game: Game) {
  const { push } = game.controls.tmpInpts;

  game.controls.tmpInpts.push = function (inputs) {
    hookInputs(inputs);
    return push.call(this, inputs);
  };
}
