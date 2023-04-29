/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { iInputs, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import { hookContext, mirrorAttributes } from "./superHook";

if (isDevelopment) console.trace("DEV");

const container = document.createElement("div");

const width = 400;
const height = 173; // has to be manually calculated

Object.assign(container.style, {
  position: "fixed",
  top: "0",
  right: "0",
  zIndex: `${1e9}`,
} as CSSStyleDeclaration);

const root = ReactDOM.createRoot(container);

document.documentElement.append(container);

enum BoolBits {
  shoot = 2 ** 0,
  scope = 2 ** 1,
  jump = 2 ** 2,
  crouch = 2 ** 3,
  reload = 2 ** 4,
}

const boolBits: [bit: BoolBits, color: string, name: string][] = [
  [BoolBits.shoot, "red", "Shoot"],
  [BoolBits.scope, "orange", "Scope"],
  [BoolBits.jump, "blue", "Jump"],
  [BoolBits.crouch, "green", "Crouch"],
  [BoolBits.reload, "purple", "Reload"],
];

type Entry = [distance: number, bit: number];

const data = [...Array(width / 2)].map(() => [0, 0] as Entry);

let lastInputs: number[] | undefined;

root.render(<TrackerMenu />);

// JSON.parse is easy hook
// there's no strict mode on JSON modules
// start to end: module.exports = JSON.parse('"4FgX6d931s0EzfUWGtZ4QkiJglWpDl5V"');
// see, no use strict
// but it can be tripped like:
// JSON.parse({ toString() { console.log("Got you:", new Error().stack); } })
// JSON.parse("1", () => { console.log("Got you:", new Error().stack); })
// Object.create(() => { }, new Proxy({}, { ownKeys: () => { console.log("Got you:", new Error().stack); } }))

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

function hookInputs(inputs: number[]) {
  if (lastInputs) {
    const x1 = inputs[iInputs.xDir] / 1000;
    const y1 = inputs[iInputs.yDir] / 1000;

    const x2 = lastInputs[iInputs.xDir] / 1000;
    const y2 = lastInputs[iInputs.yDir] / 1000;

    const distance = Math.hypot(x2 - x1, y2 - y1);

    data.push([
      distance,
      (inputs[iInputs.shoot] === 1 ? BoolBits.shoot : 0) |
        (inputs[iInputs.scope] === 1 ? BoolBits.scope : 0) |
        (inputs[iInputs.jump] === 1 ? BoolBits.jump : 0) |
        (inputs[iInputs.crouch] === 1 ? BoolBits.crouch : 0) |
        (inputs[iInputs.reload] === 1 ? BoolBits.reload : 0),
    ]);

    data.splice(0, 1);
  }

  lastInputs = inputs;
}

function Tracker({ clamp }: { clamp: React.MutableRefObject<number> }) {
  const canvas = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (!canvas.current) return;

    const ctx = canvas.current.getContext("2d")!;
    if (!ctx) throw new TypeError("no ctx");

    ctx.imageSmoothingEnabled = false;

    const blockWidth = width / data.length;

    const boolHeight = 8;

    const diffHeight = height - boolHeight * boolBits.length;

    requestAnimationFrame(frame);

    function frame() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < data.length; i++) {
        const val = data[i];

        const x = blockWidth * i;

        // diff
        if (val[0]) {
          const h = ~~(
            diffHeight *
            (Math.min(val[0], clamp.current) / clamp.current)
          );
          ctx.fillStyle = "blue";
          ctx.fillRect(x, diffHeight - h, blockWidth, h);
        }

        // draw bits
        for (let b = 0; b < boolBits.length; b++)
          if (val[1] & boolBits[b][0]) {
            ctx.fillStyle = boolBits[b][1];
            ctx.fillRect(
              x,
              diffHeight + boolHeight * b,
              blockWidth,
              boolHeight
            );
          }
      }

      requestAnimationFrame(frame);
    }
  }, [canvas]);

  return <canvas width={width} height={height} ref={canvas} />;
}

function LegendKey({
  name,
  style,
}: {
  name: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        margin: "0 10px",
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ color: "white", fontSize: 8 }}>{name}</span>
      <div style={{ width: 35, height: 10, marginTop: 2, ...style }} />
    </div>
  );
}

function TrackerMenu() {
  // Highest value possible is Math.PI2 or 6.283
  const clamp = React.useRef(7);
  const [visible, setVisible] = React.useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", margin: 10 }}>
      <div
        style={{
          maxHeight: visible ? undefined : 0,
          overflow: "hidden",
          display: "flex",
          marginBottom: visible ? 5 : 0,
          flexDirection: "row",
          gap: 5,
        }}
      >
        <div
          style={{
            backgroundColor: "#353535",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ color: "white", fontSize: 10, margin: "8px 0" }}>
            Legend
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              marginBottom: 8,
            }}
          >
            <LegendKey
              style={{
                backgroundSize: "10px 1px",
                backgroundRepeat: "repeat",
                backgroundPosition: "1px 0",
                backgroundImage:
                  "linear-gradient(90deg, blue 75%, transparent 1%)",
                backgroundColor: "white",
              }}
              name="Mouse"
            />
            {boolBits.map((bit, i) => (
              <LegendKey
                key={i}
                style={{ backgroundColor: bit[1] }}
                name={bit[2]}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            width,
            backgroundColor: "#353535",
            display: "flex",
            flexDirection: "column",
            fontSize: 10,
          }}
        >
          <Tracker clamp={clamp} />
          <TinyRange
            title="Mouse Scale"
            step={0.01}
            min={0.01}
            max={7}
            defaultValue={clamp.current}
            onChange={(e) => {
              clamp.current = e.target.valueAsNumber;
            }}
          />
        </div>
      </div>
      <div
        style={{
          width: "100%",
          height: 25,
          color: "white",
          textAlign: "center",
          backgroundColor: "#353535",
          cursor: "pointer",
        }}
        onClick={() => setVisible(!visible)}
        className="material-icons"
      >
        {visible ? "expand_less" : "expand_more"}
      </div>
    </div>
  );
}

function TinyRange({
  title,
  onChange,
  defaultValue,
  min,
  max,
  step,
}: {
  title: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
}) {
  const numberInput = React.useRef<HTMLInputElement | null>(null);
  const rangeInput = React.useRef<HTMLInputElement | null>(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "4px 12px",
      }}
    >
      <span
        style={{
          color: "#ffffff",
        }}
      >
        {title}
      </span>
      <input
        type="range"
        defaultValue={
          typeof defaultValue === "number"
            ? defaultValue.toString()
            : defaultValue
        }
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          if (numberInput.current)
            numberInput.current.valueAsNumber =
              event.currentTarget.valueAsNumber;
          if (onChange) onChange.call(undefined as never, event);
        }}
        style={{ marginLeft: "auto", marginRight: 5 }}
        ref={rangeInput}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={
          typeof defaultValue === "number"
            ? defaultValue.toString()
            : defaultValue
        }
        onChange={(event) => {
          if (rangeInput.current)
            rangeInput.current.valueAsNumber =
              event.currentTarget.valueAsNumber;
          if (onChange) onChange.call(undefined as never, event);
        }}
        style={{
          fontSize: "inherit",
        }}
        ref={numberInput}
      />
    </div>
  );
}
