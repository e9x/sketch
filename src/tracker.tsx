/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { iInputs, isDevelopment } from "./consts";
import type Game from "./krunker/Game";
import { hookContext, mirrorAttributes } from "./superHook";

if (isDevelopment) console.trace("DEV");

const container = document.createElement("div");

const width = 400;
const height = 201;

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

const data = [...Array(width)].map(() => [0, 0] as Entry);

let lastInputs: number[] | undefined;

root.render(<TrackerMenu />);

hookContext(unsafeWindow as unknown as typeof globalThis, (context) => {
  const { defineProperty } = context.Object;
  const definePropertyApply = defineProperty.apply.bind(defineProperty);

  Object.defineProperty(Object, "defineProperty", {
    configurable: true,
    writable: true,
    enumerable: false,
    value: mirrorAttributes(context.Object.defineProperty, function <
      T
    >(this: typeof Object, ...args: [o: T, p: PropertyKey, attributes: PropertyDescriptor & ThisType<any>]): T {
      const defined = definePropertyApply(this, args) as T;
      if (args[1] === "tmpPlayer") hookGame(args[0] as Game);
      return defined;
    }),
  });
});

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
      <div style={{ width: 50, height: 10, marginTop: 2, ...style }} />
    </div>
  );
}

function TrackerMenu() {
  // Highest value possible is Math.PI2 or 6.283
  const clamp = React.useRef(7);

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 5, margin: 10 }}>
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
            name="Aim Difference"
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
          title="Aim Clamp"
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
