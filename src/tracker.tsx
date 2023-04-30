/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { iInputs, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import { hookContext, mirrorAttributes } from "./superHook";

if (isDevelopment) console.trace("DEV");

const container = document.createElement("div");

const width = 400;

const dataEntries = 400;

/*
Data:

int mouse;
char flags;
*/

const dataSize = 4 + 1;

/**
 * Circular buffer
 */
const data = new Uint8Array(dataEntries * dataSize);

/**
 * Shift everything in the buffer to the right.
 */
function shiftData() {
  // Copy memory from the beginning of the data array to index 'dataSize'
  data.copyWithin(dataSize, 0, dataEntries * dataSize - dataSize);
}

/**
 * Add the new data to the end of the buffer.
 */
function addData(distance: number, flags: number) {
  shiftData();

  // add mouse and flags as the first element in data
  const view = new DataView(data.buffer, 0, dataSize);
  view.setUint32(0, distance, true);
  view.setUint8(4, flags);
}

Object.assign(container.style, {
  position: "fixed",
  top: "0",
  right: "0",
  zIndex: `${1e9}`,
} as CSSStyleDeclaration);

const root = ReactDOM.createRoot(container);

document.documentElement.append(container);

enum InputFlags {
  shoot = 2 ** 0,
  scope = 2 ** 1,
  jump = 2 ** 2,
  crouch = 2 ** 3,
  reload = 2 ** 4,
}

const inputFlags: [flag: InputFlags, color: string, name: string][] = [
  [InputFlags.shoot, "red", "Shoot"],
  [InputFlags.scope, "orange", "Scope"],
  [InputFlags.jump, "blue", "Jump"],
  [InputFlags.crouch, "green", "Crouch"],
  [InputFlags.reload, "purple", "Reload"],
];

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

function normalizeAngle(angle: number) {
  while (angle < 0) {
    angle += Math.PI * 2;
  }
  while (angle >= Math.PI * 2) {
    angle -= Math.PI * 2;
  }
  return angle;
}

function rotationDifference(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { deltaX: number; deltaY: number } {
  // Normalize the input angles to the range [0, Math.PI * 2)
  x1 = normalizeAngle(x1);
  y1 = normalizeAngle(y1);
  x2 = normalizeAngle(x2);
  y2 = normalizeAngle(y2);

  // Calculate the difference between the angles
  let deltaX = x2 - x1;
  let deltaY = y2 - y1;

  // Correct the differences to be within the range [-Math.PI, Math.PI)
  if (deltaX > Math.PI) {
    deltaX -= Math.PI * 2;
  } else if (deltaX < -Math.PI) {
    deltaX += Math.PI * 2;
  }

  if (deltaY > Math.PI) {
    deltaY -= Math.PI * 2;
  } else if (deltaY < -Math.PI) {
    deltaY += Math.PI * 2;
  }

  return { deltaX, deltaY };
}

function hookInputs(inputs: number[]) {
  if (lastInputs) {
    const x1 = inputs[iInputs.xDir] / 1000;
    const y1 = inputs[iInputs.yDir] / 1000;

    const x2 = lastInputs[iInputs.xDir] / 1000;
    const y2 = lastInputs[iInputs.yDir] / 1000;

    const delta = rotationDifference(x1, y1, x2, y2);

    const distance = Math.hypot(delta.deltaX, delta.deltaY);

    const flags =
      (inputs[iInputs.shoot] === 1 ? InputFlags.shoot : 0) |
      (inputs[iInputs.scope] === 1 ? InputFlags.scope : 0) |
      (inputs[iInputs.jump] === 1 ? InputFlags.jump : 0) |
      (inputs[iInputs.crouch] === 1 ? InputFlags.crouch : 0) |
      (inputs[iInputs.reload] === 1 ? InputFlags.reload : 0);

    addData(distance * 1000, flags);
  }

  lastInputs = inputs;
}

function Tracker({ scale }: { scale: React.MutableRefObject<number> }) {
  const canvas = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    if (!canvas.current) return;

    const height = canvas.current.clientHeight;

    canvas.current.height = height;

    const ctx = canvas.current.getContext("2d")!;
    if (!ctx) throw new TypeError("no ctx");

    ctx.imageSmoothingEnabled = false;

    const blockWidth = width / dataEntries;

    const boolHeight = 8;

    const diffHeight = height - boolHeight * inputFlags.length;

    requestAnimationFrame(frame);

    function frame() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < dataEntries; i++) {
        const view = new DataView(data.buffer, i * dataSize, dataSize);

        const x = blockWidth * i;

        // diff
        const diff = view.getUint32(0, true) / 1000;

        if (diff) {
          const h = ~~(
            diffHeight *
            (Math.min(diff, scale.current) / scale.current)
          );
          ctx.fillStyle = "blue";
          ctx.fillRect(x, diffHeight - h, blockWidth, h);
        }

        // draw flags
        const flags = view.getUint8(4);

        for (let b = 0; b < inputFlags.length; b++)
          if (flags & inputFlags[b][0]) {
            ctx.fillStyle = inputFlags[b][1];
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

  return (
    <canvas width={width} height={0} style={{ height: "100%" }} ref={canvas} />
  );
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
  // Highest value possible is PI
  const scale = React.useRef(3.2);
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
          gap: 6,
        }}
      >
        <div
          style={{
            backgroundColor: "#353535",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: 8,
            gap: 6,
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
              gap: 6,
            }}
            name="Mouse"
          />
          {inputFlags.map((bit, i) => (
            <LegendKey
              key={i}
              style={{ backgroundColor: bit[1] }}
              name={bit[2]}
            />
          ))}
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
          <Tracker scale={scale} />
          <TinyRange
            title="Mouse Scale"
            step={0.01}
            min={0.01}
            max={3.2}
            defaultValue={scale.current}
            onChange={(e) => {
              scale.current = e.target.valueAsNumber;
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
