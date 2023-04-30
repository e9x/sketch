import "./hook";
import { isDevelopment } from "../consts";
import TinyRange from "./components/TinyRange";
import { inputFlags } from "./flags";
import { data } from "./inputs";
import { useTrackerConfig } from "./trackerConfig";

if (isDevelopment) console.trace("DEV");

const container = document.createElement("div");

const width = 400;

Object.assign(container.style, {
  position: "fixed",
  top: "0",
  right: "0",
  zIndex: `${1e9}`,
} as CSSStyleDeclaration);

const root = ReactDOM.createRoot(container);

document.documentElement.append(container);

root.render(<TrackerMenu />);

// optimize call (tampermonkey is slow)
const { requestAnimationFrame, Math } = window;

function Tracker({ scale }: { scale: number }) {
  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  const scaleRef = React.useRef<number>(scale);

  React.useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  React.useEffect(() => {
    if (!canvas.current) return;

    const height = canvas.current.clientHeight;

    canvas.current.height = height;

    const ctx = canvas.current.getContext("2d")!;
    if (!ctx) throw new TypeError("no ctx");

    ctx.imageSmoothingEnabled = false;

    const blockWidth = width / data.length;

    const boolHeight = 8;

    const diffHeight = height - boolHeight * inputFlags.length;

    requestAnimationFrame(frame);

    function frame() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      for (const { i, distance, flags } of data) {
        const x = blockWidth * i;

        const h = ~~(diffHeight * ((distance / Math.PI) * scaleRef.current));
        ctx.fillStyle = "blue";
        ctx.fillRect(x, diffHeight - h, blockWidth, h);

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
  }, [canvas, scaleRef]);

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
  const [scale, setScale] = useTrackerConfig("scale");
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
            step={1}
            min={1}
            max={30}
            defaultValue={scale}
            onChange={(e) => {
              setScale(e.target.valueAsNumber);
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
